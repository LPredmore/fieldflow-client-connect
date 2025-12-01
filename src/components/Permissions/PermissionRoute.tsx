import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { UserPermissions, hasPermission } from '@/utils/permissionUtils';
import { Loader2 } from 'lucide-react';

interface PermissionRouteProps {
  children: ReactNode;
  permission: keyof UserPermissions;
  redirectTo?: string;
  showLoading?: boolean;
}

export function PermissionRoute({ 
  children, 
  permission, 
  redirectTo = '/',
  showLoading = true 
}: PermissionRouteProps) {
  const { permissions, loading } = usePermissionContext();
  const location = useLocation();

  if (loading && showLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return null;
  }

  if (!hasPermission(permissions, permission)) {
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location }} 
        replace 
      />
    );
  }

  return <>{children}</>;
}