import React, { createContext, useContext, ReactNode } from 'react';
import { usePermissionsData } from '@/hooks/permissions/usePermissionsData';
import { UserPermissions } from '@/utils/permissionUtils';

interface PermissionContextValue {
  permissions: UserPermissions | null;
  loading: boolean;
  error: string | null;
  hasCustomPermissions: boolean;
  refetch: () => void;
}

const PermissionContext = createContext<PermissionContextValue | undefined>(undefined);

interface PermissionProviderProps {
  children: ReactNode;
}

/**
 * Permission Provider
 * 
 * Provides derived permissions based on user_roles and staff_role_assignments.
 * Permissions are READ-ONLY as they are computed from roles.
 * To change permissions, modify role assignments instead.
 */
export function PermissionProvider({ children }: PermissionProviderProps) {
  const {
    data: permissions,
    loading,
    error,
    hasCustomPermissions,
    refetch,
  } = usePermissionsData();

  const value: PermissionContextValue = {
    permissions,
    loading,
    error,
    hasCustomPermissions,
    refetch,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissionContext(): PermissionContextValue {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissionContext must be used within a PermissionProvider');
  }
  return context;
}