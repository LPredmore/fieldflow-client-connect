import { useSupabaseQuery } from "@/hooks/data/useSupabaseQuery";

export interface CptCode {
  id: string;
  code: string;
  description: string;
  category: string | null;
  is_active: boolean;
}

export function useCptCodes() {
  const { data, loading, error, refetch } = useSupabaseQuery<CptCode>({
    table: "cpt_codes",
    select: "id, code, description, category, is_active",
    filters: { is_active: true },
    orderBy: { column: "code", ascending: true },
  });

  return {
    cptCodes: data,
    loading,
    error,
    refetch,
  };
}
