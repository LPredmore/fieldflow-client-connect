import { useMemo } from 'react';
import { useSupabaseQuery } from './data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';

interface Staff {
  id: string;
  prov_treatment_approaches: string | null;
  prov_specialty: string | null;
}

interface UseTreatmentApproachesOptions {
  specialty?: string | null;
}

export interface TreatmentApproachError {
  type: 'NETWORK_ERROR' | 'NO_DATA' | 'FILTER_ERROR';
  message: string;
  specialty?: string;
  timestamp: Date;
  originalError?: unknown;
}

interface UseTreatmentApproachesResult {
  approaches: string[];
  loading: boolean;
  error: TreatmentApproachError | null;
  refetch: () => Promise<void>;
  allApproaches: string[];
}

/**
 * Hook to fetch treatment approaches from staff.prov_treatment_approaches field
 * 
 * Treatment approaches are stored as comma-separated values in the staff table.
 * This hook reads from staff.prov_treatment_approaches and filters by specialty.
 */
export function useTreatmentApproaches(options: UseTreatmentApproachesOptions = {}): UseTreatmentApproachesResult {
  const { specialty } = options;
  const { tenantId } = useAuth();
  
  // Fetch all staff records with treatment approaches
  const { data: staffData, loading, error: rawError, refetch } = useSupabaseQuery<Staff>({
    table: 'staff',
    select: 'id, prov_treatment_approaches, prov_specialty',
    filters: {
      tenant_id: tenantId,
    },
    enabled: !!tenantId,
  });

  // Process error
  const error = useMemo(() => {
    if (!rawError) return null;
    
    const errorString = String(rawError).toLowerCase();
    let message: string;
    let type: 'NETWORK_ERROR' | 'NO_DATA' | 'FILTER_ERROR' = 'NO_DATA';
    
    if (errorString.includes('network') || 
        errorString.includes('fetch') || 
        errorString.includes('connection') ||
        errorString.includes('timeout') ||
        errorString.includes('offline')) {
      type = 'NETWORK_ERROR';
      message = 'Unable to connect to the server. Please check your internet connection and try again.';
    } else {
      message = 'An unexpected error occurred while loading treatment approaches. Please try again.';
    }
    
    console.error('[useTreatmentApproaches] Error:', {
      type,
      message,
      originalError: rawError,
      specialty,
    });
    
    return {
      type,
      message,
      specialty,
      timestamp: new Date(),
      originalError: rawError
    };
  }, [rawError, specialty]);

  // Extract all unique treatment approaches from staff records
  const allApproaches = useMemo(() => {
    if (!staffData) return [];
    
    const approachesSet = new Set<string>();
    
    staffData.forEach(staff => {
      if (staff.prov_treatment_approaches) {
        // Split by comma and trim whitespace
        const approaches = staff.prov_treatment_approaches
          .split(',')
          .map(approach => approach.trim())
          .filter(approach => approach.length > 0);
        
        approaches.forEach(approach => approachesSet.add(approach));
      }
    });
    
    return Array.from(approachesSet).sort((a, b) => a.localeCompare(b));
  }, [staffData]);

  // Filter approaches by specialty
  const approaches = useMemo(() => {
    if (!specialty || specialty === '' || loading || error) {
      return [];
    }
    
    if (!staffData) return [];
    
    const normalizedSpecialty = specialty.trim().toLowerCase();
    const approachesSet = new Set<string>();
    
    staffData.forEach(staff => {
      // Check if staff specialty matches
      if (staff.prov_specialty) {
        const normalizedStaffSpecialty = staff.prov_specialty.trim().toLowerCase();
        
        if (normalizedStaffSpecialty === normalizedSpecialty && staff.prov_treatment_approaches) {
          // Split and add approaches
          const approaches = staff.prov_treatment_approaches
            .split(',')
            .map(approach => approach.trim())
            .filter(approach => approach.length > 0);
          
          approaches.forEach(approach => approachesSet.add(approach));
        }
      }
    });
    
    const filtered = Array.from(approachesSet).sort((a, b) => a.localeCompare(b));
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[useTreatmentApproaches] Filtered approaches:', {
        specialty,
        filteredCount: filtered.length,
        totalStaff: staffData.length
      });
    }
    
    return filtered;
  }, [staffData, specialty, loading, error]);

  return {
    approaches,
    loading,
    error,
    refetch,
    allApproaches,
  };
}
