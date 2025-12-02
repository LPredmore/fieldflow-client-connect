/**
 * Authentication Provider Component
 * 
 * Implements the unified authentication flow with state management,
 * role detection, and error handling.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3
 */

import { useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AuthenticationContext, User, StaffAttributes } from '@/contexts/AuthenticationContext';
import { unifiedRoleDetectionService } from '@/services/auth/UnifiedRoleDetectionService';
import { sessionCacheService } from '@/services/auth/SessionCacheService';
import { AuthError, AuthErrorType } from '@/services/auth/AuthError';

interface AuthenticationProviderProps {
  children: ReactNode;
}

export function AuthenticationProvider({ children }: AuthenticationProviderProps) {
  console.log('🏗️ [AuthenticationProvider] Provider mounted/rendered');
  
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Load user data after authentication
   * Coordinates role detection and data fetching with retry logic
   */
  const loadUserData = useCallback(async (userId: string, email: string): Promise<void> => {
    console.debug('[AuthenticationProvider] Loading user data', { userId, email });

    try {
      // Detect user role using unified service
      const roleContext = await unifiedRoleDetectionService.detectUserRole(userId);

      // Build staff attributes if user is staff
      let staffAttributes: StaffAttributes | undefined;
      if (roleContext.isStaff) {
        staffAttributes = {
          is_clinician: roleContext.isClinician,
          is_admin: roleContext.isAdmin,
          prov_status: roleContext.staffData?.prov_status,
          staffData: roleContext.staffData
        };
      }

      // Build complete user object
      const userData: User = {
        id: userId,
        email: email,
        profile: roleContext.profile,
        role: roleContext.role,
        staffAttributes,
        permissions: roleContext.permissions,
        roleContext,
        // Legacy compatibility - populate user_metadata from staff table
        user_metadata: {
          full_name: roleContext.staffData 
            ? `${roleContext.staffData.prov_name_f || ''} ${roleContext.staffData.prov_name_l || ''}`.trim()
            : '',
          first_name: roleContext.staffData?.prov_name_f || null,
          last_name: roleContext.staffData?.prov_name_l || null,
        }
      };

      // Cache user data
      sessionCacheService.set(
        `user:${userId}`,
        userData,
        3600000 // 1 hour
      );

      // PHASE 4: Validate that tenantId exists
      if (!roleContext.tenantId) {
        throw new Error('User loaded but tenantId is missing - this indicates a profile or data integrity issue');
      }

      setUser(userData);
      setError(null);

      console.log('✅ [AuthenticationProvider] User data loaded successfully', {
        userId,
        email,
        role: userData.role,
        tenantId: roleContext.tenantId,
        isClinician: staffAttributes?.is_clinician,
        isAdmin: staffAttributes?.is_admin,
        hasProfile: !!roleContext.profile,
        staffName: roleContext.staffData ? `${roleContext.staffData.prov_name_f} ${roleContext.staffData.prov_name_l}` : null
      });
    } catch (err) {
      const authError = AuthError.fromError(err, AuthErrorType.DATA_FETCH_FAILED);
      console.error('❌ [AuthenticationProvider] Failed to load user data', {
        userId,
        email,
        error: authError.message,
        type: authError.type,
        userMessage: authError.userMessage,
        stack: err instanceof Error ? err.stack : undefined
      });

      setError(authError);
      throw authError;
    }
  }, []);

  /**
   * Login method
   * Authenticates with Supabase and triggers unified flow
   */
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    console.debug('[AuthenticationProvider] Login initiated', { email });
    setIsLoading(true);
    setError(null);

    try {
      // Authenticate with Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        throw new AuthError(
          AuthErrorType.AUTHENTICATION_FAILED,
          authError.message,
          'Invalid email or password. Please check your credentials and try again.',
          false,
          { originalError: authError }
        );
      }

      if (!data.user) {
        throw new AuthError(
          AuthErrorType.AUTHENTICATION_FAILED,
          'Authentication succeeded but no user data returned',
          'Login failed. Please try again.',
          true
        );
      }

      // Load user data (with retry logic)
      await loadUserData(data.user.id, data.user.email || email);

      console.debug('[AuthenticationProvider] Login completed successfully');
    } catch (err) {
      const authError = AuthError.fromError(err);
      console.error('[AuthenticationProvider] Login failed', {
        error: authError.message,
        type: authError.type,
        userMessage: authError.userMessage
      });

      setError(authError);
      setUser(null);
      throw authError;
    } finally {
      setIsLoading(false);
    }
  }, [loadUserData]);

  /**
   * Logout method
   * Clears all state and signs out from Supabase
   */
  const logout = useCallback(async (): Promise<void> => {
    console.debug('[AuthenticationProvider] Logout initiated');
    setIsLoading(true);

    try {
      // Sign out from Supabase
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        console.error('[AuthenticationProvider] Supabase sign out error', signOutError);
        // Continue with local cleanup even if sign out fails
      }

      // Clear user state
      setUser(null);
      setError(null);

      // Clear all cached data
      sessionCacheService.clear();

      // Invalidate role detection cache if we have a user
      if (user) {
        unifiedRoleDetectionService.invalidateCache(user.id);
      }

      console.debug('[AuthenticationProvider] Logout completed');
    } catch (err) {
      const authError = AuthError.fromError(err);
      console.error('[AuthenticationProvider] Logout error', {
        error: authError.message,
        type: authError.type,
        userMessage: authError.userMessage
      });
      
      // Still clear local state even if there's an error
      setUser(null);
      setError(null);
      sessionCacheService.clear();
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Reset authentication
   * Resets circuit breaker and clears cache
   */
  const resetAuth = useCallback(async (): Promise<void> => {
    console.debug('[AuthenticationProvider] Reset authentication initiated');
    setIsLoading(true);
    setError(null);

    try {
      // Clear all cached data
      sessionCacheService.clear();

      // Invalidate role detection cache
      if (user) {
        unifiedRoleDetectionService.invalidateCache(user.id);
      }

      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw new AuthError(
          AuthErrorType.SESSION_EXPIRED,
          sessionError.message,
          'Failed to retrieve session. Please log in again.',
          true,
          { originalError: sessionError }
        );
      }

      if (session?.user) {
        // Reload user data
        await loadUserData(session.user.id, session.user.email || '');
        console.debug('[AuthenticationProvider] Reset and reload completed');
      } else {
        // No session, clear user
        setUser(null);
        console.debug('[AuthenticationProvider] Reset completed, no session found');
      }
    } catch (err) {
      const authError = AuthError.fromError(err);
      console.error('[AuthenticationProvider] Reset error', {
        error: authError.message,
        type: authError.type,
        userMessage: authError.userMessage
      });
      setError(authError);
      throw authError;
    } finally {
      setIsLoading(false);
    }
  }, [user, loadUserData]);

  /**
   * Refresh user data
   * Manually refreshes user data from database
   */
  const refreshUserData = useCallback(async (): Promise<void> => {
    console.debug('[AuthenticationProvider] Refresh user data initiated');

    if (!user) {
      console.warn('[AuthenticationProvider] Cannot refresh, no user logged in');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Invalidate cache
      unifiedRoleDetectionService.invalidateCache(user.id);
      sessionCacheService.delete(`user:${user.id}`);

      // Reload user data (with retry logic)
      await loadUserData(user.id, user.email);

      console.debug('[AuthenticationProvider] Refresh completed');
    } catch (err) {
      const authError = AuthError.fromError(err, AuthErrorType.DATA_FETCH_FAILED);
      console.error('[AuthenticationProvider] Refresh error', {
        error: authError.message,
        type: authError.type,
        userMessage: authError.userMessage
      });
      setError(authError);
      throw authError;
    } finally {
      setIsLoading(false);
    }
  }, [user, loadUserData]);

  /**
   * Initialize session on mount
   * Restores session from Supabase and loads user data
   */
  useEffect(() => {
    let mounted = true;

    const initializeSession = async () => {
      console.log('[AuthenticationProvider] Initializing session');

      try {
        console.log('[AuthenticationProvider] Starting session initialization');
        const startTime = Date.now();
        
        // Add 15-second safety timeout as last-resort protection
        // This catches any hang that escapes the lock function timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) => {
          safetyTimeoutRef.current = setTimeout(() => {
            console.error('[AuthenticationProvider] SAFETY TIMEOUT: Session initialization exceeded 8s');
            reject(new Error('Session initialization timeout after 8 seconds'));
          }, 8000);  // 8s - lock timeout (5s) + 3s buffer, no longer need 15s with fast-fail
        });
        
        const { data: { session }, error: sessionError } = await Promise.race([
          sessionPromise,
          timeoutPromise as any
        ]);
        
        // Clear the timeout since we completed successfully
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        
        console.log('[AuthenticationProvider] Session initialization completed', { 
          duration: Date.now() - startTime,
          hasSession: !!session 
        });

        if (sessionError) {
          console.error('[AuthenticationProvider] Session error', sessionError);
          throw sessionError;
        }

        if (session?.user && mounted) {
          console.log('[AuthenticationProvider] Session found, loading user data', {
            userId: session.user.id
          });

          // Clear any stale customer query cache to ensure fresh data
          queryClient.invalidateQueries({ queryKey: ['customers'] });

          // Try to load from cache first
          const cachedUser = sessionCacheService.get<User>(`user:${session.user.id}`);
          
          if (cachedUser) {
            console.log('[AuthenticationProvider] Using cached user data');
            setUser(cachedUser);
            setIsLoading(false);
            setIsInitialized(true);
            return;
          }

          // Load fresh user data
          await loadUserData(session.user.id, session.user.email || '');
        } else {
          console.log('[AuthenticationProvider] No session found');
        }
      } catch (err) {
        const authError = AuthError.fromError(err, AuthErrorType.SESSION_EXPIRED);
        console.error('[AuthenticationProvider] Session initialization error', {
          error: authError.message,
          type: authError.type,
          userMessage: authError.userMessage,
          diagnosis: 'This may be caused by network issues or lock timeout. Refresh the page to retry.'
        });
        setError(authError);
      } finally {
        // ALWAYS set initialized to true so app renders (even on error)
        if (mounted) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initializeSession();

    return () => {
      mounted = false;
      // Clear safety timeout on unmount
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    };
  }, [loadUserData]);


  /**
   * Listen to auth state changes
   * Handles session restoration, expiration, and sign out
   */
  useEffect(() => {
    console.debug('[AuthenticationProvider] Setting up auth state listener');
    let lastFailedUserId: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.debug('[AuthenticationProvider] Auth state changed', { event, userId: session?.user?.id });

        try {
          switch (event) {
            case 'SIGNED_IN':
              if (session?.user) {
                // Prevent infinite retry loop if loadUserData previously failed for this user
                if (lastFailedUserId === session.user.id) {
                  console.warn('[AuthenticationProvider] Skipping loadUserData - previously failed for this user');
                  return;
                }
                
                console.debug('[AuthenticationProvider] User signed in, loading data');
                try {
                  await loadUserData(session.user.id, session.user.email || '');
                  lastFailedUserId = null; // Reset on success
                } catch (err) {
                  lastFailedUserId = session.user.id; // Track failure to prevent retry loop
                  throw err;
                }
              }
              break;

            case 'SIGNED_OUT':
              console.debug('[AuthenticationProvider] User signed out, clearing state');
              setUser(null);
              setError(null);
              sessionCacheService.clear();
              break;

            case 'TOKEN_REFRESHED':
              console.debug('[AuthenticationProvider] Token refreshed');
              // Session is still valid, no action needed
              break;

            case 'USER_UPDATED':
              console.debug('[AuthenticationProvider] User updated');
              if (session?.user && user) {
                // Optionally refresh user data
                console.debug('[AuthenticationProvider] Refreshing user data after update');
                await loadUserData(session.user.id, session.user.email || '');
              }
              break;

            case 'INITIAL_SESSION':
              // Handled by initializeSession, no action needed here
              console.debug('[AuthenticationProvider] Initial session event (handled by initialization)');
              break;

            default:
              console.debug('[AuthenticationProvider] Unhandled auth event', event);
          }
        } catch (err) {
          const authError = AuthError.fromError(err);
          console.error('[AuthenticationProvider] Auth state change error', {
            error: authError.message,
            type: authError.type,
            userMessage: authError.userMessage
          });
          setError(authError);
        }
      }
    );

    return () => {
      console.debug('[AuthenticationProvider] Cleaning up auth state listener');
      subscription.unsubscribe();
    };
  }, [loadUserData, user]);

  /**
   * Legacy method: signIn
   * Wrapper around login for backward compatibility
   */
  const signIn = useCallback(async (email: string, password: string): Promise<{error?: any}> => {
    try {
      await login(email, password);
      return {};
    } catch (error) {
      return { error };
    }
  }, [login]);

  /**
   * Legacy method: signUp
   * Stub implementation for backward compatibility
   */
  const signUp = useCallback(async (
    email: string, 
    password: string, 
    firstName?: string, 
    lastName?: string, 
    phone?: string, 
    companyName?: string, 
    userType?: 'contractor' | 'client'
  ): Promise<{error?: any}> => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: firstName,
            last_name: lastName,
            phone,
            company_name: companyName,
            user_type: userType
          }
        }
      });

      if (error) {
        return { error };
      }

      return {};
    } catch (error) {
      return { error };
    }
  }, []);

  /**
   * Legacy method: resetPassword
   * Stub implementation for backward compatibility
   */
  const resetPassword = useCallback(async (email: string): Promise<{error?: any}> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        return { error };
      }

      return {};
    } catch (error) {
      return { error };
    }
  }, []);

  // Compute legacy properties from user object
  const userRole = user?.role || null;
  const tenantId = user?.roleContext?.tenantId || null;
  const isAdmin = user?.staffAttributes?.is_admin || false;

  const contextValue = {
    user,
    isLoading,
    error,
    login,
    logout,
    resetAuth,
    refreshUserData,
    // Legacy compatibility properties
    userRole,
    tenantId,
    isAdmin,
    loading: isLoading, // alias
    signOut: logout, // alias
    signIn,
    signUp,
    resetPassword
  };

  // Don't render children until initialized
  if (!isInitialized) {
    return null;
  }

  return (
    <AuthenticationContext.Provider value={contextValue}>
      {children}
    </AuthenticationContext.Provider>
  );
}
