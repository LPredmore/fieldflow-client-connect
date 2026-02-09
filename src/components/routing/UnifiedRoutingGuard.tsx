/**
 * Unified Routing Guard Component
 * 
 * Single routing decision component that replaces all competing logic.
 * Enforces access control and performs redirects based on user roles.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 7.6
 */

import { ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthenticationContext';
import { AuthError, AuthErrorType } from '@/services/auth/AuthError';
import { RoutingErrorPage } from './RoutingErrorPage';
import { authLogger, AuthLogCategory } from '@/services/auth/AuthLogger';

interface UnifiedRoutingGuardProps {
  children: ReactNode;
}

interface RoutingDecision {
  shouldRedirect: boolean;
  redirectTo?: string;
  reason?: string;
}

interface RedirectHistoryEntry {
  path: string;
  timestamp: number;
}

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/auth',
  '/login',
  '/complete-signup',
  '/public-invoice'
];

// Redirect prevention constants
const MAX_REDIRECTS_PER_WINDOW = 3;
const REDIRECT_WINDOW_MS = 5000; // 5 seconds
const REDIRECT_COOLDOWN_MS = 100; // 100ms between redirects

/**
 * Check if a path is a public route
 */
function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some(route => path.startsWith(route));
}

/**
 * Determine the appropriate route for the user
 */
function determineRoute(
  user: any,
  currentPath: string
): RoutingDecision {
  authLogger.logRouting('Determining route', {
    userId: user?.id,
    role: user?.role,
    isClinician: user?.staffAttributes?.is_clinician,
    currentPath
  }, user?.id);

  // Check for incomplete signup (before any other checks)
  if (user?.roleContext?.signupIncomplete) {
    if (currentPath === '/complete-signup') {
      authLogger.logRouting('User on signup completion page - no redirect', { currentPath }, user.id);
      return {
        shouldRedirect: false,
        reason: 'User completing signup'
      };
    }
    authLogger.logRouting('Incomplete signup - redirecting to completion', {
      from: currentPath,
      to: '/complete-signup'
    }, user.id);
    return {
      shouldRedirect: true,
      redirectTo: '/complete-signup',
      reason: 'User signup incomplete'
    };
  }

  // Not authenticated
  if (!user) {
    if (isPublicRoute(currentPath)) {
      authLogger.logRouting('Public route - no redirect', { currentPath });
      return {
        shouldRedirect: false,
        reason: 'Public route, no authentication required'
      };
    }
    authLogger.logRouting('Unauthenticated - redirecting to auth', { currentPath });
    return {
      shouldRedirect: true,
      redirectTo: '/auth',
      reason: 'User not authenticated'
    };
  }

  // Staff user
  if (user.role === 'staff') {
    const provStatus = user.staffAttributes?.prov_status;
    const isAdmin = user.staffAttributes?.is_admin === true;
    const isInvited = provStatus === 'Invited';
    
    authLogger.logRouting('Staff routing decision', {
      provStatus,
      isAdmin,
      isInvited,
      hasStaffAttributes: !!user.staffAttributes,
      currentPath
    }, user.id);
    
    // INVITED STAFF: Must complete registration first (regardless of admin status)
    if (isInvited) {
      if (currentPath === '/staff/registration') {
        authLogger.logRouting('Invited staff on registration - no redirect', { currentPath }, user.id);
        return {
          shouldRedirect: false,
          reason: 'Invited staff on registration page'
        };
      }
      authLogger.logRouting('Invited staff redirecting to registration', {
        from: currentPath,
        to: '/staff/registration'
      }, user.id);
      return {
        shouldRedirect: true,
        redirectTo: '/staff/registration',
        reason: 'Invited staff must complete registration'
      };
    }
    
    // ACTIVE STAFF: Route based on admin status
    if (isAdmin) {
      // Admins can access any staff route
      if (currentPath.startsWith('/staff/')) {
        authLogger.logRouting('Admin on staff route - no redirect', { currentPath }, user.id);
        return {
          shouldRedirect: false,
          reason: 'Admin accessing staff portal'
        };
      }
      authLogger.logRouting('Admin redirecting to dashboard', {
        from: currentPath,
        to: '/staff/dashboard'
      }, user.id);
      return {
        shouldRedirect: true,
        redirectTo: '/staff/dashboard',
        reason: 'Admin redirected to dashboard'
      };
    }
    
    // Regular active staff → dashboard or other staff routes
    if (currentPath.startsWith('/staff/')) {
      authLogger.logRouting('Active staff on staff route - no redirect', { currentPath }, user.id);
      return {
        shouldRedirect: false,
        reason: 'Active staff accessing staff portal'
      };
    }
    authLogger.logRouting('Active staff redirecting to dashboard', {
      from: currentPath,
      to: '/staff/dashboard'
    }, user.id);
    return {
      shouldRedirect: true,
      redirectTo: '/staff/dashboard',
      reason: 'Active staff redirected to dashboard'
    };
  }

  // Fallback for unknown scenarios
  authLogger.logError(AuthLogCategory.ROUTING, 'Unknown user state', undefined, {
    userId: user?.id,
    role: user?.role,
    currentPath
  });
  
  return {
    shouldRedirect: true,
    redirectTo: '/auth',
    reason: 'Unknown user state, redirecting to auth'
  };
}

/**
 * UnifiedRoutingGuard Component
 * 
 * Wraps route content and enforces routing rules based on user authentication and role.
 */
export function UnifiedRoutingGuard({ children }: UnifiedRoutingGuardProps) {
  const { user, isLoading, error, isPasswordRecovery } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Redirect tracking for loop prevention
  const redirectHistoryRef = useRef<RedirectHistoryEntry[]>([]);
  const lastRedirectTimeRef = useRef<number>(0);
  
  // Error state for redirect loops
  const [redirectLoopError, setRedirectLoopError] = useState<AuthError | null>(null);

  /**
   * Check if redirect is allowed (not in cooldown or over limit)
   */
  const canRedirect = (): boolean => {
    const now = Date.now();
    
    // Check cooldown period
    if (now - lastRedirectTimeRef.current < REDIRECT_COOLDOWN_MS) {
      authLogger.logRouting('Redirect blocked - cooldown period', {
        cooldownMs: REDIRECT_COOLDOWN_MS,
        timeSinceLastRedirect: now - lastRedirectTimeRef.current
      }, user?.id);
      return false;
    }
    
    // Clean up old redirect history (outside the window)
    redirectHistoryRef.current = redirectHistoryRef.current.filter(
      entry => now - entry.timestamp < REDIRECT_WINDOW_MS
    );
    
    // Check redirect limit
    if (redirectHistoryRef.current.length >= MAX_REDIRECTS_PER_WINDOW) {
      authLogger.logError(AuthLogCategory.ROUTING, 'Redirect limit exceeded', undefined, {
        redirectCount: redirectHistoryRef.current.length,
        windowMs: REDIRECT_WINDOW_MS,
        history: redirectHistoryRef.current,
        userId: user?.id
      });
      
      // Create redirect loop error
      const loopError = new AuthError(
        AuthErrorType.REDIRECT_LOOP_DETECTED,
        'Too many redirects detected',
        'Navigation error detected. Please refresh the page or contact support.',
        true,
        {
          redirectHistory: redirectHistoryRef.current,
          currentPath: location.pathname
        }
      );
      
      setRedirectLoopError(loopError);
      return false;
    }
    
    return true;
  };

  /**
   * Record a redirect in history
   */
  const recordRedirect = (path: string) => {
    const now = Date.now();
    redirectHistoryRef.current.push({
      path,
      timestamp: now
    });
    lastRedirectTimeRef.current = now;
    
    authLogger.logRouting('Redirect recorded', {
      path,
      redirectCount: redirectHistoryRef.current.length
    }, user?.id);
  };

  /**
   * Execute routing logic
   */
  useEffect(() => {
    // Don't process while loading
    if (isLoading) {
      return;
    }

    // Don't process if there's a redirect loop error
    if (redirectLoopError) {
      return;
    }

    // Handle authentication errors
    if (error) {
      authLogger.logError(AuthLogCategory.ROUTING, 'Authentication error in routing guard', error, {
        type: error instanceof AuthError ? error.type : 'unknown',
        userId: user?.id
      });
      
      // For certain errors, redirect to auth
      if (error instanceof AuthError) {
        if (
          error.type === AuthErrorType.AUTHENTICATION_FAILED ||
          error.type === AuthErrorType.SESSION_EXPIRED
        ) {
          if (!isPublicRoute(location.pathname)) {
            authLogger.logRouting('Redirecting to auth due to error', {
              errorType: error.type,
              from: location.pathname
            }, user?.id);
            navigate('/auth', { replace: true });
          }
        }
      }
      return;
    }

    // Allow password recovery users to stay on /auth
    if (isPasswordRecovery && location.pathname.startsWith('/auth')) {
      return;
    }

    // Determine routing decision
    const decision = determineRoute(user, location.pathname);

    // Execute redirect if needed
    if (decision.shouldRedirect && decision.redirectTo) {
      // Check if redirect is allowed
      if (!canRedirect()) {
        return;
      }
      
      // Record and execute redirect
      recordRedirect(decision.redirectTo);
      
      authLogger.logRouting('Executing redirect', {
        from: location.pathname,
        to: decision.redirectTo,
        reason: decision.reason
      }, user?.id);
      
      navigate(decision.redirectTo, { replace: true });
    }
  }, [user, isLoading, error, location.pathname, navigate, redirectLoopError]);

  // Show error page if redirect loop detected
  if (redirectLoopError) {
    return (
      <RoutingErrorPage
        error={redirectLoopError}
        onReset={() => {
          authLogger.logRouting('Resetting redirect loop error', {}, user?.id);
          setRedirectLoopError(null);
          redirectHistoryRef.current = [];
          lastRedirectTimeRef.current = 0;
        }}
      />
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show error page for role detection failures
  if (error && error instanceof AuthError) {
    if (error.type === AuthErrorType.ROLE_DETECTION_FAILED) {
      return (
        <RoutingErrorPage
          error={error}
          onReset={() => {
            authLogger.logRouting('User requested reset from error page', {}, user?.id);
            window.location.href = '/auth';
          }}
        />
      );
    }
  }

  // Render children
  return <>{children}</>;
}
