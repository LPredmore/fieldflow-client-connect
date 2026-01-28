export interface UserPermissions {
  access_appointments: boolean;
  access_services: boolean;
  access_invoicing: boolean;
  access_forms: boolean;
  supervisor: boolean;
}

export interface StaffRoleAssignment {
  role_name: string;
}

export const hasPermission = (permissions: UserPermissions | null, permissionName: keyof UserPermissions): boolean => {
  if (!permissions) return false;
  return permissions[permissionName] === true;
};

export const canAccessAppointments = (permissions: UserPermissions | null): boolean => {
  return hasPermission(permissions, 'access_appointments');
};

export const canAccessServices = (permissions: UserPermissions | null): boolean => {
  return hasPermission(permissions, 'access_services');
};

export const canAccessInvoicing = (permissions: UserPermissions | null): boolean => {
  return hasPermission(permissions, 'access_invoicing');
};

export const canAccessForms = (permissions: UserPermissions | null): boolean => {
  return hasPermission(permissions, 'access_forms');
};

export const canSupervise = (permissions: UserPermissions | null): boolean => {
  return hasPermission(permissions, 'supervisor');
};

/**
 * Derive permissions from user roles and staff role assignments
 * 
 * Role hierarchy:
 * - 'admin' in user_roles → Full access to everything
 * - Staff role assignments:
 *   - ACCOUNT_OWNER → Full access
 *   - BILLING → access_invoicing, access_services
 *   - CLINICIAN → access_appointments, access_forms, access_services
 *   - SUPERVISOR → supervisor + all clinician permissions
 */
export const derivePermissionsFromRoles = (
  appRole: 'admin' | 'staff' | null,
  staffRoles: StaffRoleAssignment[]
): UserPermissions => {
  // Admin role gets full access
  if (appRole === 'admin') {
    return {
      access_appointments: true,
      access_services: true,
      access_invoicing: true,
      access_forms: true,
      supervisor: true,
    };
  }

  // Start with no permissions
  const permissions: UserPermissions = {
    access_appointments: false,
    access_services: false,
    access_invoicing: false,
    access_forms: false,
    supervisor: false,
  };

  // Derive from staff role assignments
  staffRoles.forEach(assignment => {
    const roleName = assignment.role_name?.toUpperCase();
    
    switch (roleName) {
      case 'ACCOUNT_OWNER':
        // Full access
        permissions.access_appointments = true;
        permissions.access_services = true;
        permissions.access_invoicing = true;
        permissions.access_forms = true;
        permissions.supervisor = true;
        break;
      
      case 'BILLING':
        permissions.access_invoicing = true;
        permissions.access_services = true;
        break;
      
      case 'CLINICIAN':
        permissions.access_appointments = true;
        permissions.access_forms = true;
        permissions.access_services = true;
        break;
      
      case 'SUPERVISOR':
        permissions.supervisor = true;
        permissions.access_appointments = true;
        permissions.access_forms = true;
        permissions.access_services = true;
        break;
    }
  });

  return permissions;
};

// Default permissions for fallback scenarios
export const getDefaultPermissions = (role: 'admin' | 'staff' | 'client' | null): UserPermissions => {
  // Admin gets full access
  if (role === 'admin') {
    return {
      access_appointments: true,
      access_services: true,
      access_invoicing: true,
      access_forms: true,
      supervisor: true,
    };
  }
  
  // All others get no permissions by default
  return {
    access_appointments: false,
    access_services: false,
    access_invoicing: false,
    access_forms: false,
    supervisor: false,
  };
};

/**
 * Check if user has any of the specified staff roles
 */
export const hasStaffRole = (
  staffRoleCodes: string[] | undefined, 
  requiredRoles: string[]
): boolean => {
  if (!staffRoleCodes || staffRoleCodes.length === 0) return false;
  return requiredRoles.some(role => 
    staffRoleCodes.includes(role.toUpperCase())
  );
};

/**
 * Check if user has ADMIN or ACCOUNT_OWNER staff role
 */
export const isAdminOrAccountOwner = (staffRoleCodes: string[] | undefined): boolean => {
  return hasStaffRole(staffRoleCodes, ['ADMIN', 'ACCOUNT_OWNER']);
};