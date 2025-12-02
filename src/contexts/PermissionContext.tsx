import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
 * Reads permissions directly from AuthenticationContext to avoid duplicate queries.
 * Permissions are READ-ONLY as they are computed from roles during authentication.
 * To change permissions, modify role assignments instead.
 */
export function PermissionProvider({ children }: PermissionProviderProps) {
  const { user, isLoading } = useAuth();
  
  // Get permissions from already-loaded user data
  // No additional database queries needed!
  const permissions = user?.permissions as UserPermissions | null;
  
  const value: PermissionContextValue = {
    permissions,
    loading: isLoading,
    error: null,
    hasCustomPermissions: !!user?.roleContext?.isClinician || !!user?.roleContext?.isAdmin,
    refetch: () => {}, // No-op since permissions come from auth context
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