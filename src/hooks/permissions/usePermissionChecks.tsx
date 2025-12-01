import { useMemo } from 'react';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { 
  canAccessAppointments, 
  canAccessServices, 
  canAccessInvoicing, 
  canAccessForms, 
  canSupervise 
} from '@/utils/permissionUtils';

/**
 * Hook for checking user permissions in React components.
 * 
 * This hook provides null-safe permission checks that handle loading states automatically.
 * Always use this hook instead of directly accessing permissions from usePermissionContext.
 * 
 * @example
 * const { canAccessInvoicing, loading } = usePermissionChecks();
 * if (canAccessInvoicing && !loading) {
 *   // Show billing features
 * }
 * 
 * @returns Object with boolean permission checks and loading state
 */
export function usePermissionChecks() {
  const { permissions, loading } = usePermissionContext();

  const checks = useMemo(() => ({
    canAccessAppointments: canAccessAppointments(permissions),
    canAccessServices: canAccessServices(permissions),
    canAccessInvoicing: canAccessInvoicing(permissions),
    canAccessForms: canAccessForms(permissions),
    canSupervise: canSupervise(permissions),
    
    // Convenience methods for common combinations
    canAccessAnyBusinessFeature: 
      canAccessAppointments(permissions) || 
      canAccessServices(permissions) || 
      canAccessInvoicing(permissions) || 
      canAccessForms(permissions),
      
    canAccessAllBusinessFeatures:
      canAccessAppointments(permissions) && 
      canAccessServices(permissions) && 
      canAccessInvoicing(permissions) && 
      canAccessForms(permissions),
      
    isFullAdmin: canSupervise(permissions),
  }), [permissions]);

  return {
    ...checks,
    loading,
    permissions,
  };
}