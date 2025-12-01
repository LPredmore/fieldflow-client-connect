import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissionsData } from '@/hooks/permissions/usePermissionsData';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle2, XCircle } from 'lucide-react';

interface PermissionSettingsProps {
  userId: string;
}

/**
 * Permission Settings Component
 * 
 * Displays derived permissions based on user roles.
 * Permissions are READ-ONLY as they are computed from:
 * - user_roles table (admin vs staff)
 * - staff_role_assignments table (CLINICIAN, BILLING, etc.)
 * 
 * To modify permissions, update role assignments in UserRow component.
 */
export function PermissionSettings({ userId }: PermissionSettingsProps) {
  const { data: permissions, loading } = usePermissionsData({ userId });

  if (loading) {
    return (
      <Card className="mt-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading permissions...</p>
        </CardContent>
      </Card>
    );
  }

  const permissionConfig = [
    {
      key: 'access_appointments' as const,
      label: 'Scheduling',
      description: 'Access to appointments and scheduling'
    },
    {
      key: 'access_services' as const,
      label: 'Services',
      description: 'Access to service management'
    },
    {
      key: 'access_invoicing' as const,
      label: 'Billing',
      description: 'Access to billing and invoicing'
    },
    {
      key: 'access_forms' as const,
      label: 'Forms',
      description: 'Access to clinical forms'
    },
    {
      key: 'supervisor' as const,
      label: 'Supervisor',
      description: 'Can supervise and reassign appointments'
    },
  ];

  return (
    <Card className="mt-3">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Derived Permissions</CardTitle>
          <Badge variant="secondary" className="text-xs">Read-only</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Permissions are derived from role assignments
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {permissionConfig.map(({ key, label, description }) => {
          const hasPermission = permissions?.[key] || false;
          return (
            <div
              key={key}
              className="flex items-start gap-3 p-2 rounded-md bg-muted/30"
            >
              {hasPermission ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{label}</p>
                  {hasPermission && (
                    <Badge variant="default" className="text-xs">Granted</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
