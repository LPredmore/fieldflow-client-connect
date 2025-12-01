/**
 * AppRouter - Portal-level routing guard
 * Enforces role-based and permission-based access control for portal routes
 */

import { ReactNode, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { useClientRouting } from '@/hooks/useClientRouting';
import { useContractorRouting } from '@/hooks/useContractorRouting';
import { hasPermission, UserPermissions } from '@/utils/permissionUtils';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AppRouterProps {
  children?: ReactNode;
  allowedStates?: string[];
  portalType?: 'client' | 'staff' | 'billing';
  requiredPermissions?: (keyof UserPermissions)[];
  fallbackMessage?: string;
}

export const AppRouter = ({ 
  children, 
  allowedStates = [], 
  portalType,
  requiredPermissions = [],
  fallbackMessage 
}: AppRouterProps) => {
  const { user, isLoading } = useAuth();
  const { permissions, loading: permissionsLoading } = usePermissionContext();
  const { currentState: clientState, loading: clientLoading } = useClientRouting();
  const { currentState: staffState, loading: staffLoading } = useContractorRouting();
  const location = useLocation();

  // Memoize current state calculation to prevent race conditions
  // MUST be called before any early returns (React Rules of Hooks)
  const currentState = useMemo<string | null>(() => {
    if (!user) return null;
    if (portalType === 'client' && user.role === 'client') {
      return clientState;
    } else if (portalType === 'staff' && user.role === 'staff') {
      return staffState;
    } else if (portalType === 'billing' && user.role === 'staff') {
      return staffState;
    }
    return null;
  }, [portalType, user, clientState, staffState]);

  const stateLoading = useMemo(() => {
    if (!user) return false;
    if (portalType === 'client' && user.role === 'client') {
      return clientLoading;
    } else if ((portalType === 'staff' || portalType === 'billing') && user.role === 'staff') {
      return staffLoading;
    }
    return false;
  }, [portalType, user, clientLoading, staffLoading]);

  // Memoize allowed state check to prevent unnecessary re-renders
  const hasAllowedState = useMemo(() => {
    return allowedStates.length === 0 || 
      (currentState !== null && allowedStates.includes(currentState));
  }, [allowedStates, currentState]);

  // Wait for auth and relevant data to load
  if (isLoading || permissionsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to auth page
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Wait for state to load
  if (stateLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasAllowedState) {
    // Redirect based on portal type and current state
    if (portalType === 'client') {
      if (clientState === 'needs_registration') {
        return <Navigate to="/client/registration" replace />;
      } else if (clientState === 'completing_signup') {
        return <Navigate to="/client/signup-forms" replace />;
      } else if (clientState === 'registered') {
        return <Navigate to="/client/dashboard" replace />;
      }
    } else if (portalType === 'staff') {
      if (staffState === 'needs_onboarding') {
        return <Navigate to="/staff/registration" replace />;
      } else if (staffState === 'staff' || staffState === 'admin') {
        return <Navigate to="/staff/dashboard" replace />;
      }
    }

    // Fallback to generic access denied
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            {fallbackMessage || 'You do not have access to this page.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Check required permissions if specified
  if (requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every(permission => 
      hasPermission(permissions, permission)
    );

    if (!hasAllPermissions) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Permission Denied</AlertTitle>
            <AlertDescription>
              {fallbackMessage || 'You do not have the required permissions to access this page.'}
            </AlertDescription>
          </Alert>
        </div>
      );
    }
  }

  // All checks passed - render children
  return <>{children}</>;
};

export default AppRouter;
