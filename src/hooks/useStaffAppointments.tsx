import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { syncAppointmentToGoogle } from '@/lib/googleCalendarSync';
import { getTodayInTimezone, getDateFromFakeLocalDate, getFakeLocalNow, DEFAULT_TIMEZONE } from '@/lib/timezoneUtils';

/**
 * Staff appointment with all timezone data resolved server-side.
 * Includes both raw UTC data (for database operations) and display-ready data.
 */
export interface StaffAppointment {
  // Core identifiers
  id: string;
  tenant_id: string;
  series_id: string | null;
  client_id: string;
  staff_id: string;
  service_id: string;
  
  // Raw UTC timestamps (for database operations)
  start_at: string;
  end_at: string;
  
  // Appointment data
  status: 'scheduled' | 'documented' | 'cancelled' | 'late_cancel/noshow';
  is_telehealth: boolean;
  location_name: string | null;
  time_zone: string; // Creator's timezone (metadata only)
  created_at: string;
  updated_at: string;
  documented_at: string | null; // Immutable timestamp set when status transitions to 'documented'
  videoroom_url: string | null; // Daily.co video room URL for telehealth
  
  // Joined data
  client_name: string;           // Preferred name (for calendar/dashboard)
  client_legal_name: string;     // First + Last name (for clinical documentation)
  service_name: string;
  clinician_name: string;
  
  // Pre-formatted display strings (from server, in staff's timezone)
  display_date: string;
  display_time: string;
  display_end_time: string;
  display_timezone: string;
  
  // Server-resolved time components (from RPC, for edit form prepopulation)
  start_year: number;
  start_month: number;
  start_day: number;
  start_hour: number;
  start_minute: number;
  
  // "Fake local" Date objects for react-big-calendar grid positioning
  // These are Date objects where getHours() returns the staff's local hour
  calendar_start: Date;
  calendar_end: Date;
}

type DateRange = { fromISO: string; toISO: string };

function defaultRange(lookbackDays = 7, forwardDays = 90): DateRange {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - lookbackDays);
  const to = new Date(now);
  to.setDate(to.getDate() + forwardDays);
  return { fromISO: from.toISOString(), toISO: to.toISOString() };
}

/**
 * Creates a "fake local" Date object that tricks react-big-calendar into correct positioning.
 * The resulting Date's getHours() will return the staff's local hour, regardless of browser TZ.
 */
function createFakeLocalDate(
  year: number,
  month: number, // 1-12 from PostgreSQL
  day: number,
  hour: number,
  minute: number
): Date {
  const d = new Date();
  d.setFullYear(year, month - 1, day); // JS months are 0-indexed
  d.setHours(hour, minute, 0, 0);
  return d;
}

export interface UseStaffAppointmentsOptions {
  enabled?: boolean;
  range?: DateRange;
  lookbackDays?: number;
  forwardDays?: number;
  /** For admin multi-clinician view: array of staff IDs to fetch appointments for */
  staffIds?: string[];
}

/**
 * Unified hook for fetching staff appointments with server-side timezone handling.
 * 
 * Uses the get_staff_calendar_appointments RPC which:
 * 1. Looks up staff.prov_time_zone server-side (no race conditions)
 * 2. Returns pre-formatted display strings in the staff's timezone
 * 3. Returns time components (year, month, day, hour, minute) for calendar positioning
 * 
 * This hook is the single source of truth for all appointment data across:
 * - /staff/calendar (RBCCalendar)
 * - /staff/dashboard (Index.tsx)
 * - /staff/appointments (Appointments.tsx)
 */
export function useStaffAppointments(options?: UseStaffAppointmentsOptions) {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const { enabled = true, lookbackDays = 7, forwardDays = 90, staffIds } = options || {};
  
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRangeRef = useRef<string>('');
  const isFetchingRef = useRef(false);

  const [range, setRangeState] = useState<DateRange>(options?.range || defaultRange(lookbackDays, forwardDays));
  const [appointments, setAppointments] = useState<StaffAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffTimezone, setStaffTimezone] = useState<string>('');

  const fetchAppointments = useCallback(async () => {
    const loggedInStaffId = user?.roleContext?.staffData?.id;
    
    // Determine which staff IDs to fetch
    // If staffIds provided and non-empty, use those; otherwise use logged-in user's staff ID
    const idsToFetch = staffIds && staffIds.length > 0 ? staffIds : (loggedInStaffId ? [loggedInStaffId] : []);
    
    if (!user || !tenantId || idsToFetch.length === 0 || !enabled) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    const rangeKey = `${range.fromISO}-${range.toISO}-${idsToFetch.sort().join(',')}`;
    
    // Prevent duplicate fetches
    if (rangeKey === lastFetchRangeRef.current || isFetchingRef.current) {
      return;
    }
    
    lastFetchRangeRef.current = rangeKey;
    isFetchingRef.current = true;

    try {
      setLoading(true);

      // Fetch appointments for all staff IDs in parallel
      const results = await Promise.all(
        idsToFetch.map(id => 
          supabase.rpc('get_staff_calendar_appointments', {
            p_staff_id: id,
            p_from_date: range.fromISO,
            p_to_date: range.toISO
          })
        )
      );

      // Check for errors in any of the results
      const firstError = results.find(r => r.error);
      if (firstError?.error) {
        console.error('[useStaffAppointments] Error fetching appointments:', firstError.error);
        toast({
          variant: 'destructive',
          title: 'Error loading appointments',
          description: firstError.error.message,
        });
        setAppointments([]);
        return;
      }

      // Merge all results and dedupe by appointment ID
      const allData = results.flatMap(r => r.data || []);
      const uniqueById = new Map<string, any>();
      allData.forEach(row => uniqueById.set(row.id, row));
      const data = Array.from(uniqueById.values());

      // Transform to StaffAppointment with fake local Dates
      const transformed: StaffAppointment[] = (data || []).map((row: any) => {
        // Create "fake local" Date objects using server-provided time components
        // These Dates will have getHours() return the staff's local hour
        const calendar_start = createFakeLocalDate(
          row.start_year,
          row.start_month,
          row.start_day,
          row.start_hour,
          row.start_minute
        );
        
        // For end time, use same date but with end hour/minute
        const calendar_end = createFakeLocalDate(
          row.start_year,
          row.start_month,
          row.start_day,
          row.end_hour,
          row.end_minute
        );

        return {
          id: row.id,
          tenant_id: row.tenant_id,
          series_id: row.series_id,
          client_id: row.client_id,
          staff_id: row.staff_id,
          service_id: row.service_id,
          start_at: row.start_at,
          end_at: row.end_at,
          status: row.status as 'scheduled' | 'documented' | 'cancelled' | 'late_cancel/noshow',
          is_telehealth: row.is_telehealth,
          location_name: row.location_name,
          time_zone: row.time_zone,
          created_at: row.created_at,
          updated_at: row.updated_at,
          documented_at: row.documented_at || null,
          videoroom_url: row.videoroom_url || null,
          client_name: row.client_name || 'Unknown Client',
          client_legal_name: row.client_legal_name || 'Unknown Client',
          service_name: row.service_name || 'Unknown Service',
          clinician_name: row.clinician_name || 'Unassigned',
          display_date: row.display_date,
          display_time: row.display_time,
          display_end_time: row.display_end_time,
          display_timezone: row.display_timezone,
          start_year: row.start_year,
          start_month: row.start_month,
          start_day: row.start_day,
          start_hour: row.start_hour,
          start_minute: row.start_minute,
          calendar_start,
          calendar_end,
        };
      });

      // Store staff timezone from first result
      if (transformed.length > 0) {
        setStaffTimezone(transformed[0].display_timezone);
      }

      console.log('[useStaffAppointments] Loaded:', {
        count: transformed.length,
        staffTimezone: transformed[0]?.display_timezone || 'none',
        firstAppt: transformed[0] ? {
          display_time: transformed[0].display_time,
          calendar_start_hour: transformed[0].calendar_start.getHours(),
        } : null,
      });

      setAppointments(transformed);
    } catch (err: any) {
      console.error('[useStaffAppointments] Error:', err);
      toast({
        variant: 'destructive',
        title: 'Error loading appointments',
        description: err.message ?? String(err),
      });
      setAppointments([]);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user, tenantId, range.fromISO, range.toISO, enabled, toast, staffIds]);

  // Manual refetch function
  const refetch = useCallback(() => {
    lastFetchRangeRef.current = '';
    isFetchingRef.current = false;
    return fetchAppointments();
  }, [fetchAppointments]);

  // Update appointment
  const updateAppointment = useCallback(
    async (appointmentId: string, updates: Partial<StaffAppointment>) => {
      if (!user || !tenantId) throw new Error('User not authenticated');

      // Strip display-only and computed fields
      const { 
        client_name, client_legal_name, clinician_name, service_name,
        display_date, display_time, display_end_time, display_timezone,
        start_year, start_month, start_day, start_hour, start_minute,
        calendar_start, calendar_end, videoroom_url,
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
        console.error('[useStaffAppointments] Error updating:', error);
        throw error;
      }

      // Fire-and-forget Google Calendar sync
      syncAppointmentToGoogle(appointmentId, 'update');

      toast({ title: 'Appointment updated' });
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
        console.error('[useStaffAppointments] Error deleting:', error);
        throw error;
      }

      // Fire-and-forget Google Calendar sync
      syncAppointmentToGoogle(appointmentId, 'delete');

      toast({ title: 'Appointment deleted' });
      await refetch();
    },
    [user, tenantId, toast, refetch]
  );

  // Debounced range setter (for calendar navigation)
  const setRange = useCallback((newRange: DateRange) => {
    const newRangeKey = `${newRange.fromISO}-${newRange.toISO}`;
    const currentRangeKey = `${range.fromISO}-${range.toISO}`;
    
    if (newRangeKey === currentRangeKey) return;
    
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    setRangeState(newRange);
    
    fetchTimeoutRef.current = setTimeout(() => {
      fetchAppointments();
    }, 300);
  }, [range.fromISO, range.toISO, fetchAppointments]);

  // Initial fetch
  useEffect(() => {
    if (user && tenantId && user?.roleContext?.staffData?.id && enabled && !isFetchingRef.current) {
      fetchAppointments();
    }
  }, [user, tenantId, user?.roleContext?.staffData?.id, enabled, fetchAppointments]);

  // Derived data for dashboard - extract timezone directly from appointments to eliminate race condition
  const todaysAppointments = useMemo(() => {
    // Use timezone from appointment data (set by database RPC) to avoid race condition with staffTimezone state
    const tz = appointments[0]?.display_timezone || DEFAULT_TIMEZONE;
    const today = getTodayInTimezone(tz); // Returns "YYYY-MM-DD"
    
    const filtered = appointments.filter(appt => {
      // Extract date from fake local Date in same YYYY-MM-DD format
      const apptDate = getDateFromFakeLocalDate(appt.calendar_start);
      return apptDate === today && (appt.status === 'scheduled' || appt.status === 'documented');
    });
    
    console.log('[useStaffAppointments] Today calculation:', {
      extractedTimezone: appointments[0]?.display_timezone,
      effectiveTimezone: tz,
      todayInTz: today,
      appointmentCount: appointments.length,
      matchingCount: filtered.length,
      firstApptDate: appointments[0] ? getDateFromFakeLocalDate(appointments[0].calendar_start) : 'none',
    });
    
    return filtered;
  }, [appointments]);

  const upcomingAppointments = useMemo(() => {
    const tz = appointments[0]?.display_timezone || DEFAULT_TIMEZONE;
    const nowInTz = getFakeLocalNow(tz);
    // Set to end of today in staff's timezone
    nowInTz.setHours(23, 59, 59, 999);
    
    return appointments
      .filter(appt => appt.calendar_start > nowInTz && appt.status === 'scheduled')
      .slice(0, 5);
  }, [appointments]);

  const undocumentedAppointments = useMemo(() => {
    const tz = appointments[0]?.display_timezone || DEFAULT_TIMEZONE;
    const nowInTz = getFakeLocalNow(tz);
    
    return appointments.filter(appt => {
      return appt.calendar_start <= nowInTz && appt.status === 'scheduled';
    });
  }, [appointments]);

  // Memoized Map for O(1) appointment lookup by ID
  const appointmentsById = useMemo(() => {
    const map = new Map<string, StaffAppointment>();
    appointments.forEach(apt => map.set(apt.id, apt));
    return map;
  }, [appointments]);

  // Helper to get a single appointment by ID
  const getAppointmentById = useCallback((id: string): StaffAppointment | undefined => {
    return appointmentsById.get(id);
  }, [appointmentsById]);

  return {
    // Data
    appointments,
    appointmentsById,
    getAppointmentById,
    todaysAppointments,
    upcomingAppointments,
    undocumentedAppointments,
    staffTimezone,
    
    // Loading states
    loading,
    
    // Actions
    refetch,
    updateAppointment,
    deleteAppointment,
    
    // Range management (for calendar)
    range,
    setRange,
  };
}
