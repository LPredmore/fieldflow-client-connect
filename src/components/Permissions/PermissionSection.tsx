import { ReactNode } from 'react';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { UserPermissions, hasPermission } from '@/utils/permissionUtils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock } from 'lucide-react';

interface PermissionSectionProps {
  children: ReactNode;
  permission: keyof UserPermissions;
  fallback?: ReactNode;
  showAccessDenied?: boolean;
  accessDeniedMessage?: string;
}

export function PermissionSection({ 
  children, 
  permission, 
  fallback,
  showAccessDenied = false,
  accessDeniedMessage = 'You do not have permission to access this section.'
}: PermissionSectionProps) {
  const { permissions, loading } = usePermissionContext();

  if (loading) {
    return null;
  }

  if (!hasPermission(permissions, permission)) {
    if (showAccessDenied) {
      return (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            {accessDeniedMessage}
          </AlertDescription>
        </Alert>
      );
    }
    
    return <>{fallback}</>;
  }

  return <>{children}</>;
}