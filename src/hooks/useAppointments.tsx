import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Simple appointment interface matching the appointments table
 */
export interface Appointment {
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
  client_name?: string;
  service_name?: string;
}

/**
 * Minimal hook for fetching appointments from the database.
 * No complex timezone conversions - just raw data.
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

      // Transform to include client/service names
      const transformed: Appointment[] = (data || []).map((row: any) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        client_id: row.client_id,
        staff_id: row.staff_id,
        service_id: row.service_id,
        series_id: row.series_id,
        start_at: row.start_at,
        end_at: row.end_at,
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

  // Get upcoming appointments
  const upcomingAppointments = appointments
    .filter(a => a.status === 'scheduled' && new Date(a.start_at) >= new Date())
    .slice(0, 5);

  return {
    appointments,
    upcomingAppointments,
    loading,
    error,
    refetch: fetchAppointments,
  };
}
