/**
 * useClientRouting - Client routing state management
 * Determines client routing state based on customer status and profile data
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useClientStatus } from '@/hooks/useClientStatus';

export type ClientRoutingState = 
  | 'needs_registration'
  | 'completing_signup'
  | 'registered'
  | 'active'
  | 'completed'
  | 'error'
  | 'idle';

export const useClientRouting = () => {
  const { user } = useAuth();
  const { status, loading, error } = useClientStatus();
  const navigate = useNavigate();

  // Determine current routing state based on customer status
  const currentState = useMemo<ClientRoutingState>(() => {
    // Not a client user
    if (!user || user.role !== 'client') {
      return 'idle';
    }

    // Error state
    if (error) {
      return 'error';
    }

    // Loading state - treat as idle until we know
    if (loading) {
      return 'idle';
    }

    // No customer record found - needs registration
    if (!status) {
      return 'needs_registration';
    }

    // Map customer status to routing state
    switch (status) {
      case 'new':
        return 'needs_registration';
      case 'completing_signup':
        return 'completing_signup';
      case 'registered':
        return 'registered';
      default:
        return 'idle';
    }
  }, [user, status, loading, error]);

  // Navigate to a specific state
  const navigateToState = (state: ClientRoutingState) => {
    switch (state) {
      case 'needs_registration':
        navigate('/client/registration');
        break;
      case 'completing_signup':
        navigate('/client/signup-forms');
        break;
      case 'registered':
      case 'active':
        navigate('/client/dashboard');
        break;
      default:
        console.warn('Cannot navigate to state:', state);
    }
  };

  // Check if navigation to a state is allowed
  const canNavigate = (targetState: ClientRoutingState): boolean => {
    // Define valid state transitions
    const validTransitions: Record<ClientRoutingState, ClientRoutingState[]> = {
      idle: [],
      needs_registration: ['completing_signup'],
      completing_signup: ['registered'],
      registered: ['active'],
      active: ['completed'],
      completed: [],
      error: ['needs_registration', 'completing_signup', 'registered'],
    };

    const allowedNextStates = validTransitions[currentState] || [];
    return allowedNextStates.includes(targetState);
  };

  return {
    currentState,
    loading,
    error,
    navigate: navigateToState,
    canNavigate,
    // Legacy compatibility
    history: [],
    goBack: () => navigate(-1),
  };
};

export default useClientRouting;
