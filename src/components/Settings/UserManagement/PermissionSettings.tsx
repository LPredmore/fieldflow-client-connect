import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Shield, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useStaffRoles } from '@/hooks/useStaffRoles';
import { useStaffRoleAssignments } from '@/hooks/useStaffRoleAssignments';

interface RoleChanges {
  rolesToAdd: string[];
  rolesToRemove: string[];
}

interface PermissionSettingsProps {
  userId: string;
  staffId: string | null;
  tenantId: string | null;
  onRolesChanged?: (changes: RoleChanges) => void;
}

/**
 * Permission Settings Component
 * 
 * Displays staff roles from the staff_roles table and allows toggling
 * role assignments. Changes are tracked locally and passed to parent
 * component for saving via edge function.
 */
export function PermissionSettings({ 
  userId, 
  staffId, 
  tenantId,
  onRolesChanged 
}: PermissionSettingsProps) {
  const { roles, loading: rolesLoading } = useStaffRoles();
  const { assignments, loading: assignmentsLoading, refetch: refetchAssignments } = useStaffRoleAssignments({ staffId });
  
  // Track pending changes as a map of roleCode -> newState (true = should have, false = should not have)
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());

  // Reset pending changes when assignments change (e.g., after save)
  useEffect(() => {
    setPendingChanges(new Map());
  }, [assignments]);

  // Calculate current effective state for each role
  const roleStates = useMemo(() => {
    const states = new Map<string, boolean>();
    
    roles.forEach(role => {
      const hasAssignment = assignments.includes(role.code);
      const pendingChange = pendingChanges.get(role.code);
      
      // If there's a pending change, use that; otherwise use current assignment
      if (pendingChange !== undefined) {
        states.set(role.code, pendingChange);
      } else {
        states.set(role.code, hasAssignment);
      }
    });
    
    return states;
  }, [roles, assignments, pendingChanges]);

  // Notify parent of changes
  useEffect(() => {
    if (!onRolesChanged) return;

    const rolesToAdd: string[] = [];
    const rolesToRemove: string[] = [];

    pendingChanges.forEach((newState, roleCode) => {
      const currentlyAssigned = assignments.includes(roleCode);
      
      if (newState && !currentlyAssigned) {
        rolesToAdd.push(roleCode);
      } else if (!newState && currentlyAssigned) {
        rolesToRemove.push(roleCode);
      }
    });

    onRolesChanged({ rolesToAdd, rolesToRemove });
  }, [pendingChanges, assignments, onRolesChanged]);

  const handleToggleRole = (roleCode: string, newState: boolean) => {
    const currentlyAssigned = assignments.includes(roleCode);
    
    setPendingChanges(prev => {
      const next = new Map(prev);
      
      // If the new state matches the original assignment, remove the pending change
      if (newState === currentlyAssigned) {
        next.delete(roleCode);
      } else {
        next.set(roleCode, newState);
      }
      
      return next;
    });
  };

  const loading = rolesLoading || assignmentsLoading;

  if (loading) {
    return (
      <Card className="mt-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Staff Roles</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!staffId || !tenantId) {
    return (
      <Card className="mt-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Staff Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load role assignments.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-3">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Staff Roles</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Toggle roles to grant or revoke permissions
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {roles.map((role) => {
          const isEnabled = roleStates.get(role.code) ?? false;
          const isAccountOwner = role.code === 'ACCOUNT_OWNER';
          const hasPendingChange = pendingChanges.has(role.code);
          
          return (
            <div
              key={role.id}
              className={`flex items-center justify-between p-3 rounded-md border ${
                hasPendingChange ? 'border-primary/50 bg-primary/5' : 'bg-muted/30'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Label 
                    htmlFor={`role-${role.code}`} 
                    className="text-sm font-medium cursor-pointer"
                  >
                    {role.name}
                  </Label>
                  {role.is_clinical && (
                    <Badge variant="outline" className="text-xs">Clinical</Badge>
                  )}
                  {isAccountOwner && (
                    <Badge variant="secondary" className="text-xs">Protected</Badge>
                  )}
                  {hasPendingChange && (
                    <Badge variant="default" className="text-xs">Changed</Badge>
                  )}
                </div>
                {role.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
                )}
              </div>
              <Switch
                id={`role-${role.code}`}
                checked={isEnabled}
                onCheckedChange={(checked) => handleToggleRole(role.code, checked)}
                disabled={isAccountOwner}
                aria-label={`Toggle ${role.name} role`}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
