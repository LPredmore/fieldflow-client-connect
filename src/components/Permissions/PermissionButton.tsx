import { ReactNode, ButtonHTMLAttributes } from 'react';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { UserPermissions, hasPermission } from '@/utils/permissionUtils';
import { Button } from '@/components/ui/button';

interface PermissionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  permission: keyof UserPermissions;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  hideWhenNoPermission?: boolean;
}

export function PermissionButton({ 
  children, 
  permission, 
  variant = 'default',
  size = 'default',
  hideWhenNoPermission = false,
  disabled,
  ...props 
}: PermissionButtonProps) {
  const { permissions, loading } = usePermissionContext();

  const hasRequiredPermission = hasPermission(permissions, permission);

  if (loading || (!hasRequiredPermission && hideWhenNoPermission)) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || loading || !hasRequiredPermission}
      {...props}
    >
      {children}
    </Button>
  );
}