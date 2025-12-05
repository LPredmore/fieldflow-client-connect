import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { utcToLocal } from '@/lib/appointmentTime';

/**
 * Raw appointment data from database (UTC timestamps)
 */
interface AppointmentRow {
  id: string;
  tenant_id: string;
  client_id: string;
  staff_id: string;
  service_id: string;
  series_id: string | null;
  start_at: string; // UTC timestamp
  end_at: string;   // UTC timestamp
  time_zone: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  is_telehealth: boolean;
  location_name: string | null;
  created_at: string;
  updated_at: string;
  clients?: {
    pat_name_f: string | null;
    pat_name_l: string | null;
    pat_name_m: string | null;
    pat_name_preferred: string | null;
  };
  services?: {
    id: string;
    name: string;
  };
}

/**
 * Appointment with local time JS Dates for calendar rendering
 */
export interface Appointment {
  id: string;
  tenant_id: string;
  client_id: string;
  staff_id: string;
  service_id: string;
  series_id: string | null;
  start_at: string;      // Original UTC string
  end_at: string;        // Original UTC string
  start_local: Date;     // Converted to local timezone
  end_local: Date;       // Converted to local timezone
  time_zone: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  is_telehealth: boolean;
  location_name: string | null;
  created_at: string;
  updated_at: string;
  client_name: string;
  service_name: string;
}

/**
 * Hook for fetching appointments from the database.
 * 
 * INVARIANT TIME MODEL:
 * - Database stores UTC (start_at, end_at as timestamptz)
 * - This hook converts UTC → local JS Dates for calendar display
 * - start_local and end_local are what react-big-calendar uses
 */
export function useAppointments() {
  const { user, tenantId } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAppointments = useCallback(async () => {
    if (!user || !tenantId) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
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
          services!inner(id, name)
        `)
        .eq('tenant_id', tenantId)
        .order('start_at', { ascending: true });

      if (queryError) {
        throw queryError;
      }

      // Transform: convert UTC → local for calendar display
      const transformed: Appointment[] = (data || []).map((row: any) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        client_id: row.client_id,
        staff_id: row.staff_id,
        service_id: row.service_id,
        series_id: row.series_id,
        start_at: row.start_at,
        end_at: row.end_at,
        // Convert UTC → local using Luxon
        start_local: utcToLocal(row.start_at),
        end_local: utcToLocal(row.end_at),
        time_zone: row.time_zone,
        status: row.status,
        is_telehealth: row.is_telehealth,
        location_name: row.location_name,
        created_at: row.created_at,
        updated_at: row.updated_at,
        client_name: row.clients?.pat_name_preferred || 
          [row.clients?.pat_name_f, row.clients?.pat_name_m, row.clients?.pat_name_l]
            .filter(Boolean).join(' ').trim() || 'Unknown Client',
        service_name: row.services?.name || 'Unknown Service',
      }));

      setAppointments(transformed);
    } catch (err: any) {
      console.error('Error fetching appointments:', err);
      setError(err);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [user, tenantId]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Get upcoming appointments (compare local times)
  const upcomingAppointments = appointments
    .filter(a => a.status === 'scheduled' && a.start_local >= new Date())
    .slice(0, 5);

  return {
    appointments,
    upcomingAppointments,
    loading,
    error,
    refetch: fetchAppointments,
  };
}
