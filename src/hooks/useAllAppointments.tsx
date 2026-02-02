import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQuery } from '@tanstack/react-query';

export interface AllAppointment {
  id: string;
  tenant_id: string;
  client_id: string;
  staff_id: string;
  service_id: string;
  series_id: string | null;
  start_at: string;
  end_at: string;
  status: string;
  is_telehealth: boolean;
  location_name: string | null;
  videoroom_url: string | null;
  time_zone: string;
  created_at: string;
  updated_at: string;
  // Joined display fields
  client_name: string;
  client_legal_name: string;
  service_name: string;
  clinician_name: string;
  // Formatted for display
  display_date: string;
  display_time: string;
}

interface UseAllAppointmentsOptions {
  /** Filter by specific staff IDs (admin multi-select). If undefined/empty, shows all for admin or own for non-admin */
  staffIds?: string[];
  /** Filter appointments starting from this date */
  dateFrom?: string | null;
  /** Filter appointments up to this date */
  dateTo?: string | null;
  /** Enable/disable the query */
  enabled?: boolean;
}

/**
 * Fetches all appointments from the appointments table with client/service/staff joins.
 * Used by the Appointments list page for administrative/clinical purposes.
 * Unlike useStaffAppointments, this has no hardcoded date range restrictions.
 */
export function useAllAppointments(options: UseAllAppointmentsOptions = {}) {
  const { tenantId, isAdmin, user } = useAuth();
  const staffData = user?.staffAttributes?.staffData;
  const { staffIds, dateFrom, dateTo, enabled = true } = options;

  const { data: rawAppointments, isLoading, error, refetch } = useQuery({
    queryKey: ['all-appointments', tenantId, staffIds, dateFrom, dateTo, isAdmin, staffData?.id],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
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
          status,
          is_telehealth,
          location_name,
          videoroom_url,
          time_zone,
          created_at,
          updated_at,
          client:clients(pat_name_f, pat_name_l, pat_name_preferred),
          service:services(name),
          staff:staff(prov_name_f, prov_name_l, prov_name_for_clients)
        `)
        .eq('tenant_id', tenantId)
        .order('start_at', { ascending: false });

      // Apply staff filter
      if (isAdmin) {
        // Admin: filter by selected staffIds if provided, otherwise show all
        if (staffIds && staffIds.length > 0) {
          query = query.in('staff_id', staffIds);
        }
        // If no staffIds selected, show all appointments for tenant (no staff filter)
      } else {
        // Non-admin: only show their own appointments
        if (staffData?.id) {
          query = query.eq('staff_id', staffData.id);
        } else {
          // No staff record, return empty
          return [];
        }
      }

      // Apply date filters if provided
      if (dateFrom) {
        query = query.gte('start_at', dateFrom);
      }
      if (dateTo) {
        // Include the entire end date
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('start_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useAllAppointments] Error fetching appointments:', error);
        throw error;
      }

      return data || [];
    },
    enabled: enabled && !!tenantId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Transform to display-friendly format
  const appointments: AllAppointment[] = useMemo(() => {
    if (!rawAppointments) return [];

    return rawAppointments.map((row: any) => {
      // Build client name: prefer preferred name, fallback to first name
      const client = row.client;
      const preferredName = client?.pat_name_preferred?.trim();
      const firstName = client?.pat_name_f?.trim();
      const lastName = client?.pat_name_l?.trim();
      
      const clientDisplayName = preferredName || firstName || 'Unknown';
      const clientName = lastName 
        ? `${clientDisplayName} ${lastName}`
        : clientDisplayName;
      
      // Legal name: first + last only
      const clientLegalName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown Client';

      // Service name
      const serviceName = row.service?.name || 'Unknown Service';

      // Clinician name: prefer display name, then full name
      const staff = row.staff;
      const clinicianDisplayName = staff?.prov_name_for_clients?.trim();
      const clinicianFullName = [staff?.prov_name_f, staff?.prov_name_l].filter(Boolean).join(' ');
      const clinicianName = clinicianDisplayName || clinicianFullName || 'Unassigned';

      // Format dates for display (browser-local timezone is acceptable for list view)
      const startDate = new Date(row.start_at);
      const displayDate = startDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const displayTime = startDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      return {
        id: row.id,
        tenant_id: row.tenant_id,
        client_id: row.client_id,
        staff_id: row.staff_id,
        service_id: row.service_id,
        series_id: row.series_id,
        start_at: row.start_at,
        end_at: row.end_at,
        status: row.status,
        is_telehealth: row.is_telehealth,
        location_name: row.location_name,
        videoroom_url: row.videoroom_url,
        time_zone: row.time_zone,
        created_at: row.created_at,
        updated_at: row.updated_at,
        client_name: clientName,
        client_legal_name: clientLegalName,
        service_name: serviceName,
        clinician_name: clinicianName,
        display_date: displayDate,
        display_time: displayTime,
      };
    });
  }, [rawAppointments]);

  return {
    appointments,
    loading: isLoading,
    error,
    refetch,
  };
}
