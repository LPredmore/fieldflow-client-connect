import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useSupabaseInsert, useSupabaseUpdate } from '@/hooks/data/useSupabaseMutation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/types/database';

type Settings = Database['public']['Tables']['settings']['Row'];
type SettingsInsert = Database['public']['Tables']['settings']['Insert'];

export { type Settings };

export function useSettings() {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[DEPRECATED] useSettings() queries non-existent "settings" table. Use useTenantBranding() for logo/name or useBusinessProfile() for business data.');
  }

  const { user, tenantId, isAdmin } = useAuth();
  const { toast } = useToast();

  // Query for settings (single record per tenant)
  const {
    data: settingsArray,
    loading: queryLoading,
    error: queryError,
    refetch: refetchSettings,
  } = useSupabaseQuery<Settings>({
    table: 'settings',
    filters: {
      tenant_id: 'auto', // Auto-apply tenant filter
    },
    enabled: !!user && !!tenantId,
    onError: (error) => {
      console.error('Error loading settings:', error);
    },
  });

  // Extract single settings record (should only be one per tenant)
  const settings = settingsArray?.length > 0 ? settingsArray[0] : null;

  // Only show loading if we have no data AND we're actually loading
  // This prevents showing loading spinner when serving from cache
  const isInitialLoading = queryLoading && !settings;

  // Create settings mutation
  const {
    mutate: createSettingsMutation,
    loading: createLoading,
    error: createError,
  } = useSupabaseInsert<SettingsInsert>({
    table: 'settings',
    onSuccess: () => {
      refetchSettings();
    },
    successMessage: 'Settings created successfully',
    onError: (error) => {
      if (!isAdmin) {
        toast({
          variant: "destructive",
          title: "Access denied",
          description: "Only business administrators can create settings.",
        });
      }
    },
  });

  // Update settings mutation
  const {
    mutate: updateSettingsMutation,
    loading: updateLoading,
    error: updateError,
  } = useSupabaseUpdate<Partial<Settings>>({
    table: 'settings',
    onSuccess: () => {
      refetchSettings();
    },
    successMessage: 'Settings updated successfully',
    onError: (error) => {
      if (!isAdmin) {
        toast({
          variant: "destructive",
          title: "Access denied",
          description: "Only business administrators can update settings.",
        });
      }
    },
  });

  const createSettings = async (settingsData: Partial<Settings>) => {
    if (!isAdmin) {
      toast({
        variant: "destructive",
        title: "Access denied",
        description: "Only business administrators can create settings.",
      });
      return { error: 'Insufficient permissions' };
    }

    return createSettingsMutation(settingsData as SettingsInsert);
  };

  const updateSettings = async (settingsData: Partial<Settings>) => {
    if (!isAdmin) {
      toast({
        variant: "destructive",
        title: "Access denied",
        description: "Only business administrators can update settings.",
      });
      return { error: 'Insufficient permissions' };
    }

    if (!settings) {
      return { error: 'No settings found to update' };
    }

    // Update settings table
    const result = await updateSettingsMutation({ id: settings.id, ...settingsData });

    // If business_name or logo_url changed, cascade to all profiles in tenant
    if (result && !result.error && (settingsData.business_name || settingsData.logo_url)) {
      const profileUpdates: { company_name?: string; avatar_url?: string } = {};
      
      if (settingsData.business_name) {
        profileUpdates.company_name = settingsData.business_name;
      }
      if (settingsData.logo_url) {
        profileUpdates.avatar_url = settingsData.logo_url;
      }

      // Update all profiles in the tenant
      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('tenant_id', tenantId);

      if (profileError) {
        console.error('Error updating team profiles:', profileError);
        toast({
          variant: "destructive",
          title: "Partial success",
          description: "Settings updated but team profiles may not have synced.",
        });
      } else {
        toast({
          title: "Success",
          description: "Settings and team profiles updated successfully",
        });
      }
    }

    return result;
  };

  return {
    settings,
    loading: isInitialLoading || createLoading || updateLoading,
    error: queryError || createError || updateError,
    updateSettings,
    createSettings,
    refetchSettings,
  };
}