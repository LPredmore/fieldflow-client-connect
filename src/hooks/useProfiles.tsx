import { useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useSupabaseUpdate } from '@/hooks/data/useSupabaseMutation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Profile {
  id: string; // This IS the user_id from auth.users
  email: string;
  email_verified: boolean | null;
  created_at: string;
  updated_at: string | null;
  is_active: boolean | null;
  last_login_at: string | null;
  // Computed from joins
  staff_data?: {
    prov_name_f: string | null;
    prov_name_l: string | null;
    prov_status: string | null;
  };
  display_name?: string;
}

export interface ProfileUpdateData {
  id: string;
  email?: string;
  email_verified?: boolean;
  is_active?: boolean;
}

export function useProfiles() {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();

  // Query profiles with staff data
  // Note: user_roles join removed - no explicit FK relationship between profiles and user_roles
  const {
    data: rawProfiles,
    loading,
    error,
    refetch: refetchProfiles,
  } = useSupabaseQuery<any>({
    table: 'profiles',
    select: `
      *,
      tenant_memberships!inner(tenant_id),
      staff(prov_name_f, prov_name_l, prov_status)
    `,
    filters: tenantId ? {
      'tenant_memberships.tenant_id': tenantId,
    } : {},
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!user && !!tenantId,
    onError: (error) => {
      console.error('Error loading profiles:', error);
    },
  });

  // Transform profiles to include computed display name
  const profiles = useMemo(() => {
    if (!rawProfiles) return [];
    return rawProfiles.map((p: any) => {
      const staffData = Array.isArray(p.staff) ? p.staff[0] : p.staff;
      const displayName = staffData?.prov_name_f && staffData?.prov_name_l
        ? `${staffData.prov_name_f} ${staffData.prov_name_l}`
        : p.email;
      
      return {
        ...p,
        staff_data: staffData,
        display_name: displayName,
      };
    });
  }, [rawProfiles]);

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
    toast({
      variant: "destructive",
      title: "Archive not supported",
      description: "User archiving is not available with the current schema.",
    });
    return { error: "Not supported" };
  };

  const restoreUser = async (profileId: string) => {
    toast({
      variant: "destructive",
      title: "Restore not supported",
      description: "User restoration is not available with the current schema.",
    });
    return { error: "Not supported" };
  };

  const inviteUser = async (email: string) => {
    // Simplified - just create auth user, triggers handle the rest
    if (!user || !tenantId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Authentication required to invite users.",
      });
      return { error: "Not authenticated" };
    }

    try {
      // Create a temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
      
      // Sign up the staff member
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: tempPassword,
        options: {
          data: {
            user_type: 'staff',
            inviter_tenant_id: tenantId,
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

      await refetchProfiles();

      toast({
        title: "Staff member invited successfully",
        description: `${email} has been added. They can sign in with: ${tempPassword}`,
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