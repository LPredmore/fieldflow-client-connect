import { useCallback } from 'react';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { UserPermissions, hasPermission } from '@/utils/permissionUtils';
import { useToast } from '@/hooks/use-toast';

export function usePermissionValidation() {
  const { permissions } = usePermissionContext();
  const { toast } = useToast();

  const validatePermission = useCallback((
    permission: keyof UserPermissions,
    action?: string,
    showToast = true
  ): boolean => {
    const hasRequiredPermission = hasPermission(permissions, permission);
    
    if (!hasRequiredPermission && showToast) {
      toast({
        title: 'Access Denied',
        description: action 
          ? `You don't have permission to ${action}.`
          : 'You don\'t have permission to perform this action.',
        variant: 'destructive',
      });
    }
    
    return hasRequiredPermission;
  }, [permissions, toast]);

  const validateMultiplePermissions = useCallback((
    requiredPermissions: (keyof UserPermissions)[],
    requireAll = true,
    action?: string,
    showToast = true
  ): boolean => {
    const checkResults = requiredPermissions.map(permission => 
      hasPermission(permissions, permission)
    );
    
    const hasAccess = requireAll 
      ? checkResults.every(result => result)
      : checkResults.some(result => result);
    
    if (!hasAccess && showToast) {
      toast({
        title: 'Access Denied',
        description: action 
          ? `You don't have the required permissions to ${action}.`
          : 'You don\'t have the required permissions to perform this action.',
        variant: 'destructive',
      });
    }
    
    return hasAccess;
  }, [permissions, toast]);

  const requirePermission = useCallback((
    permission: keyof UserPermissions,
    action?: string
  ): void => {
    if (!validatePermission(permission, action, true)) {
      throw new Error(`Permission denied: ${permission}`);
    }
  }, [validatePermission]);

  return {
    validatePermission,
    validateMultiplePermissions,
    requirePermission,
    permissions,
  };
}
