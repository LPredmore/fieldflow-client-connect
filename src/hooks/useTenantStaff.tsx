import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQuery } from '@tanstack/react-query';

export interface TenantStaffMember {
  id: string;
  name: string;
  status: string;
}

interface UseTenantStaffOptions {
  /** Include inactive staff members (default: false) */
  includeInactive?: boolean;
}

/**
 * Fetches all staff members for the current tenant.
 * Used by admins to filter appointments by clinician.
 * 
 * @param options.includeInactive - If true, includes staff with any status (for historical data)
 */
export function useTenantStaff(options: UseTenantStaffOptions = {}) {
  const { tenantId, isAdmin } = useAuth();
  const { includeInactive = false } = options;

  const { data: staffMembers, isLoading, error } = useQuery({
    queryKey: ['tenant-staff', tenantId, includeInactive],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('staff')
        .select('id, prov_name_f, prov_name_l, prov_name_for_clients, prov_status')
        .eq('tenant_id', tenantId);

      // Only filter by status if not including inactive
      if (!includeInactive) {
        query = query.in('prov_status', ['Active', 'New']);
      }

      const { data, error } = await query;

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
