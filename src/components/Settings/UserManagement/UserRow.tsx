import { useState, useCallback } from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Loader2, Archive, Briefcase } from "lucide-react";
import { Profile } from '@/hooks/useProfiles';
import { PermissionSettings } from './PermissionSettings';
import { ProfessionalSettings } from './ProfessionalSettings';
import { ArchiveUserDialog } from './ArchiveUserDialog';
import { UserPermissions } from '@/utils/permissionUtils';
import { useStaffProfile } from '@/hooks/useStaffProfile';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useRoleCacheInvalidation } from '@/hooks/useRoleCacheInvalidation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RoleChanges {
  rolesToAdd: string[];
  rolesToRemove: string[];
}

interface UserRowProps {
  profile: Profile;
  isCurrentUser: boolean;
  isExpanded: boolean;
  userPermissions: UserPermissions | null;
  updatingUser: string | null;
  onToggleExpanded: () => void;
  onRoleChange: (profileId: string, newRole: string) => void;
  onPermissionUpdate: () => void;
  onArchive: (profileId: string) => void;
}

export function UserRow({ 
  profile, 
  isCurrentUser, 
  isExpanded,
  userPermissions,
  updatingUser,
  onToggleExpanded,
  onRoleChange,
  onPermissionUpdate,
  onArchive
}: UserRowProps) {
  const isUpdating = updatingUser === profile.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { invalidateUserRole } = useRoleCacheInvalidation();
  const { staff, updateStaffProfile } = useStaffProfile({ profileId: profile.id });
  const { user } = useAuth();

  // Fetch active roles from user_roles table
  const { data: activeRoles } = useQuery({
    queryKey: ['user_roles', profile.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profile.id);

      if (error) throw error;
      return data?.map(r => r.role) || [];
    },
    enabled: isExpanded
  });

  const [professionalChanges, setProfessionalChanges] = useState<any>({});
  const [roleChanges, setRoleChanges] = useState<RoleChanges>({ rolesToAdd: [], rolesToRemove: [] });
  const [isSaving, setIsSaving] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  // Determine display role from staff data
  const displayRole = staff?.prov_status || 'Staff';
  const canArchive = !isCurrentUser && staff;

  const hasRoleChanges = roleChanges.rolesToAdd.length > 0 || roleChanges.rolesToRemove.length > 0;
  const hasUnsavedChanges = Object.keys(professionalChanges).length > 0 || hasRoleChanges;

  const handleProfessionalDataChange = (data: any) => {
    setProfessionalChanges(data);
  };

  const handleRolesChanged = useCallback((changes: RoleChanges) => {
    setRoleChanges(changes);
  }, []);

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      // Save professional data if there are changes
      if (Object.keys(professionalChanges).length > 0) {
        const result = await updateStaffProfile(professionalChanges);
        if (result.error) {
          throw new Error(result.error.message);
        }
      }

      // Save role changes if there are any
      const tenantId = user?.roleContext?.tenantId;
      if (hasRoleChanges && staff?.id && tenantId) {
        const response = await supabase.functions.invoke('update-staff-roles', {
          body: {
            staffId: staff.id,
            tenantId: tenantId,
            rolesToAdd: roleChanges.rolesToAdd,
            rolesToRemove: roleChanges.rolesToRemove,
          }
        });

        if (response.error) {
          throw new Error(response.error.message || 'Failed to update roles');
        }

        if (!response.data?.success) {
          throw new Error(response.data?.message || 'Failed to update roles');
        }

        // Invalidate role assignments query to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['staff_role_assignments', staff.id] });
      }

      toast({
        title: "Changes saved",
        description: "User settings have been updated successfully.",
      });

      // Invalidate cache to force role detection refresh
      invalidateUserRole(profile.id);

      // Clear pending changes
      setProfessionalChanges({});
      setRoleChanges({ rolesToAdd: [], rolesToRemove: [] });

      // Refresh data
      onPermissionUpdate();
    } catch (error: any) {
      toast({
        title: "Error saving changes",
        description: error.message || "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <TableRow className="hover:bg-muted/50">
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpanded}
            className="h-6 w-6 p-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        
        <TableCell>
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-xs font-medium text-primary-foreground">
                {(profile.display_name || profile.email || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">
                  {profile.display_name || 'Unnamed User'}
                </p>
                {isCurrentUser && (
                  <Badge variant="outline" className="text-xs">You</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {profile.email}
              </p>
            </div>
          </div>
        </TableCell>
        
        <TableCell>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Briefcase className="h-3 w-3 text-muted-foreground" />
              <Badge variant="secondary" className="text-xs">
                {displayRole}
              </Badge>
            </div>
          </div>
        </TableCell>
        
        <TableCell>
          <div className="flex items-center justify-end">
            {isUpdating && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </div>
        </TableCell>
      </TableRow>
      
      {isExpanded && (
        <TableRow>
        <TableCell colSpan={4} className="p-0">
          <div className="px-4 pb-4 space-y-3">
            {/* Active Roles Status */}
            {activeRoles && activeRoles.length > 0 && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <div className="text-sm font-medium mb-2">Active Roles (Source: user_roles table)</div>
                <div className="flex gap-2">
                  {activeRoles.map((role) => (
                    <Badge key={role} variant="secondary">
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Professional Settings */}
            {staff && (
              <ProfessionalSettings
                userId={profile.id}
                onDataChange={handleProfessionalDataChange}
              />
            )}
            
            {/* Role Assignments */}
            {staff && (
              <PermissionSettings
                userId={profile.id}
                staffId={staff.id}
                tenantId={user?.roleContext?.tenantId ?? null}
                onRolesChanged={handleRolesChanged}
              />
            )}
            
            {/* Action Buttons */}
            {staff && (
              <div className="flex justify-between items-center">
                {canArchive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowArchiveDialog(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive User
                  </Button>
                )}
                <Button
                  onClick={handleSaveChanges}
                  disabled={!hasUnsavedChanges || isSaving}
                  size="sm"
                  className="ml-auto"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            )}
          </div>
        </TableCell>
        </TableRow>
      )}

      {/* Archive Confirmation Dialog */}
      <ArchiveUserDialog
        profile={profile}
        open={showArchiveDialog}
        onOpenChange={setShowArchiveDialog}
        onConfirm={() => {
          onArchive(profile.id);
          setShowArchiveDialog(false);
        }}
      />
    </>
  );
}
