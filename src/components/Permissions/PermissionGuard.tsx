import { ReactNode } from 'react';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { UserPermissions, hasPermission } from '@/utils/permissionUtils';
import { Loader2 } from 'lucide-react';

interface PermissionGuardProps {
  children: ReactNode;
  permission?: keyof UserPermissions;
  requiredPermissions?: (keyof UserPermissions)[];
  fallback?: ReactNode;
  fallbackMessage?: string;
  showLoading?: boolean;
}

export function PermissionGuard({ 
  children, 
  permission, 
  requiredPermissions,
  fallback = null,
  fallbackMessage,
  showLoading = false 
}: PermissionGuardProps) {
  const { permissions, loading } = usePermissionContext();

  if (loading && showLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (loading) {
    return null;
  }

  // Support both single permission and array of permissions
  const permsToCheck = requiredPermissions || (permission ? [permission] : []);
  const hasAllPermissions = permsToCheck.every(perm => hasPermission(permissions, perm));

  if (!hasAllPermissions) {
    if (fallbackMessage) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md text-center space-y-4">
            <Loader2 className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">{fallbackMessage}</p>
          </div>
        </div>
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}