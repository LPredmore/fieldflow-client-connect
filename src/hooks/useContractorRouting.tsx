/**
 * useContractorRouting - Staff/contractor routing state management
 * Determines staff routing state based on profile, permissions, and onboarding status
 */

import { useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissionChecks } from '@/hooks/permissions/usePermissionChecks';

export type ContractorRoutingState = 
  | 'needs_onboarding'
  | 'staff'
  | 'admin'
  | 'idle';

export const useContractorRouting = () => {
  const { user, isLoading } = useAuth();
  const { canAccessInvoicing, loading: permissionsLoading } = usePermissionChecks();
  const navigate = useNavigate();
  
  // Track last stable state to prevent returning stale values during re-renders
  const lastStableState = useRef<ContractorRoutingState>('idle');

  // Determine current routing state based on staff attributes and permissions
  const currentState = useMemo<ContractorRoutingState>(() => {
    // Not a staff user
    if (!user || user.role !== 'staff') {
      const state = 'idle';
      if (!isLoading && !permissionsLoading) {
        lastStableState.current = state;
      }
      return lastStableState.current;
    }

    // Loading state - return last stable state
    if (isLoading || permissionsLoading) {
      return lastStableState.current;
    }

    // Check if staff profile is complete
    const hasStaffData = user.staffAttributes?.staffData;
    const hasName = hasStaffData && 
                    user.staffAttributes.staffData.prov_name_f && 
                    user.staffAttributes.staffData.prov_name_l;
    
    // If no staff data with name, needs onboarding
    if (!hasName) {
      lastStableState.current = 'needs_onboarding';
      return 'needs_onboarding';
    }

    // Check if user is admin
    if (user.staffAttributes?.is_admin) {
      lastStableState.current = 'admin';
      return 'admin';
    }

    // All other staff get 'staff' state
    // Permissions control feature access, not routing state
    lastStableState.current = 'staff';
    return 'staff';
  }, [user, isLoading, permissionsLoading]);

  // Navigate to a specific state
  const navigateToState = (state: ContractorRoutingState) => {
    switch (state) {
      case 'needs_onboarding':
        navigate('/staff/registration');
        break;
      case 'staff':
      case 'admin':
        navigate('/staff/dashboard');
        break;
      default:
        console.warn('Cannot navigate to state:', state);
    }
  };

  // Check if navigation to a state is allowed
  const canNavigate = (targetState: ContractorRoutingState): boolean => {
    // Define valid state transitions
    const validTransitions: Record<ContractorRoutingState, ContractorRoutingState[]> = {
      idle: [],
      needs_onboarding: ['staff', 'admin'],
      staff: ['admin'],
      admin: ['staff'],
    };

    const allowedNextStates = validTransitions[currentState] || [];
    return allowedNextStates.includes(targetState);
  };

  // Check if user has specific access
  const hasAccess = useMemo(() => ({
    dashboard: currentState === 'staff' || currentState === 'admin',
    adminSettings: currentState === 'admin',
    billing: canAccessInvoicing, // Null-safe permission check
    needsOnboarding: currentState === 'needs_onboarding',
  }), [currentState, canAccessInvoicing]);

  // Development logging for debugging state transitions
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const staffData = user?.staffAttributes?.staffData;
      console.log('[useContractorRouting] State changed:', {
        currentState,
        loading: isLoading || permissionsLoading,
        user: user?.role,
        hasStaffData: !!staffData,
        hasName: !!(staffData?.prov_name_f && staffData?.prov_name_l),
        isAdmin: user?.staffAttributes?.is_admin,
      });
    }
  }, [currentState, isLoading, permissionsLoading, user]);

  return {
    currentState,
    loading: isLoading || permissionsLoading,
    navigate: navigateToState,
    canNavigate,
    hasAccess,
    // Legacy compatibility
    history: [],
    goBack: () => navigate(-1),
  };
};

export default useContractorRouting;
