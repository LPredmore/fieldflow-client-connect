import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, User } from "lucide-react";
import { useProfiles } from "@/hooks/useProfiles";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { UserPermissions } from "@/utils/permissionUtils";
import { UserTable } from "./UserManagement/UserTable";
import { UserRow } from "./UserManagement/UserRow";
import { AddStaffDialog } from "./UserManagement/AddStaffDialog";
import { LicenseManagementTable } from "./UserManagement/LicenseManagementTable";
import { ArchivedUsersView } from "./UserManagement/ArchivedUsersView";
import { RoleSyncDashboard } from "./UserManagement/RoleSyncDashboard";
import { supabase } from '@/integrations/supabase/client';

export default function UserManagement() {
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, UserPermissions | null>>({});
  const { profiles, loading, updateProfile, refetchProfiles, archiveUser, restoreUser } = useProfiles();
  const { user: currentUser } = useAuth();
  const { refetchPermissions } = usePermissions();

  // Filter to only show active staff members
  const activeStaffProfiles = useMemo(() => {
    return profiles.filter(p => p.role === 'staff' && !p.archived);
  }, [profiles]);

  const handleRoleChange = async (profileId: string, newRole: 'staff' | 'client') => {
    setUpdatingUser(profileId);
    
    try {
      await updateProfile(profileId, { role: newRole });
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleToggleExpanded = (userId: string) => {
    setExpandedUser(expandedUser === userId ? null : userId);
  };

  const fetchUserPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('access_appointments, access_services, access_invoicing, access_forms, supervisor')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error) {
        setUserPermissions(prev => ({ ...prev, [userId]: data }));
      } else if (error.code === 'PGRST116') {
        // No permissions found, set defaults
        setUserPermissions(prev => ({ 
          ...prev, 
          [userId]: {
            access_appointments: false,
            access_services: false,
            access_invoicing: false,
            access_forms: false,
            supervisor: false
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching user permissions:', error);
    }
  };

  const handlePermissionUpdate = () => {
    // Refetch permissions for all users
    profiles.forEach(profile => {
      fetchUserPermissions(profile.id);
    });
  };

  const handleArchiveUser = async (profileId: string) => {
    await archiveUser(profileId);
  };

  const handleRestoreUser = async (profileId: string) => {
    await restoreUser(profileId);
  };

  // Fetch permissions for expanded user - use user_id from profile
  useEffect(() => {
    if (expandedUser) {
      const profile = activeStaffProfiles.find(p => p.id === expandedUser);
      if (profile?.user_id) {
        fetchUserPermissions(profile.user_id);
      }
    }
  }, [expandedUser, activeStaffProfiles]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Staff */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Management</CardTitle>
          <CardDescription>
            Add new staff members to your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddStaffDialog onSuccess={refetchProfiles} />
        </CardContent>
      </Card>

      {/* Team Members with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Manage staff roles and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="active">
                Active Staff ({activeStaffProfiles.length})
              </TabsTrigger>
              <TabsTrigger value="archived">
                Archived ({profiles.filter(p => p.archived && p.role === 'staff').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              {activeStaffProfiles.length === 0 ? (
                <div className="text-center py-8">
                  <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">No active staff members yet</p>
                  <p className="text-sm text-muted-foreground">
                    Invite staff to start building your team
                  </p>
                </div>
              ) : (
                <UserTable>
                  {activeStaffProfiles.map((profile) => {
                    const isCurrentUser = profile.id === currentUser?.id;
                    const isExpanded = expandedUser === profile.id;
                    
                    return (
                      <UserRow
                        key={profile.id}
                        profile={profile}
                        isCurrentUser={isCurrentUser}
                        isExpanded={isExpanded}
                        userPermissions={userPermissions[profile.id] || null}
                        updatingUser={updatingUser}
                        onToggleExpanded={() => handleToggleExpanded(profile.id)}
                        onRoleChange={handleRoleChange}
                        onPermissionUpdate={handlePermissionUpdate}
                        onArchive={handleArchiveUser}
                      />
                    );
                  })}
                </UserTable>
              )}
            </TabsContent>

            <TabsContent value="archived">
              <ArchivedUsersView 
                profiles={profiles}
                onRestore={handleRestoreUser}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* License Management */}
      <LicenseManagementTable />

      {/* Role Sync Dashboard */}
      <RoleSyncDashboard />

      {/* Explanation Note */}
      <Card>
        <CardContent className="p-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Click the arrow next to a user's name to expand and manage their specific permissions. 
              Clinical staff provide direct patient care, while Non-Office staff handle administrative tasks. 
              Admins have full access to all business settings and can manage other team members.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}