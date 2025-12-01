import { useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';
import { UserPermissions, derivePermissionsFromRoles, StaffRoleAssignment } from '@/utils/permissionUtils';

interface ProfileWithRoles {
  id: string;
  user_roles: Array<{ role: 'admin' | 'staff' }>;
  staff_role_assignments: Array<{
    staff_roles: { role_name: string };
  }>;
}

interface UseAllPermissionsDataOptions {
  enabled?: boolean;
}

/**
 * Derive permissions for all users in the current tenant
 * 
 * Queries profiles with their roles and derives permissions for each user
 */
export function useAllPermissionsData(options: UseAllPermissionsDataOptions = {}) {
  const { tenantId } = useAuth();
  
  // Query all profiles in tenant with their roles
  const {
    data: profilesWithRoles,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<ProfileWithRoles>({
    table: 'profiles',
    select: `
      id,
      user_roles!inner(role),
      staff_role_assignments(staff_roles(role_name))
    `,
    filters: {
      'tenant_memberships.tenant_id': tenantId,
    },
    enabled: options.enabled !== false && !!tenantId,
  });

  // Derive permissions for each user
  const permissionsMap = useMemo(() => {
    if (!profilesWithRoles) return new Map<string, UserPermissions>();
    
    const map = new Map<string, UserPermissions>();
    
    profilesWithRoles.forEach(profile => {
      const appRole = profile.user_roles?.[0]?.role || null;
      const staffRoles: StaffRoleAssignment[] = profile.staff_role_assignments?.map(assignment => ({
        role_name: assignment.staff_roles?.role_name || ''
      })) || [];
      
      const permissions = derivePermissionsFromRoles(appRole, staffRoles);
      map.set(profile.id, permissions);
    });
    
    return map;
  }, [profilesWithRoles]);

  // Helper to get permissions for a specific user
  const getPermissionsForUser = (userId: string): UserPermissions | null => {
    return permissionsMap.get(userId) || null;
  };

  return {
    data: Array.from(permissionsMap.entries()).map(([userId, permissions]) => ({
      user_id: userId,
      ...permissions,
    })),
    loading,
    error,
    getPermissionsForUser,
    refetch,
  };
}