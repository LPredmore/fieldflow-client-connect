import { useEffect } from 'react';
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

  const logoUrl = data?.[0]?.logo_url || null;
  const displayName = data?.[0]?.display_name || null;

  // Dynamically update document title when tenant name changes
  useEffect(() => {
    if (!displayName) return;
    document.title = displayName;
    return () => {
      document.title = 'Loading...';
    };
  }, [displayName]);

  // Dynamically update favicon when tenant logo changes
  useEffect(() => {
    if (!logoUrl) return;

    // Find existing favicon link or create one
    let faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      document.head.appendChild(faviconLink);
    }

    // Store original favicon for cleanup
    const originalHref = faviconLink.href;

    // Update favicon to tenant logo
    faviconLink.href = logoUrl;

    // Cleanup: restore original favicon when component unmounts
    return () => {
      if (faviconLink) {
        faviconLink.href = originalHref || '/favicon.ico';
      }
    };
  }, [logoUrl]);

  return {
    displayName: data?.[0]?.display_name || null,
    logoUrl,
    brandColors: {
      primary: data?.[0]?.brand_primary_color || null,
      secondary: data?.[0]?.brand_secondary_color || null,
      accent: data?.[0]?.brand_accent_color || null,
    },
    loading,
    error,
  };
}
