import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

type Tenant = Database['public']['Tables']['tenants']['Row'];

export function useTenantBranding() {
  const { tenantId } = useAuth();

  const { data, loading, error } = useSupabaseQuery<Tenant>({
    table: 'tenants',
    select: 'id, display_name, logo_url, brand_primary_color, brand_secondary_color, brand_accent_color',
    filters: { id: tenantId },
    enabled: !!tenantId,
  });

  return {
    displayName: data?.[0]?.display_name || null,
    logoUrl: data?.[0]?.logo_url || null,
    brandColors: {
      primary: data?.[0]?.brand_primary_color || null,
      secondary: data?.[0]?.brand_secondary_color || null,
      accent: data?.[0]?.brand_accent_color || null,
    },
    loading,
    error,
  };
}
