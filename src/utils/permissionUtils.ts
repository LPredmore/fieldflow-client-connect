export interface UserPermissions {
  access_appointments: boolean;
  access_services: boolean;
  access_invoicing: boolean;
  access_forms: boolean;
  supervisor: boolean;
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

// Default permissions for fallback scenarios
export const getDefaultPermissions = (role: 'staff' | 'client' | null): UserPermissions => {
  // Clients have no business permissions - they only access their own portal
  if (role === 'client') {
    return {
      access_appointments: false,
      access_services: false,
      access_invoicing: false,
      access_forms: false,
      supervisor: false,
    };
  }
  
  // Staff users get default (no permissions) - must be explicitly granted
  return {
    access_appointments: false,
    access_services: false,
    access_invoicing: false,
    access_forms: false,
    supervisor: false,
  };
};