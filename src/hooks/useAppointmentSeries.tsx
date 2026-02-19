import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { useFreshStaffTimezone } from './useStaffTimezone';
import { getDBTimezoneEnum } from '@/lib/appointmentTimezone';
import { syncMultipleAppointmentsToGoogle } from '@/lib/googleCalendarSync';

/**
 * Appointment Series interface matching the `appointment_series` table schema
 * with joined data and computed stats
 */
export interface AppointmentSeries {
  id: string;
  tenant_id: string;
  client_id: string;
  staff_id: string;
  service_id: string;
  rrule: string;
  start_at: string;
  duration_minutes: number;
  time_zone: string;
  series_end_date: string | null;
  max_occurrences: number | null;
  is_active: boolean;
  notes: string | null;
  created_by_profile_id: string;
  created_at: string;
  updated_at: string;
  // Joined data
  client_name: string;
  service_name: string;
  clinician_name: string;
  // Computed stats
  total_occurrences: number;
  completed_occurrences: number;
  next_occurrence_date?: string;
}

export interface CreateAppointmentSeriesInput {
  client_id: string;
  service_id: string;
  start_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  duration_minutes: number;
  rrule: string;
  series_end_date?: string | null;
  max_occurrences?: number | null;
  notes?: string;
  is_telehealth?: boolean;
}

// Legacy alias
export type JobSeries = AppointmentSeries;

/**
 * Hook to manage recurring appointment series.
 * 
 * Time Model (server-authoritative):
 * 1. User selects start date/time in their LOCAL timezone
 * 2. This hook calls PostgreSQL convert_local_to_utc RPC for conversion
 * 3. Database stores UTC timestamps (start_at as timestamptz)
 * 4. time_zone column stores creator's timezone as metadata
 */
export function useAppointmentSeries() {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const { timezone: staffTimezone, isLoading: timezoneLoading } = useFreshStaffTimezone();

  const [series, setSeries] = useState<AppointmentSeries[]>([]);
  const [loading, setLoading] = useState(true);

  const staffId = user?.staffAttributes?.staffData?.id;

  // Fetch all appointment series with joined data and stats
  const fetchSeries = useCallback(async () => {
    if (!user || !tenantId) return;

    try {
      setLoading(true);

      const { data: seriesData, error: seriesError } = await supabase
        .from('appointment_series')
        .select(`
          id, tenant_id, client_id, staff_id, service_id, rrule,
          start_at, duration_minutes, time_zone, series_end_date,
          max_occurrences, is_active, notes, created_by_profile_id,
          created_at, updated_at,
          clients!inner(pat_name_f, pat_name_l, pat_name_m, pat_name_preferred),
          services!inner(name),
          staff!inner(prov_name_f, prov_name_l, prov_name_for_clients)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (seriesError) {
        console.error('[useAppointmentSeries] Error loading series:', seriesError);
        toast({ variant: "destructive", title: "Error loading appointment series", description: seriesError.message });
        return;
      }

      const transformedSeries: AppointmentSeries[] = [];
      
      for (const s of seriesData || []) {
        const { data: occurrenceStats } = await supabase
          .from('appointments')
          .select('id, status, start_at')
          .eq('series_id', s.id);

        const totalOccurrences = occurrenceStats?.length || 0;
        const completedOccurrences = occurrenceStats?.filter(o => o.status === 'completed' || o.status === 'documented').length || 0;
        const nextOccurrence = occurrenceStats
          ?.filter(o => o.status === 'scheduled' && new Date(o.start_at) > new Date())
          .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];

        const clientData = s.clients as any;
        const serviceData = s.services as any;
        const staffData = s.staff as any;
        
        transformedSeries.push({
          id: s.id, tenant_id: s.tenant_id, client_id: s.client_id,
          staff_id: s.staff_id, service_id: s.service_id, rrule: s.rrule,
          start_at: s.start_at, duration_minutes: s.duration_minutes,
          time_zone: s.time_zone, series_end_date: s.series_end_date,
          max_occurrences: s.max_occurrences, is_active: s.is_active,
          notes: s.notes, created_by_profile_id: s.created_by_profile_id,
          created_at: s.created_at, updated_at: s.updated_at,
          client_name: clientData?.pat_name_preferred || 
            [clientData?.pat_name_f, clientData?.pat_name_m, clientData?.pat_name_l]
              .filter(Boolean).join(' ').trim() || 'Unknown Client',
          service_name: serviceData?.name || 'Unknown Service',
          clinician_name: staffData?.prov_name_for_clients ||
            [staffData?.prov_name_f, staffData?.prov_name_l]
              .filter(Boolean).join(' ').trim() || 'Unassigned',
          total_occurrences: totalOccurrences,
          completed_occurrences: completedOccurrences,
          next_occurrence_date: nextOccurrence?.start_at,
        });
      }

      setSeries(transformedSeries);
    } catch (error: any) {
      console.error('[useAppointmentSeries] Error:', error);
      toast({ variant: "destructive", title: "Error loading appointment series", description: error.message });
    } finally {
      setLoading(false);
    }
  }, [user, tenantId, toast]);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  // Create a new appointment series
  const createSeries = async (input: CreateAppointmentSeriesInput) => {
    if (timezoneLoading || !staffTimezone) {
      throw new Error('Timezone not yet loaded. Please wait a moment and try again.');
    }
    if (!user || !tenantId || !staffId) {
      throw new Error('User not authenticated or staff ID not found');
    }

    // Convert local start time to UTC via PostgreSQL RPC (server-authoritative)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('convert_local_to_utc', {
      p_date: input.start_date,
      p_time: input.start_time,
      p_timezone: staffTimezone,
    });

    if (rpcError || !rpcResult) {
      const msg = rpcError?.message || 'Failed to convert timezone';
      toast({ variant: 'destructive', title: 'Timezone conversion failed', description: msg });
      throw new Error(msg);
    }

    const startUTC = new Date(rpcResult).toISOString();
    const dbTimezone = getDBTimezoneEnum(staffTimezone);

    const seriesData = {
      tenant_id: tenantId,
      client_id: input.client_id,
      staff_id: staffId,
      service_id: input.service_id,
      rrule: input.rrule,
      start_at: startUTC,
      duration_minutes: input.duration_minutes,
      time_zone: dbTimezone,
      series_end_date: input.series_end_date || null,
      max_occurrences: input.max_occurrences || null,
      is_active: true,
      notes: input.notes || null,
      created_by_profile_id: user.id,
    };

    const { data: newSeries, error: insertError } = await supabase
      .from('appointment_series')
      .insert(seriesData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating appointment series:', insertError);
      toast({ variant: 'destructive', title: 'Failed to create recurring appointments', description: insertError.message });
      throw insertError;
    }

    // Generate initial occurrences via edge function
    try {
      const { data: genResult, error: genError } = await supabase.functions.invoke(
        'generate-appointment-occurrences',
        { body: { seriesId: newSeries.id, monthsAhead: 3, maxOccurrences: 200, is_telehealth: input.is_telehealth ?? false } }
      );

      if (genError) {
        console.error('Error generating occurrences:', genError);
        toast({ variant: 'destructive', title: 'Series created but occurrences failed', description: genError.message });
      } else {
        toast({ title: 'Recurring appointments created', description: `Series created with ${genResult?.generated?.created || 0} initial appointments` });
      }
    } catch (err: any) {
      console.error('Error invoking generate function:', err);
      toast({ variant: 'destructive', title: 'Series created but occurrences failed', description: err.message });
    }

    await fetchSeries();
    return newSeries;
  };

  // Update an existing series
  const updateSeries = async (seriesId: string, updates: Partial<AppointmentSeries>) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    const { 
      client_name, service_name, clinician_name, 
      total_occurrences, completed_occurrences, next_occurrence_date,
      ...dbUpdates 
    } = updates;

    const { data, error: updateError } = await supabase
      .from('appointment_series')
      .update(dbUpdates)
      .eq('id', seriesId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating series:', updateError);
      throw updateError;
    }

    if (updates.is_active === false) {
      await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('series_id', seriesId)
        .gt('start_at', new Date().toISOString())
        .neq('status', 'completed')
        .neq('status', 'documented');
    }

    if (data.is_active) {
      try {
        await supabase.functions.invoke('generate-appointment-occurrences', {
          body: { seriesId: data.id, monthsAhead: 3, maxOccurrences: 200 },
        });
      } catch (err) {
        console.error('Error regenerating occurrences:', err);
      }
    }

    toast({ title: 'Series updated', description: 'The recurring appointment series has been updated.' });
    await fetchSeries();
    return data;
  };

  // Delete an appointment series
  const deleteSeries = async (seriesId: string) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    const { data: appointmentsToDelete } = await supabase
      .from('appointments')
      .select('id')
      .eq('series_id', seriesId);

    if (appointmentsToDelete && appointmentsToDelete.length > 0) {
      syncMultipleAppointmentsToGoogle(appointmentsToDelete.map(a => a.id), 'delete');
    }

    await supabase.from('appointments').delete().eq('series_id', seriesId);

    const { error: deleteError } = await supabase
      .from('appointment_series')
      .delete()
      .eq('id', seriesId)
      .eq('tenant_id', tenantId);

    if (deleteError) {
      console.error('Error deleting series:', deleteError);
      throw deleteError;
    }

    toast({ title: 'Series deleted', description: 'The recurring appointment series and all its occurrences have been deleted.' });
    await fetchSeries();
  };

  const toggleActive = async (seriesId: string, isActive: boolean) => {
    return updateSeries(seriesId, { is_active: isActive });
  };

  return {
    series,
    jobSeries: series,
    loading,
    refetch: fetchSeries,
    createSeries,
    updateSeries,
    updateJobSeries: updateSeries,
    deleteSeries,
    deleteJobSeries: deleteSeries,
    toggleActive,
  };
}
