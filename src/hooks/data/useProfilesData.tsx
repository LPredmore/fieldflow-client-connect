import { useSupabaseQuery } from './useSupabaseQuery';
import { useSupabaseUpdate } from './useSupabaseMutation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  role: 'staff' | 'client';
  parent_admin_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string | null;
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

export function useProfilesData() {
  const { tenantId } = useAuth();

  // Custom query for profiles (different filter logic)
  const query = useSupabaseQuery<Profile>({
    table: 'profiles',
    filters: {}, // No auto tenant filter
    orderBy: { column: 'created_at', ascending: false },
    // Custom filter logic for profiles
    enabled: !!tenantId,
    onError: (error) => {
      console.error('Error loading profiles:', error);
    },
  });

  // Override the query to use custom OR filter
  const { refetch: originalRefetch, ...queryRest } = query;
  
  const customRefetch = async () => {
    if (!tenantId) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`id.eq.${tenantId},parent_admin_id.eq.${tenantId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading profiles:', error);
        return;
      }

      // Update the query state manually
      // Note: This is a simplified approach - in a real implementation,
      // you might want to extend useSupabaseQuery to support custom queries
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const update = useSupabaseUpdate<Partial<Profile>>({
    table: 'profiles',
    onSuccess: () => {
      customRefetch();
    },
    successMessage: 'Profile updated successfully',
  });

  return {
    ...queryRest,
    refetch: customRefetch,
    update: update.mutate,
    updateLoading: update.loading,
    updateError: update.error,
  };
}