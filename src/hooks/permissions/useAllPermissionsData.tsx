import { useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';
import { UserPermissions, derivePermissionsFromRoles, StaffRoleAssignment } from '@/utils/permissionUtils';

interface StaffWithRoles {
  profile_id: string;
  staff_role_assignments: Array<{
    staff_roles: { code: string };
  }>;
}

interface UserRoleRecord {
  user_id: string;
  role: 'admin' | 'staff';
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
  
  // Query all user_roles for users in this tenant
  const {
    data: userRolesArray,
    loading: rolesLoading,
    error: rolesError,
  } = useSupabaseQuery<UserRoleRecord>({
    table: 'user_roles',
    select: 'user_id, role',
    enabled: options.enabled !== false && !!tenantId,
  });

  // Query all staff with their role assignments for this tenant
  const {
    data: staffWithRoles,
    loading: staffLoading,
    error: staffError,
    refetch,
  } = useSupabaseQuery<StaffWithRoles>({
    table: 'staff',
    select: 'profile_id, staff_role_assignments(staff_roles(code))',
    filters: {
      tenant_id: tenantId,
    },
    enabled: options.enabled !== false && !!tenantId,
  });

  // Derive permissions for each user
  const permissionsMap = useMemo(() => {
    if (!userRolesArray || !staffWithRoles) return new Map<string, UserPermissions>();
    
    const map = new Map<string, UserPermissions>();
    
    // Build a map of profile_id to staff roles
    const staffRolesMap = new Map<string, StaffRoleAssignment[]>();
    staffWithRoles.forEach(staff => {
      const roles: StaffRoleAssignment[] = staff.staff_role_assignments?.map(assignment => ({
        role_name: assignment.staff_roles?.code || ''
      })) || [];
      staffRolesMap.set(staff.profile_id, roles);
    });
    
    // Derive permissions for each user
    userRolesArray.forEach(userRole => {
      const staffRoles = staffRolesMap.get(userRole.user_id) || [];
      const permissions = derivePermissionsFromRoles(userRole.role, staffRoles);
      map.set(userRole.user_id, permissions);
    });
    
    return map;
  }, [userRolesArray, staffWithRoles]);

  // Helper to get permissions for a specific user
  const getPermissionsForUser = (userId: string): UserPermissions | null => {
    return permissionsMap.get(userId) || null;
  };

  return {
    data: Array.from(permissionsMap.entries()).map(([userId, permissions]) => ({
      user_id: userId,
      ...permissions,
    })),
    loading: rolesLoading || staffLoading,
    error: rolesError || staffError,
    getPermissionsForUser,
    refetch,
  };
}