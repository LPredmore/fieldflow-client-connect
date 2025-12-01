import { useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';
import { UserPermissions, derivePermissionsFromRoles, getDefaultPermissions, StaffRoleAssignment } from '@/utils/permissionUtils';

interface UserRoleRecord {
  role: 'admin' | 'staff';
}

interface StaffRecord {
  id: string;
}

interface StaffRoleAssignmentRecord {
  staff_roles: {
    code: string;
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

  // Step 1: Query staff table to get staff.id for this user's profile_id
  const {
    data: staffArray,
    loading: staffLoading,
    error: staffError,
  } = useSupabaseQuery<StaffRecord>({
    table: 'staff',
    select: 'id',
    filters: {
      profile_id: targetUserId,
    },
    enabled: options.enabled !== false && !!targetUserId,
    staleTime: 300000,
  });

  const staffId = staffArray?.[0]?.id;

  // Step 2: Query staff role assignments using staff_id
  const {
    data: staffAssignmentsArray,
    loading: assignmentsLoading,
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useSupabaseQuery<StaffRoleAssignmentRecord>({
    table: 'staff_role_assignments',
    select: 'staff_roles(code)',
    filters: {
      staff_id: staffId,
    },
    enabled: options.enabled !== false && !!staffId,
    staleTime: 300000,
  });

  // Derive permissions from roles
  const permissions = useMemo(() => {
    const loading = rolesLoading || staffLoading || assignmentsLoading;
    
    // While loading, return null to prevent premature checks
    if (loading) {
      return null;
    }
    
    // Get app role (admin or staff)
    const appRole = userRolesArray?.[0]?.role || null;
    
    // Get staff role assignments - map code to role_name for compatibility
    const staffRoles: StaffRoleAssignment[] = staffAssignmentsArray?.map(assignment => ({
      role_name: assignment.staff_roles?.code || ''
    })) || [];
    
    // Derive permissions from roles
    const derived = derivePermissionsFromRoles(appRole, staffRoles);
    
    return derived;
  }, [userRolesArray, staffAssignmentsArray, rolesLoading, staffLoading, assignmentsLoading, targetUserId, userRole]);

  // Refetch all role data
  const refetch = () => {
    refetchRoles();
    refetchAssignments();
  };

  return {
    data: permissions,
    loading: rolesLoading || staffLoading || assignmentsLoading,
    error: rolesError || staffError || assignmentsError,
    mutating: false, // No mutations - permissions are derived
    refetch,
    hasCustomPermissions: (staffAssignmentsArray?.length || 0) > 0,
  };
}