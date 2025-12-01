/**
 * Authentication Context
 * 
 * Top-level authentication context that coordinates the unified flow.
 * Provides authentication state and methods to the entire application.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1, 7.2, 8.1, 8.2, 8.3
 */

import { createContext, useContext } from 'react';
import type { UserRoleContext, UserProfile, StaffData, UserPermissions } from '@/services/auth/UnifiedRoleDetectionService';

/**
 * User object containing all authentication and role data
 */
export interface User {
  id: string;
  email: string;
  profile: UserProfile;
  role: 'staff' | 'client';
  staffAttributes?: StaffAttributes;
  permissions?: UserPermissions;
  roleContext: UserRoleContext;
  // Legacy compatibility
  user_metadata?: { 
    full_name?: string; 
    first_name?: string;
    last_name?: string;
    [key: string]: any 
  };
}

/**
 * Staff-specific attributes
 */
export interface StaffAttributes {
  is_clinician: boolean;
  is_admin: boolean;
  prov_status?: string | null;
  staffData?: StaffData;
}

/**
 * Authentication context value
 */
export interface AuthenticationContextValue {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetAuth: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  
  // Legacy compatibility properties
  userRole: string | null;
  tenantId: string | null;
  isAdmin: boolean;
  loading: boolean; // alias for isLoading
  signOut: () => Promise<void>; // alias for logout
  signIn: (email: string, password: string) => Promise<{error?: any}>;
  signUp: (
    email: string, 
    password: string, 
    firstName?: string, 
    lastName?: string, 
    phone?: string, 
    companyName?: string, 
    userType?: 'contractor' | 'client'
  ) => Promise<{error?: any}>;
  resetPassword: (email: string) => Promise<{error?: any}>;
}

/**
 * Default context value
 */
const defaultContextValue: AuthenticationContextValue = {
  user: null,
  isLoading: false,
  error: null,
  login: async () => {
    throw new Error('AuthenticationProvider not initialized');
  },
  logout: async () => {
    throw new Error('AuthenticationProvider not initialized');
  },
  resetAuth: async () => {
    throw new Error('AuthenticationProvider not initialized');
  },
  refreshUserData: async () => {
    throw new Error('AuthenticationProvider not initialized');
  },
  // Legacy compatibility defaults
  userRole: null,
  tenantId: null,
  isAdmin: false,
  loading: false,
  signOut: async () => {
    throw new Error('AuthenticationProvider not initialized');
  },
  signIn: async () => {
    throw new Error('AuthenticationProvider not initialized');
  },
  signUp: async () => {
    throw new Error('AuthenticationProvider not initialized');
  },
  resetPassword: async () => {
    throw new Error('AuthenticationProvider not initialized');
  },
};

/**
 * Authentication context
 */
export const AuthenticationContext = createContext<AuthenticationContextValue>(defaultContextValue);

/**
 * Hook to access authentication context
 * 
 * @returns Authentication context value
 * @throws Error if used outside AuthenticationProvider
 */
export function useAuth(): AuthenticationContextValue {
  const context = useContext(AuthenticationContext);
  
  if (!context) {
    throw new Error('useAuth must be used within AuthenticationProvider');
  }
  
  console.log('🎣 [useAuth] Hook called', {
    hasUser: !!context.user,
    userId: context.user?.id,
    role: context.user?.role,
    tenantId: context.tenantId,
    isLoading: context.isLoading,
    hasError: !!context.error
  });
  
  return context;
}
