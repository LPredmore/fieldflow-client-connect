import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useSupabaseUpdate } from '@/hooks/data/useSupabaseMutation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  role: 'staff' | 'client';
  parent_admin_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string | null;
  archived: boolean | null;
  archived_at: string | null;
  archived_by_user_id: string | null;
}

export interface ProfileUpdateData {
  id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  role?: 'staff' | 'client';
  avatar_url?: string;
}

export function useProfiles() {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();

  // Query profiles with tenant filtering (RLS policies handle access control)
  const {
    data: profiles,
    loading,
    error,
    refetch: refetchProfiles,
  } = useSupabaseQuery<Profile>({
    table: 'profiles',
    select: '*',
    filters: {
      tenant_id: tenantId,
    },
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!user && !!tenantId,
    onError: (error) => {
      console.error('Error loading profiles:', error);
    },
  });

  const {
    mutate: updateProfileMutation,
    loading: updateLoading,
    error: updateError,
  } = useSupabaseUpdate<Partial<Profile>>({
    table: 'profiles',
    onSuccess: () => {
      refetchProfiles();
    },
    successMessage: 'Profile updated successfully',
  });

  const updateProfile = async (profileId: string, updates: Partial<Profile>) => {
    return updateProfileMutation({ id: profileId, ...updates });
  };

  const archiveUser = async (profileId: string) => {
    if (!user || !tenantId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Authentication required to archive users.",
      });
      return { error: "Not authenticated" };
    }

    try {
      const profileToArchive = profiles?.find(p => p.id === profileId);
      if (!profileToArchive) {
        throw new Error("Profile not found");
      }

      // Update profile to mark as archived
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
          archived_by_user_id: user.id,
        })
        .eq('id', profileId);

      if (updateError) throw updateError;

      // Delete from auth.users (removes login capability)
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(
        profileToArchive.user_id
      );

      if (deleteAuthError) {
        console.error("Error deleting auth user:", deleteAuthError);
        // Continue anyway - the user is marked as archived
      }

      await refetchProfiles();

      toast({
        title: "User archived",
        description: "User has been archived and can no longer log in. All data has been preserved.",
      });
      
      return { error: null };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error archiving user",
        description: error.message || "Failed to archive user. Please try again.",
      });
      return { error };
    }
  };

  const restoreUser = async (profileId: string, newEmail?: string) => {
    if (!user || !tenantId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Authentication required to restore users.",
      });
      return { error: "Not authenticated" };
    }

    try {
      const profileToRestore = profiles?.find(p => p.id === profileId);
      if (!profileToRestore) {
        throw new Error("Profile not found");
      }

      const emailToUse = newEmail || profileToRestore.email || '';
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

      // Create new auth user
      const { data: authData, error: createAuthError } = await supabase.auth.admin.createUser({
        email: emailToUse,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          restored: true,
          original_profile_id: profileId,
        }
      });

      if (createAuthError) throw createAuthError;

      // Update profile to unarchive and link to new auth user
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          archived: false,
          archived_at: null,
          archived_by_user_id: null,
          user_id: authData.user.id,
          email: emailToUse,
        })
        .eq('id', profileId);

      if (updateError) throw updateError;

      // Send password reset email
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailToUse, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (resetError) {
        console.error("Error sending password reset:", resetError);
      }

      await refetchProfiles();

      toast({
        title: "User restored",
        description: `User has been restored. A password reset email has been sent to ${emailToUse}.`,
      });
      
      return { error: null, tempPassword };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error restoring user",
        description: error.message || "Failed to restore user. Please try again.",
      });
      return { error };
    }
  };

  const inviteUser = async (email: string) => {
    if (!user || !tenantId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Authentication required to invite users.",
      });
      return { error: "Not authenticated" };
    }

    try {
      // First, check if user already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .single();

      if (existingProfile) {
        toast({
          variant: "destructive",
          title: "User already exists",
          description: "This email is already registered in the system.",
        });
        return { error: "User already exists" };
      }

      // Create a temporary password for the contractor
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
      
      // Sign up the staff member
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: tempPassword,
        options: {
          data: {
            user_type: 'staff',
            inviter_tenant_id: tenantId,
            is_clinician: true, // Default to clinician for backward compatibility
          }
        }
      });

      if (signUpError) {
        toast({
          variant: "destructive",
          title: "Error creating user",
          description: signUpError.message,
        });
        return { error: signUpError };
      }

      // Profile and clinician records are created by the handle_client_signup trigger

      // Refresh profiles to show the new user
      await refetchProfiles();

      toast({
        title: "Staff member invited successfully",
        description: `${email} has been added as a staff member. They can sign in with the temporary password: ${tempPassword}`,
      });
      
      return { error: null, tempPassword };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error inviting user",
        description: "Failed to invite user. Please try again.",
      });
      return { error };
    }
  };

  return {
    profiles,
    loading: loading || updateLoading,
    error: error || updateError,
    updateProfile,
    inviteUser,
    archiveUser,
    restoreUser,
    refetchProfiles,
  };
}