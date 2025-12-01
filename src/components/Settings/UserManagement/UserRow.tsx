import { useState } from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Loader2, Archive, Stethoscope, Briefcase, AlertTriangle } from "lucide-react";
import { Profile } from '@/hooks/useProfiles';
import { AdminSettings } from './AdminSettings';
import { PermissionSettings } from './PermissionSettings';
import { ProfessionalSettings } from './ProfessionalSettings';
import { ArchiveUserDialog } from './ArchiveUserDialog';
import { UserPermissions } from '@/utils/permissionUtils';
import { usePermissions } from '@/hooks/usePermissions';
import { useClinicianProfile } from '@/hooks/useClinicianProfile';
import { useClinicianLicenses } from '@/hooks/useClinicianLicenses';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format, isPast } from 'date-fns';
import { useRoleCacheInvalidation } from '@/hooks/useRoleCacheInvalidation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  const { invalidateUserRole } = useRoleCacheInvalidation();
  const { updatePermissions } = usePermissions();
  const { clinician, updateClinicianProfile } = useClinicianProfile({ userId: profile.user_id });
  const { licenses, loading: licensesLoading } = useClinicianLicenses(clinician?.id);
  const { isAdmin } = useAuth();

  // Fetch active roles from user_roles table
  const { data: activeRoles } = useQuery({
    queryKey: ['user_roles', profile.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profile.user_id)
        .eq('is_active', true);

      if (error) throw error;
      return data?.map(r => r.role) || [];
    },
    enabled: isExpanded
  });

  // Calculate license summary
  const activeLicenses = licenses?.filter(l => l.is_active) || [];
  const expiredLicenses = activeLicenses.filter(l => isPast(new Date(l.expiration_date)));
  const primaryLicense = activeLicenses.find(l => l.is_primary);

  const [adminChanges, setAdminChanges] = useState<{ is_admin?: boolean }>({});
  const [professionalChanges, setProfessionalChanges] = useState<any>({});
  const [permissionChanges, setPermissionChanges] = useState<Partial<UserPermissions>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  // Determine if this user is clinical or non-office
  const isClinical = clinician?.is_clinician ?? false;
  const displayRole = isClinical ? 'Clinical' : 'Non-Office';
  
  // Prevent archiving self or primary admin
  const canArchive = !isCurrentUser && clinician && !clinician.is_admin;

  const hasUnsavedChanges = 
    Object.keys(adminChanges).length > 0 || 
    Object.keys(professionalChanges).length > 0 || 
    Object.keys(permissionChanges).length > 0;
  
  const handleAdminChange = (isAdmin: boolean) => {
    setAdminChanges({ is_admin: isAdmin });
  };

  const handleProfessionalDataChange = (data: any) => {
    setProfessionalChanges(data);
  };

  const handlePermissionDataChange = (changes: Partial<UserPermissions>) => {
    setPermissionChanges(prev => ({ ...prev, ...changes }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      // Combine admin and professional changes
      const clinicianUpdates = { ...adminChanges, ...professionalChanges };
      
      // Save clinician data if there are changes
      if (Object.keys(clinicianUpdates).length > 0) {
        const result = await updateClinicianProfile(clinicianUpdates);
        if (result.error) {
          throw new Error(result.error.message);
        }
      }

      // Save permission changes if there are any
      if (Object.keys(permissionChanges).length > 0) {
        await updatePermissions(profile.user_id, permissionChanges);
      }

      toast({
        title: "Changes saved",
        description: "User settings have been updated successfully.",
      });

      // Invalidate cache to force role detection refresh
      invalidateUserRole(profile.user_id);

      // Clear pending changes
      setAdminChanges({});
      setProfessionalChanges({});
      setPermissionChanges({});

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
                {(profile.full_name || profile.email || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">
                  {profile.full_name || 'Unnamed User'}
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
              {isClinical ? (
                <Stethoscope className="h-3 w-3 text-primary" />
              ) : (
                <Briefcase className="h-3 w-3 text-muted-foreground" />
              )}
              <Badge 
                variant={isClinical ? "default" : "secondary"} 
                className="text-xs"
              >
                {displayRole}
              </Badge>
            </div>
            {isClinical && !licensesLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {primaryLicense && (
                  <span>{primaryLicense.state} - {primaryLicense.license_type}</span>
                )}
                {activeLicenses.length > 1 && (
                  <Badge variant="outline" className="text-xs">
                    +{activeLicenses.length - 1} more
                  </Badge>
                )}
                {expiredLicenses.length > 0 && (
                  <Badge variant="destructive" className="text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {expiredLicenses.length} expired
                  </Badge>
                )}
              </div>
            )}
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
            
            {/* Administrator Settings - Only for staff */}
            {profile.role === 'staff' && clinician && (
              <AdminSettings
                isAdmin={clinician.is_admin || false}
                onChange={handleAdminChange}
              />
            )}

            {/* Professional Settings - Only for staff */}
            {profile.role === 'staff' && (
              <ProfessionalSettings
                userId={profile.user_id}
                onDataChange={handleProfessionalDataChange}
              />
            )}
            
            {/* Permissions - Only for staff */}
            {profile.role === 'staff' && (
              <PermissionSettings
                userId={profile.user_id}
                userPermissions={userPermissions}
                onPermissionUpdate={onPermissionUpdate}
                onDataChange={handlePermissionDataChange}
              />
            )}

            {/* License Summary for Clinical Staff */}
            {isClinical && !licensesLoading && activeLicenses.length > 0 && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium text-sm">Active Licenses</h4>
                <div className="space-y-2">
                  {activeLicenses.map((license) => {
                    const isExpired = isPast(new Date(license.expiration_date));
                    const expirationDate = format(new Date(license.expiration_date), 'MMM dd, yyyy');
                    
                    return (
                      <div key={license.id} className="flex items-center justify-between text-sm p-2 bg-background rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant={license.is_primary ? 'default' : 'outline'} className="text-xs">
                            {license.state}
                          </Badge>
                          <span className="text-muted-foreground">{license.license_type}</span>
                          <span className="text-xs text-muted-foreground">#{license.license_number}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isExpired ? (
                            <Badge variant="destructive" className="text-xs flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Expired {expirationDate}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Exp: {expirationDate}
                            </span>
                          )}
                          {license.is_primary && (
                            <Badge variant="outline" className="text-xs">Primary</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Action Buttons - Only for staff */}
            {profile.role === 'staff' && (
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