import { useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { useFormattedAppointments } from './useFormattedAppointments';

/**
 * Appointment interface matching the actual `appointments` table schema
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
  display_date?: string;
  display_time?: string;
  display_end_time?: string;
  display_timezone?: string;
}

// Legacy alias for backward compatibility
export type UnifiedJob = Appointment;
export type UnifiedAppointment = Appointment;

export interface UseUnifiedAppointmentsOptions {
  enabled?: boolean;
}

/**
 * Hook for fetching and managing appointments from the `appointments` table
 * 
 * This is the primary hook for accessing appointment data throughout the application.
 * It queries the correct `appointments` table (not the non-existent `appointment_occurrences`)
 * and joins with `clients`, `services`, and `staff` tables for complete data.
 */
export function useUnifiedAppointments(options?: UseUnifiedAppointmentsOptions) {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const { enabled = true } = options || {};

  // Query appointments from the correct table
  const {
    data: appointments,
    loading,
    error,
    refetch,
    isStale,
    isCircuitBreakerOpen,
    lastUpdated,
    errorType,
  } = useSupabaseQuery<any>({
    table: 'appointments',
    select: `
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
      location_id,
      location_name,
      created_by_profile_id,
      created_at,
      updated_at,
      clients!inner(pat_name_f, pat_name_l, pat_name_m, pat_name_preferred, email, phone),
      services!inner(id, name),
      staff!inner(prov_name_f, prov_name_l, prov_name_for_clients)
    `,
    filters: {
      tenant_id: 'auto',
    },
    orderBy: { column: 'start_at', ascending: true },
    enabled: enabled && !!user && !!tenantId,
    onError: (error) => {
      console.error('Error loading appointments:', error);
      toast({
        variant: "destructive",
        title: "Error loading appointments",
        description: error.message,
      });
    },
  });

  // Transform raw data to Appointment interface
  const transformedAppointments = useMemo(() => {
    if (!appointments || !Array.isArray(appointments)) return [];

    return appointments.map((appt: any): Appointment => {
      // Build client name from parts
      const clientName = appt.clients?.pat_name_preferred || 
        [appt.clients?.pat_name_f, appt.clients?.pat_name_m, appt.clients?.pat_name_l]
          .filter(Boolean).join(' ').trim() || 'Unknown Client';

      // Use client-facing name with fallback to first/last name
      const clinicianName = appt.staff?.prov_name_for_clients ||
        [appt.staff?.prov_name_f, appt.staff?.prov_name_l]
          .filter(Boolean).join(' ').trim() || 'Unassigned';

      return {
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
        location_id: appt.location_id,
        location_name: appt.location_name,
        created_by_profile_id: appt.created_by_profile_id,
        created_at: appt.created_at,
        updated_at: appt.updated_at,
        client_name: clientName,
        client_email: appt.clients?.email,
        client_phone: appt.clients?.phone,
        service_name: appt.services?.name || 'Unknown Service',
        clinician_name: clinicianName,
      };
    });
  }, [appointments]);

  // Add database-formatted display strings to appointments
  const { formattedAppointments: unifiedAppointments, isFormatting } = useFormattedAppointments(
    transformedAppointments,
    enabled && !!user && !!tenantId
  );

  // Get upcoming scheduled appointments for dashboard
  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    
    return unifiedAppointments
      .filter(appt => appt.status === 'scheduled' && new Date(appt.start_at) >= now)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .slice(0, 5);
  }, [unifiedAppointments]);

  // Update an appointment
  const updateAppointment = useCallback(async (appointmentId: string, updates: Partial<Appointment>) => {
    if (!user || !tenantId) throw new Error('User not authenticated');

    // Remove joined fields that don't exist in the table
    const { client_name, client_email, client_phone, service_name, clinician_name, ...dbUpdates } = updates;

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

    await refetch();
    return data;
  }, [user, tenantId, toast, refetch]);

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

    await refetch();
  }, [user, tenantId, toast, refetch]);

  return {
    // Data
    appointments: unifiedAppointments,
    unifiedJobs: unifiedAppointments, // Legacy alias
    upcomingJobs: upcomingAppointments, // Legacy alias
    upcomingAppointments,
    
    // Loading states
    loading: loading || isFormatting,
    error,
    isStale,
    isCircuitBreakerOpen,
    lastUpdated,
    errorType,
    isFormatting,
    
    // Actions
    refetch,
    refetchJobs: refetch, // Legacy alias
    updateAppointment,
    updateJob: updateAppointment, // Legacy alias
    deleteAppointment,
    deleteJob: deleteAppointment, // Legacy alias
  };
}

// Legacy export alias
export const useUnifiedJobs = useUnifiedAppointments;
