import { useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { utcToLocal } from '@/lib/appointmentTimezone';
import { useToast } from '@/hooks/use-toast';

export interface CalendarAppointment {
  id: string;
  series_id: string | null;
  client_id: string;
  client_name: string;
  staff_id: string;
  clinician_name: string;
  service_id: string;
  service_name?: string;
  start_at: string; // UTC timestamp from database
  end_at: string;   // UTC timestamp from database
  status: 'scheduled' | 'completed' | 'cancelled';
  is_telehealth: boolean;
  location_name?: string;
  created_at: string;
  updated_at?: string;
  tenant_id: string;
  time_zone: string; // Creator's timezone (metadata, not used for rendering)
  // Derived fields for display (converted to viewer's local timezone)
  local_start?: Date;
  local_end?: Date;
}

type CalendarRange = { fromISO: string; toISO: string };

function iso(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, -1) + 'Z';
}

function defaultRange(): CalendarRange {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  const to = new Date(now);
  to.setDate(to.getDate() + 90);
  return { fromISO: from.toISOString(), toISO: to.toISOString() };
}

/**
 * Hook to fetch calendar appointments from the appointments table.
 * Queries the actual appointments table with correct schema.
 */
export function useCalendarAppointments() {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRangeRef = useRef<string>('');
  const isFetchingRef = useRef(false);

  const [range, setRange] = useState<CalendarRange>(defaultRange);
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = useCallback(async () => {
    // Get the logged-in user's staff ID
    const staffId = user?.roleContext?.staffData?.id;
    
    if (!user || !tenantId || !staffId) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    const rangeKey = `${range.fromISO}-${range.toISO}`;
    
    // Prevent duplicate fetches
    if (rangeKey === lastFetchRangeRef.current || isFetchingRef.current) {
      return;
    }
    
    lastFetchRangeRef.current = rangeKey;
    isFetchingRef.current = true;

    try {
      setLoading(true);

      // Query the appointments table with correct columns
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          series_id,
          client_id,
          staff_id,
          service_id,
          start_at,
          end_at,
          status,
          is_telehealth,
          location_name,
          time_zone,
          created_at,
          updated_at,
          tenant_id,
          clients!inner(pat_name_f, pat_name_l, pat_name_m, pat_name_preferred),
          services!inner(id, name),
          staff!inner(prov_name_f, prov_name_l, prov_name_for_clients)
        `)
        .eq('tenant_id', tenantId)
        .eq('staff_id', staffId)
        .gte('start_at', range.fromISO)
        .lt('start_at', range.toISO)
        .order('start_at', { ascending: true });

      if (error) {
        console.error('Error fetching calendar appointments:', error);
        toast({
          variant: 'destructive',
          title: 'Error loading calendar',
          description: error.message,
        });
        setAppointments([]);
        return;
      }

      // Transform to display format
      // Convert UTC timestamps from database to viewer's local timezone
      // This ensures appointments display at the correct local time regardless of viewer's timezone
      const transformed: CalendarAppointment[] = (data || []).map((row: any) => {
        // utcToLocal: Database UTC → Viewer's local Date object
        // These Date objects are ready for React Big Calendar
        const localStart = utcToLocal(row.start_at);
        const localEnd = utcToLocal(row.end_at);

        // Build client name
        const clientName = row.clients?.pat_name_preferred || 
          [row.clients?.pat_name_f, row.clients?.pat_name_m, row.clients?.pat_name_l]
            .filter(Boolean).join(' ').trim() || 'Unknown Client';

        // Build clinician name - prioritize prov_name_for_clients
        const clinicianName = row.staff?.prov_name_for_clients ||
          [row.staff?.prov_name_f, row.staff?.prov_name_l]
            .filter(Boolean).join(' ').trim() || 'Unassigned';

        return {
          id: row.id,
          series_id: row.series_id,
          client_id: row.client_id,
          client_name: clientName,
          staff_id: row.staff_id,
          clinician_name: clinicianName,
          service_id: row.service_id,
          service_name: row.services?.name || 'Unknown Service',
          start_at: row.start_at,   // Original UTC for reference
          end_at: row.end_at,       // Original UTC for reference
          status: row.status,
          is_telehealth: row.is_telehealth,
          location_name: row.location_name,
          time_zone: row.time_zone, // Creator's timezone (metadata only)
          created_at: row.created_at,
          updated_at: row.updated_at,
          tenant_id: row.tenant_id,
          local_start: localStart,  // For calendar display
          local_end: localEnd,      // For calendar display
        };
      });

      setAppointments(transformed);
    } catch (err: any) {
      console.error('Error in fetchAppointments:', err);
      toast({
        variant: 'destructive',
        title: 'Error loading calendar',
        description: err.message ?? String(err),
      });
      setAppointments([]);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user, tenantId, range.fromISO, range.toISO, toast]);

  // Manual refetch function
  const refetch = useCallback(() => {
    lastFetchRangeRef.current = ''; // Force refetch
    isFetchingRef.current = false;
    return fetchAppointments();
  }, [fetchAppointments]);

  // Update appointment
  const updateAppointment = useCallback(
    async (appointmentId: string, updates: Partial<CalendarAppointment>) => {
      if (!user || !tenantId) throw new Error('User not authenticated');

      // Strip display-only fields
      const { local_start, local_end, client_name, clinician_name, service_name, ...dbUpdates } = updates;

      const { data, error } = await supabase
        .from('appointments')
        .update(dbUpdates)
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating appointment:', error);
        throw error;
      }

      toast({ title: 'Appointment updated', description: 'The appointment has been successfully updated.' });
      await refetch();
      return data;
    },
    [user, tenantId, toast, refetch]
  );

  // Delete appointment
  const deleteAppointment = useCallback(
    async (appointmentId: string) => {
      if (!user || !tenantId) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting appointment:', error);
        throw error;
      }

      toast({ title: 'Appointment deleted', description: 'The appointment has been successfully deleted.' });
      await refetch();
    },
    [user, tenantId, toast, refetch]
  );

  // Debounced range setter
  const setRangeDebounced = useCallback((newRange: CalendarRange) => {
    const newRangeKey = `${newRange.fromISO}-${newRange.toISO}`;
    const currentRangeKey = `${range.fromISO}-${range.toISO}`;
    
    if (newRangeKey === currentRangeKey) return;
    
    // Clear existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    setRange(newRange);
    
    // Debounce the fetch
    fetchTimeoutRef.current = setTimeout(() => {
      fetchAppointments();
    }, 300);
  }, [range.fromISO, range.toISO, fetchAppointments]);

  // Initial fetch
  useMemo(() => {
    if (user && tenantId && !isFetchingRef.current) {
      fetchAppointments();
    }
  }, [user, tenantId]);

  return {
    appointments,
    loading,
    refetch,
    updateAppointment,
    deleteAppointment,
    range,
    setRange: setRangeDebounced,
  };
}
