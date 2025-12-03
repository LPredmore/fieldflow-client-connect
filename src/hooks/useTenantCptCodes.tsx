import { useSupabaseQuery } from "@/hooks/data/useSupabaseQuery";
import { useAuth } from "@/hooks/useAuth";

export interface TenantCptCode {
  id: string;
  tenant_id: string;
  cpt_code_id: string;
  is_enabled: boolean;
  custom_rate: number | null;
  modifier: string[] | null;
}

export function useTenantCptCodes() {
  const { tenantId } = useAuth();

  const { data, loading, error, refetch } = useSupabaseQuery<TenantCptCode>({
    table: "tenant_cpt_codes",
    select: "id, tenant_id, cpt_code_id, is_enabled, custom_rate, modifier",
    filters: tenantId ? { tenant_id: tenantId } : undefined,
    enabled: !!tenantId,
  });

  return {
    tenantCptCodes: data,
    loading,
    error,
    refetch,
    tenantId,
  };
}
