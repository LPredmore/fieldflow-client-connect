import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQuery } from '@tanstack/react-query';

export interface TenantStaffMember {
  id: string;
  name: string;
  status: string;
}

/**
 * Fetches all staff members for the current tenant.
 * Used by admins to filter appointments by clinician.
 */
export function useTenantStaff() {
  const { tenantId, isAdmin } = useAuth();

  const { data: staffMembers, isLoading, error } = useQuery({
    queryKey: ['tenant-staff', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('staff')
        .select('id, prov_name_f, prov_name_l, prov_name_for_clients, prov_status')
        .eq('tenant_id', tenantId)
        .in('prov_status', ['Active', 'New']);

      if (error) {
        console.error('[useTenantStaff] Error fetching staff:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!tenantId && isAdmin,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Transform to display-friendly format
  const tenantStaff: TenantStaffMember[] = useMemo(() => {
    if (!staffMembers) return [];

    return staffMembers.map((staff) => {
      // Prefer display name, fallback to first + last
      const displayName = staff.prov_name_for_clients?.trim() ||
        [staff.prov_name_f, staff.prov_name_l].filter(Boolean).join(' ') ||
        'Unknown Staff';

      return {
        id: staff.id,
        name: displayName,
        status: staff.prov_status || 'Unknown',
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [staffMembers]);

  return {
    tenantStaff,
    loading: isLoading,
    error,
  };
}
