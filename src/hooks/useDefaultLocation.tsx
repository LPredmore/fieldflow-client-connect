import { useSupabaseQuery } from "@/hooks/data/useSupabaseQuery";
import { useAuth } from "@/hooks/useAuth";

export interface DefaultLocation {
  id: string;
  name: string;
}

/**
 * Hook to fetch the tenant's default practice location.
 * Used to populate location_id and location_name when creating appointments.
 */
export function useDefaultLocation() {
  const { tenantId } = useAuth();

  const { data, loading, error } = useSupabaseQuery<DefaultLocation>({
    table: "practice_locations",
    select: "id, name",
    filters: tenantId ? { tenant_id: tenantId, is_default: true } : undefined,
    enabled: !!tenantId,
  });

  // Return the first (and should be only) default location
  const defaultLocation = data?.[0] || null;

  return {
    defaultLocation,
    loading,
    error,
  };
}
