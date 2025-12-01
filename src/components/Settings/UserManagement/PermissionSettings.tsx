import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionCheckbox } from './PermissionCheckbox';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { UserPermissions } from '@/utils/permissionUtils';

interface PermissionSettingsProps {
  userId: string;
  userPermissions: UserPermissions | null;
  onPermissionUpdate: () => void;
  onDataChange?: (changes: Partial<UserPermissions>) => void;
}

export function PermissionSettings({ userId, userPermissions, onPermissionUpdate, onDataChange }: PermissionSettingsProps) {
  const [localPermissions, setLocalPermissions] = useState<UserPermissions | null>(userPermissions);

  // Update local state when props change
  useState(() => {
    setLocalPermissions(userPermissions);
  });

  const handlePermissionChange = (permissionKey: keyof UserPermissions, newValue: boolean) => {
    const updatedPermissions = { ...localPermissions, [permissionKey]: newValue } as UserPermissions;
    setLocalPermissions(updatedPermissions);
    
    // Notify parent of changes
    if (onDataChange) {
      onDataChange({ [permissionKey]: newValue });
    }
  };

  const permissionConfig = [
    {
      key: 'access_appointments' as keyof UserPermissions,
      label: 'Scheduling',
      description: 'Allow access to the Scheduling page and appointment management'
    },
    {
      key: 'access_services' as keyof UserPermissions,
      label: 'Services',
      description: 'Allow access to the Services page and service management'
    },
    {
      key: 'access_invoicing' as keyof UserPermissions,
      label: 'Billing',
      description: 'Allow access to the Billing page and invoice management'
    },
    {
      key: 'supervisor' as keyof UserPermissions,
      label: 'Supervisor',
      description: 'Allow changing assigned staff on appointments'
    },
  ];

  return (
    <Card className="mt-3">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Permissions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {permissionConfig.map(({ key, label, description }) => (
          <PermissionCheckbox
            key={key}
            label={label}
            description={description}
            checked={localPermissions?.[key] || false}
            loading={false}
            onCheckedChange={(checked) => handlePermissionChange(key, checked)}
          />
        ))}
      </CardContent>
    </Card>
  );
}