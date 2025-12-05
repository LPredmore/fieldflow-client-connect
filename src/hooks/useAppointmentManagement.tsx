import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

/**
 * Appointment interface matching the actual `appointments` table schema
 */
export interface ManagedAppointment {
  id: string;
  tenant_id: string;
  client_id: string;
  staff_id: string;
  service_id: string;
  series_id: string | null;
  start_at: string;
  end_at: string;
  time_zone: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  is_telehealth: boolean;
  location_name: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  client_name: string;
  service_name: string;
  clinician_name: string;
}

/**
 * Appointment Series interface matching the actual `appointment_series` table schema
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

// Legacy aliases
export type OneTimeAppointment = ManagedAppointment;
export type OneTimeJob = ManagedAppointment;
export type JobSeries = AppointmentSeries;

/**
 * Hook for managing appointments and appointment series
 * Queries the correct `appointments` and `appointment_series` tables
 */
export function useAppointmentManagement() {
  const [appointments, setAppointments] = useState<ManagedAppointment[]>([]);
  const [series, setSeries] = useState<AppointmentSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, tenantId } = useAuth();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!user || !tenantId) return;

    try {
      setLoading(true);

      // Fetch appointments (individual occurrences)
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          tenant_id,
          client_id,
          staff_id,
          service_id,
          series_id,
          start_at,
          end_at,
          time_zone,
          status,
          is_telehealth,
          location_name,
          created_at,
          updated_at,
          clients!inner(pat_name_f, pat_name_l, pat_name_m, pat_name_preferred),
          services!inner(name),
          staff!inner(prov_name_f, prov_name_l, prov_name_for_clients)
        `)
        .eq('tenant_id', tenantId)
        .order('start_at', { ascending: false });

      if (appointmentsError) {
        console.error('Error loading appointments:', appointmentsError);
        toast({
          variant: "destructive",
          title: "Error loading appointments",
          description: appointmentsError.message,
        });
        return;
      }

      // Transform appointments
      const transformedAppointments: ManagedAppointment[] = (appointmentsData || []).map((appt: any) => ({
        id: appt.id,
        tenant_id: appt.tenant_id,
        client_id: appt.client_id,
        staff_id: appt.staff_id,
        service_id: appt.service_id,
        series_id: appt.series_id,
        start_at: appt.start_at,
        end_at: appt.end_at,
        time_zone: appt.time_zone,
        status: appt.status,
        is_telehealth: appt.is_telehealth,
        location_name: appt.location_name,
        created_at: appt.created_at,
        updated_at: appt.updated_at,
        client_name: appt.clients?.pat_name_preferred || 
          [appt.clients?.pat_name_f, appt.clients?.pat_name_m, appt.clients?.pat_name_l]
            .filter(Boolean).join(' ').trim() || 'Unknown Client',
        service_name: appt.services?.name || 'Unknown Service',
        clinician_name: appt.staff?.prov_name_for_clients ||
          [appt.staff?.prov_name_f, appt.staff?.prov_name_l]
            .filter(Boolean).join(' ').trim() || 'Unassigned',
      }));

      setAppointments(transformedAppointments);

      // Fetch appointment series
      const { data: seriesData, error: seriesError } = await supabase
        .from('appointment_series')
        .select(`
          id,
          tenant_id,
          client_id,
          staff_id,
          service_id,
          rrule,
          start_at,
          duration_minutes,
          time_zone,
          series_end_date,
          max_occurrences,
          is_active,
          notes,
          created_by_profile_id,
          created_at,
          updated_at,
          clients!inner(pat_name_f, pat_name_l, pat_name_m, pat_name_preferred),
          services!inner(name),
          staff!inner(prov_name_f, prov_name_l, prov_name_for_clients)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (seriesError) {
        console.error('Error loading appointment series:', seriesError);
        toast({
          variant: "destructive",
          title: "Error loading appointment series",
          description: seriesError.message,
        });
        return;
      }

      // Transform series with occurrence stats
      const transformedSeries: AppointmentSeries[] = [];
      
      for (const s of seriesData || []) {
        // Get occurrence stats for this series
        const { data: occurrenceStats } = await supabase
          .from('appointments')
          .select('id, status, start_at')
          .eq('series_id', s.id);

        const totalOccurrences = occurrenceStats?.length || 0;
        const completedOccurrences = occurrenceStats?.filter(o => o.status === 'completed').length || 0;
        const nextOccurrence = occurrenceStats
          ?.filter(o => o.status === 'scheduled' && new Date(o.start_at) > new Date())
          .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];

        const clientData = s.clients as any;
        const serviceData = s.services as any;
        const staffData = s.staff as any;
        
        transformedSeries.push({
          id: s.id,
          tenant_id: s.tenant_id,
          client_id: s.client_id,
          staff_id: s.staff_id,
          service_id: s.service_id,
          rrule: s.rrule,
          start_at: s.start_at,
          duration_minutes: s.duration_minutes,
          time_zone: s.time_zone,
          series_end_date: s.series_end_date,
          max_occurrences: s.max_occurrences,
          is_active: s.is_active,
          notes: s.notes,
          created_by_profile_id: s.created_by_profile_id,
          created_at: s.created_at,
          updated_at: s.updated_at,
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
      console.error('Error loading appointment data:', error);
      toast({
        variant: "destructive",
        title: "Error loading appointment data",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }, [user, tenantId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update an appointment
  const updateAppointment = useCallback(async (appointmentId: string, updates: Partial<ManagedAppointment>) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    // Remove joined fields
    const { client_name, service_name, clinician_name, ...dbUpdates } = updates;

    const { data, error } = await supabase
      .from('appointments')
      .update(dbUpdates)
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    toast({
      title: "Appointment updated",
      description: "The appointment has been successfully updated.",
    });

    await fetchData();
    return data;
  }, [user, tenantId, toast, fetchData]);

  // Update an appointment series
  const updateSeries = useCallback(async (seriesId: string, updates: Partial<AppointmentSeries>) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    // Remove computed/joined fields
    const { 
      client_name, service_name, clinician_name, 
      total_occurrences, completed_occurrences, next_occurrence_date,
      ...dbUpdates 
    } = updates;

    const { data, error } = await supabase
      .from('appointment_series')
      .update(dbUpdates)
      .eq('id', seriesId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // If deactivating series, cancel all future appointments
    if (updates.is_active === false) {
      await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('series_id', seriesId)
        .gt('start_at', new Date().toISOString())
        .neq('status', 'completed');
    }

    toast({
      title: "Appointment series updated",
      description: "The appointment series has been successfully updated.",
    });

    await fetchData();
    return data;
  }, [user, tenantId, toast, fetchData]);

  // Delete an appointment
  const deleteAppointment = useCallback(async (appointmentId: string) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    toast({
      title: "Appointment deleted",
      description: "The appointment has been successfully deleted.",
    });

    await fetchData();
  }, [user, tenantId, toast, fetchData]);

  // Delete an appointment series
  const deleteSeries = useCallback(async (seriesId: string) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    // First delete all appointments in the series
    await supabase
      .from('appointments')
      .delete()
      .eq('series_id', seriesId);

    // Then delete the series
    const { error } = await supabase
      .from('appointment_series')
      .delete()
      .eq('id', seriesId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    toast({
      title: "Appointment series deleted",
      description: "The appointment series and all its occurrences have been deleted.",
    });

    await fetchData();
  }, [user, tenantId, toast, fetchData]);

  // Combine appointments and series for display
  const allAppointments = [...appointments, ...series]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    // Data
    appointments,
    oneTimeJobs: appointments, // Legacy alias
    series,
    jobSeries: series, // Legacy alias
    allManagedJobs: allAppointments, // Legacy alias
    
    // State
    loading,
    
    // Actions
    refetch: fetchData,
    updateAppointment,
    updateOneTimeJob: updateAppointment, // Legacy alias
    updateSeries,
    updateJobSeries: updateSeries, // Legacy alias
    deleteAppointment,
    deleteOneTimeJob: deleteAppointment, // Legacy alias
    deleteSeries,
    deleteJobSeries: deleteSeries, // Legacy alias
  };
}

// Legacy export alias
export const useJobManagement = useAppointmentManagement;
