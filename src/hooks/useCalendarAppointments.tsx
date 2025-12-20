import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { utcToLocalForCalendar } from '@/lib/appointmentTimezone';
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
  // Derived fields for display (converted to staff's local timezone)
  local_start?: Date;
  local_end?: Date;
  // Pre-formatted display strings from server
  display_date?: string;
  display_time?: string;
  display_end_time?: string;
  display_timezone?: string;
}

type CalendarRange = { fromISO: string; toISO: string };

function defaultRange(): CalendarRange {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  const to = new Date(now);
  to.setDate(to.getDate() + 90);
  return { fromISO: from.toISOString(), toISO: to.toISOString() };
}

/**
 * Hook to fetch calendar appointments using server-side timezone conversion.
 * Uses the get_staff_calendar_appointments RPC function which looks up
 * prov_time_zone directly from the staff table, eliminating race conditions.
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

      // Call the RPC function - timezone is resolved server-side from staff.prov_time_zone
      const { data, error } = await supabase.rpc('get_staff_calendar_appointments', {
        p_staff_id: staffId,
        p_from_date: range.fromISO,
        p_to_date: range.toISO
      });

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
      // The RPC returns the display_timezone, so we use it for local Date conversion
      const transformed: CalendarAppointment[] = (data || []).map((row: any) => {
        // Use the server-provided timezone for Luxon conversion
        // This ensures consistency between display strings and Date objects
        const localStart = utcToLocalForCalendar(row.start_at, row.display_timezone);
        const localEnd = utcToLocalForCalendar(row.end_at, row.display_timezone);

        return {
          id: row.id,
          series_id: row.series_id,
          client_id: row.client_id,
          client_name: row.client_name || 'Unknown Client',
          staff_id: row.staff_id,
          clinician_name: row.clinician_name || 'Unassigned',
          service_id: row.service_id,
          service_name: row.service_name || 'Unknown Service',
          start_at: row.start_at,   // Original UTC for reference
          end_at: row.end_at,       // Original UTC for reference
          status: row.status as 'scheduled' | 'completed' | 'cancelled',
          is_telehealth: row.is_telehealth,
          location_name: row.location_name,
          time_zone: row.time_zone, // Creator's timezone (metadata only)
          created_at: row.created_at,
          updated_at: row.updated_at,
          tenant_id: row.tenant_id,
          local_start: localStart,  // For react-big-calendar
          local_end: localEnd,      // For react-big-calendar
          // Pre-formatted strings from server
          display_date: row.display_date,
          display_time: row.display_time,
          display_end_time: row.display_end_time,
          display_timezone: row.display_timezone,
        };
      });

      console.log('[useCalendarAppointments] Loaded appointments with server timezone:', {
        count: transformed.length,
        timezone: transformed[0]?.display_timezone || 'none'
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
      const { 
        local_start, local_end, client_name, clinician_name, service_name,
        display_date, display_time, display_end_time, display_timezone,
        ...dbUpdates 
      } = updates;

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

  // Initial fetch - no timezone dependency since RPC handles it server-side
  useEffect(() => {
    if (user && tenantId && user?.roleContext?.staffData?.id && !isFetchingRef.current) {
      fetchAppointments();
    }
  }, [user, tenantId, user?.roleContext?.staffData?.id, fetchAppointments]);

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
