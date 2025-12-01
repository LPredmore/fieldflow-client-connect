export type UserRole = 'staff' | 'client';

export const getRoleDisplayName = (role: UserRole): string => {
  switch (role) {
    case 'staff':
      return 'Staff';
    case 'client':
      return 'Client';
    default:
      return 'Unknown Role';
  }
};

// Note: These functions now check against 'staff' role
// Additional admin checks should use the isAdmin flag from clinician data
export const canAccessSettings = (role: UserRole | null, isAdmin?: boolean): boolean => {
  return role === 'staff' && (isAdmin === undefined || isAdmin === true);
};

export const canManageUsers = (role: UserRole | null, isAdmin?: boolean): boolean => {
  return role === 'staff' && (isAdmin === undefined || isAdmin === true);
};

