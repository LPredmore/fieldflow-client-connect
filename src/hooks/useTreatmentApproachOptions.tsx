import { useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';

interface TreatmentApproach {
  id: number;
  created_at: string;
  approaches: string | null;
  specialty: string | null;
}

interface UseTreatmentApproachOptionsProps {
  specialty: string | null | undefined;
}

interface UseTreatmentApproachOptionsResult {
  options: string[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch treatment approach options from the treatment_approaches reference table.
 * Filters by specialty (prov_field) to show only relevant approaches.
 * 
 * Database schema:
 * - id: bigint (auto-increment)
 * - created_at: timestamptz
 * - approaches: text (the approach name)
 * - specialty: specialty_enum ('Mental Health', 'Speech Therapy', 'Occupational Therapy')
 */
export function useTreatmentApproachOptions({ 
  specialty 
}: UseTreatmentApproachOptionsProps): UseTreatmentApproachOptionsResult {
  // Build filters - only filter by specialty if provided
  const filters = useMemo(() => {
    if (!specialty) return undefined;
    return { specialty };
  }, [specialty]);

  const {
    data,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<TreatmentApproach>({
    table: 'treatment_approaches',
    select: 'id, approaches, specialty',
    filters,
    enabled: !!specialty, // Only fetch when specialty is available
    orderBy: { column: 'approaches', ascending: true },
  });

  // Extract approach names, filter out nulls, and deduplicate
  const options = useMemo(() => {
    if (!data) return [];
    
    const approaches = data
      .map(item => item.approaches)
      .filter((approach): approach is string => approach !== null && approach.trim() !== '')
      .sort((a, b) => a.localeCompare(b));
    
    // Deduplicate
    return [...new Set(approaches)];
  }, [data]);

  return {
    options,
    loading,
    error,
    refetch,
  };
}
