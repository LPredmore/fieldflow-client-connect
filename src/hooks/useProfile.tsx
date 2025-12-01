import { useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useSupabaseUpdate } from '@/hooks/data/useSupabaseMutation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Profile {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  role: 'business_admin' | 'contractor';
  parent_admin_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string | null;
}

interface PersonalInfo {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
}

export function useProfile() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Query current user's profile
  const {
    data: profileArray,
    loading: queryLoading,
    error: queryError,
    refetch: refetchProfile,
  } = useSupabaseQuery<Profile>({
    table: 'profiles',
    filters: {
      user_id: user?.id,
    },
    enabled: !!user,
    onError: (error) => {
      console.error('Error loading profile:', error);
    },
  });

  // Extract single profile record
  const profile = useMemo(() => {
    if (profileArray?.length > 0) {
      // Sync email with auth user email
      const profileData = profileArray[0];
      return {
        ...profileData,
        email: user?.email || profileData.email,
      };
    }
    return null;
  }, [profileArray, user?.email]);

  // Update profile mutation
  const {
    mutate: updateProfileMutation,
    loading: updateLoading,
    error: updateError,
  } = useSupabaseUpdate<Partial<Profile>>({
    table: 'profiles',
    onSuccess: () => {
      refetchProfile();
    },
  });

  const updatePersonalInfo = async (personalInfo: PersonalInfo) => {
    if (!user || !profile) {
      return { error: { message: "User not authenticated" } };
    }

    // Combine first and last name for full_name
    const full_name = `${personalInfo.first_name} ${personalInfo.last_name}`.trim();

    // Update profile with names
    const profileResult = await updateProfileMutation({
      id: user.id,
      first_name: personalInfo.first_name,
      last_name: personalInfo.last_name,
      full_name: full_name,
      phone: personalInfo.phone,
    });

    if (profileResult.error) {
      return profileResult;
    }

    // Update email if it changed
    if (personalInfo.email !== profile.email) {
      const emailResult = await updateEmail(personalInfo.email);
      if (emailResult.error) {
        return emailResult;
      }
    }

    toast({
      title: "Profile updated",
      description: "Your personal information has been updated successfully.",
    });

    return { error: null };
  };

  const updateEmail = async (newEmail: string) => {
    if (!user || !profile) {
      return { error: { message: "User not authenticated" } };
    }

    try {
      // First update the auth email
      const { error: authError } = await supabase.auth.updateUser({
        email: newEmail
      });

      if (authError) {
        return { error: authError };
      }

      // Then update the profile email
      const result = await updateProfileMutation({
        id: user.id,
        email: newEmail,
      });

      if (!result.error) {
        toast({
          title: "Email updated",
          description: "Your email address has been updated successfully. Please check your new email for confirmation.",
        });
      }

      return result;
    } catch (error: any) {
      return { error };
    }
  };

  const updatePassword = async (newPassword: string) => {
    if (!user) {
      return { error: { message: "User not authenticated" } };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return { error };
      }

      toast({
        title: "Password updated",
        description: "Your password has been updated successfully.",
      });

      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  // Custom refetch function to maintain API compatibility
  const fetchCurrentUserProfile = async () => {
    return refetchProfile();
  };

  return {
    profile,
    loading: queryLoading || updateLoading,
    error: queryError || updateError,
    updatePersonalInfo,
    updateEmail,
    updatePassword,
    refetchProfile: fetchCurrentUserProfile,
  };
}
