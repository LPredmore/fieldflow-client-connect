import { useMemo, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserTimezone } from './useUserTimezone';
import { TIME_FORMATS } from './useFormattedTime';

/**
 * Appointment with database-formatted display strings
 */
export interface FormattedAppointment {
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
  location_id: string | null;
  location_name: string | null;
  created_by_profile_id: string;
  created_at: string;
  updated_at: string;
  // Joined data
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  service_name?: string;
  clinician_name?: string;
  // Database-formatted display strings
  display_date: string;
  display_time: string;
  display_end_time: string;
  display_timezone: string;
}

interface FormatResult {
  id: string;
  display_date: string;
  display_time: string;
  display_end_time: string;
}

// Cache for formatted appointment times
const appointmentFormatCache = new Map<string, FormatResult>();

/**
 * Hook to add database-formatted display strings to appointment data.
 * Takes raw appointment data and enhances it with pre-formatted date/time strings.
 * 
 * @param appointments - Array of raw appointment data
 * @param enabled - Whether to fetch formatted strings
 * @returns Enhanced appointments with display_date, display_time, display_end_time
 */
export function useFormattedAppointments<T extends { 
  id: string; 
  start_at: string; 
  end_at: string;
}>(
  appointments: T[],
  enabled: boolean = true
): {
  formattedAppointments: (T & {
    display_date: string;
    display_time: string;
    display_end_time: string;
    display_timezone: string;
  })[];
  isFormatting: boolean;
} {
  const browserTimezone = useUserTimezone();
  const [formatResults, setFormatResults] = useState<Map<string, FormatResult>>(new Map());
  const [isFormatting, setIsFormatting] = useState(false);

  // Identify which appointments need formatting
  const appointmentsToFormat = useMemo(() => {
    if (!enabled || appointments.length === 0) return [];
    
    return appointments.filter(appt => {
      const cacheKey = `${appt.id}|${appt.start_at}|${appt.end_at}|${browserTimezone}`;
      return !appointmentFormatCache.has(cacheKey);
    });
  }, [appointments, enabled, browserTimezone]);

  // Fetch formatted strings from database
  useEffect(() => {
    if (!enabled || appointmentsToFormat.length === 0) return;

    let cancelled = false;
    setIsFormatting(true);

    const fetchFormattedTimes = async () => {
      try {
        // Build batch RPC calls for all appointments needing formatting
        const formatPromises = appointmentsToFormat.flatMap(appt => [
          supabase.rpc('format_timestamp_in_timezone', {
            p_timestamp: appt.start_at,
            p_timezone: browserTimezone,
            p_format: TIME_FORMATS.DATE_FULL,
          }),
          supabase.rpc('format_timestamp_in_timezone', {
            p_timestamp: appt.start_at,
            p_timezone: browserTimezone,
            p_format: TIME_FORMATS.TIME_12H_COMPACT,
          }),
          supabase.rpc('format_timestamp_in_timezone', {
            p_timestamp: appt.end_at,
            p_timezone: browserTimezone,
            p_format: TIME_FORMATS.TIME_12H_COMPACT,
          }),
        ]);

        const results = await Promise.all(formatPromises);
        
        if (cancelled) return;

        // Process results in groups of 3 (date, start_time, end_time)
        const newResults = new Map<string, FormatResult>();
        
        appointmentsToFormat.forEach((appt, index) => {
          const baseIndex = index * 3;
          const cacheKey = `${appt.id}|${appt.start_at}|${appt.end_at}|${browserTimezone}`;
          
          const formatResult: FormatResult = {
            id: appt.id,
            display_date: results[baseIndex]?.data || '',
            display_time: results[baseIndex + 1]?.data || '',
            display_end_time: results[baseIndex + 2]?.data || '',
          };
          
          appointmentFormatCache.set(cacheKey, formatResult);
          newResults.set(appt.id, formatResult);
        });

        setFormatResults(prev => {
          const updated = new Map(prev);
          newResults.forEach((value, key) => updated.set(key, value));
          return updated;
        });
      } catch (error) {
        console.error('Error formatting appointment times:', error);
      } finally {
        if (!cancelled) {
          setIsFormatting(false);
        }
      }
    };

    fetchFormattedTimes();

    return () => {
      cancelled = true;
    };
  }, [appointmentsToFormat, browserTimezone, enabled]);

  // Combine appointments with formatted strings
  const formattedAppointments = useMemo(() => {
    return appointments.map(appt => {
      const cacheKey = `${appt.id}|${appt.start_at}|${appt.end_at}|${browserTimezone}`;
      const cached = appointmentFormatCache.get(cacheKey);
      const result = formatResults.get(appt.id);
      const formatData = cached || result;

      return {
        ...appt,
        display_date: formatData?.display_date || '',
        display_time: formatData?.display_time || '',
        display_end_time: formatData?.display_end_time || '',
        display_timezone: browserTimezone,
      };
    });
  }, [appointments, formatResults, browserTimezone]);

  return {
    formattedAppointments,
    isFormatting,
  };
}

/**
 * Clear the appointment format cache
 */
export function clearAppointmentFormatCache(): void {
  appointmentFormatCache.clear();
}
