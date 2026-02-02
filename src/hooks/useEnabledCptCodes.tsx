import { useSupabaseQuery } from "@/hooks/data/useSupabaseQuery";
import { useAuth } from "@/hooks/useAuth";

export interface EnabledCptCode {
  id: string;              // tenant_cpt_codes.id
  cpt_code_id: string;     // FK to cpt_codes
  code: string;            // cpt_codes.code (e.g., "90834")
  description: string;     // cpt_codes.description
  custom_rate: number | null; // Whole dollars (e.g., 150)
}

interface TenantCptCodeWithJoin {
  id: string;
  cpt_code_id: string;
  custom_rate: number | null;
  cpt_codes: {
    code: string;
    description: string;
  };
}

/**
 * Hook to fetch enabled CPT codes for the tenant with joined code/description.
 * Used in SessionNoteDialog for billing code selection.
 */
export function useEnabledCptCodes() {
  const { tenantId } = useAuth();

  const { data, loading, error, refetch } = useSupabaseQuery<TenantCptCodeWithJoin>({
    table: "tenant_cpt_codes",
    select: "id, cpt_code_id, custom_rate, cpt_codes(code, description)",
    filters: tenantId ? { tenant_id: tenantId, is_enabled: true } : undefined,
    orderBy: { column: "cpt_code_id", ascending: true },
    enabled: !!tenantId,
  });

  // Transform to flat structure for easier consumption
  const enabledCptCodes: EnabledCptCode[] = (data || [])
    .map((item) => ({
      id: item.id,
      cpt_code_id: item.cpt_code_id,
      code: item.cpt_codes?.code || "",
      description: item.cpt_codes?.description || "",
      custom_rate: item.custom_rate,
    }))
    .filter((item) => item.code) // Filter out any with missing code
    .sort((a, b) => a.code.localeCompare(b.code)); // Sort by CPT code

  return {
    enabledCptCodes,
    loading,
    error,
    refetch,
  };
}
