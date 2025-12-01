import { useAuth } from '@/hooks/useAuth';
import { usePermissionsData } from '@/hooks/permissions/usePermissionsData';
import { UserPermissions } from '@/utils/permissionUtils';

/**
 * Legacy usePermissions hook - maintained for backward compatibility
 * 
 * IMPORTANT: Permissions are now DERIVED from roles and are READ-ONLY.
 * To modify permissions, update user_roles or staff_role_assignments instead.
 * 
 * For new code, prefer using usePermissionsData or PermissionProvider
 */
export function usePermissions() {
  const { user } = useAuth();
  
  // Use the new role-based data layer hook
  const {
    data: permissions,
    loading,
    error,
    refetch,
  } = usePermissionsData();

  // Legacy method - now a no-op since permissions are derived
  const updatePermissions = async (_userId: string, _updates: Partial<UserPermissions>) => {
    console.warn('[usePermissions] updatePermissions is deprecated - permissions are now derived from roles');
    return null;
  };

  // Legacy method - now a no-op since permissions are derived
  const createPermissions = async (_userId: string, _tenantId: string, _newPermissions: UserPermissions) => {
    console.warn('[usePermissions] createPermissions is deprecated - permissions are now derived from roles');
    return null;
  };

  // Legacy method - now just refetches derived permissions
  const fetchPermissions = async (_userId?: string) => {
    refetch();
    return permissions;
  };

  return {
    permissions,
    loading,
    error,
    updatePermissions,
    createPermissions,
    refetchPermissions: fetchPermissions,
  };
}