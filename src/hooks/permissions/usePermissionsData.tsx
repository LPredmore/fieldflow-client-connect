import { useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';
import { UserPermissions, derivePermissionsFromRoles, getDefaultPermissions, StaffRoleAssignment } from '@/utils/permissionUtils';

interface UserRoleRecord {
  role: 'admin' | 'staff';
}

interface StaffRoleAssignmentRecord {
  staff_roles: {
    role_name: string;
  };
}

interface UsePermissionsDataOptions {
  userId?: string;
  enabled?: boolean;
}

/**
 * Derive user permissions from user_roles and staff_role_assignments tables
 * 
 * This hook queries the actual database tables and derives permissions based on:
 * - user_roles.role ('admin' or 'staff')
 * - staff_role_assignments joined with staff_roles (CLINICIAN, BILLING, etc.)
 */
export function usePermissionsData(options: UsePermissionsDataOptions = {}) {
  const { user, userRole, tenantId } = useAuth();
  const targetUserId = options.userId || user?.id;
  
  // Query user's app role from user_roles table
  const {
    data: userRolesArray,
    loading: rolesLoading,
    error: rolesError,
    refetch: refetchRoles,
  } = useSupabaseQuery<UserRoleRecord>({
    table: 'user_roles',
    select: 'role',
    filters: {
      user_id: targetUserId,
    },
    enabled: options.enabled !== false && !!targetUserId,
    staleTime: 300000, // Cache for 5 minutes
  });

  // Query staff role assignments (CLINICIAN, BILLING, etc.)
  const {
    data: staffAssignmentsArray,
    loading: assignmentsLoading,
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useSupabaseQuery<StaffRoleAssignmentRecord>({
    table: 'staff_role_assignments',
    select: 'staff_roles(role_name)',
    filters: {
      profile_id: targetUserId,
    },
    enabled: options.enabled !== false && !!targetUserId,
    staleTime: 300000,
  });

  // Derive permissions from roles
  const permissions = useMemo(() => {
    const loading = rolesLoading || assignmentsLoading;
    
    console.log('[usePermissionsData] Computing permissions:', {
      loading,
      targetUserId,
      userRolesArray,
      staffAssignmentsArray,
      userRole
    });
    
    // While loading, return null to prevent premature checks
    if (loading) {
      console.log('[usePermissionsData] Still loading, returning null');
      return null;
    }
    
    // Get app role (admin or staff)
    const appRole = userRolesArray?.[0]?.role || null;
    
    // Get staff role assignments
    const staffRoles: StaffRoleAssignment[] = staffAssignmentsArray?.map(assignment => ({
      role_name: assignment.staff_roles?.role_name || ''
    })) || [];
    
    // Derive permissions from roles
    const derived = derivePermissionsFromRoles(appRole, staffRoles);
    
    console.log('[usePermissionsData] Derived permissions:', {
      appRole,
      staffRoles: staffRoles.map(r => r.role_name),
      derived
    });
    
    return derived;
  }, [userRolesArray, staffAssignmentsArray, rolesLoading, assignmentsLoading, targetUserId, userRole]);

  // Refetch all role data
  const refetch = () => {
    refetchRoles();
    refetchAssignments();
  };

  return {
    data: permissions,
    loading: rolesLoading || assignmentsLoading,
    error: rolesError || assignmentsError,
    mutating: false, // No mutations - permissions are derived
    refetch,
    hasCustomPermissions: (staffAssignmentsArray?.length || 0) > 0,
  };
}