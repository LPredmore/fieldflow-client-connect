import React, { createContext, useContext, ReactNode } from 'react';
import { usePermissionsData } from '@/hooks/permissions/usePermissionsData';
import { UserPermissions } from '@/utils/permissionUtils';

interface PermissionContextValue {
  permissions: UserPermissions | null;
  loading: boolean;
  error: string | null;
  hasCustomPermissions: boolean;
  updatePermissions: (updates: Partial<UserPermissions>) => Promise<any>;
  createPermissions: (userId: string, newPermissions: UserPermissions) => Promise<any>;
  removePermissions: () => Promise<any>;
  refetch: () => void;
}

const PermissionContext = createContext<PermissionContextValue | undefined>(undefined);

interface PermissionProviderProps {
  children: ReactNode;
}

export function PermissionProvider({ children }: PermissionProviderProps) {
  const {
    data: permissions,
    loading,
    error,
    hasCustomPermissions,
    create,
    update,
    remove,
    refetch,
  } = usePermissionsData();

  const value: PermissionContextValue = {
    permissions,
    loading,
    error,
    hasCustomPermissions,
    updatePermissions: update,
    createPermissions: create,
    removePermissions: remove,
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