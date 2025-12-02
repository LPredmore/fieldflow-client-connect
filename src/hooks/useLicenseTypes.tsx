import { useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';

// Match actual database schema for cliniclevel_license_types
export type LicenseType = {
  id: string; // uuid in database
  license_code: string;
  license_label: string;
  specialty: string | null;
};

interface UseLicenseTypesOptions {
  specialty?: string | null;
}

export function useLicenseTypes(options: UseLicenseTypesOptions = {}) {
  const { user } = useAuth();
  const { specialty } = options;

  // Query for license types - this is reference data (not tenant-scoped)
  const {
    data: allLicenseTypes,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<LicenseType>({
    table: 'cliniclevel_license_types',
    // No filters - license types are shared reference data across all tenants
    enabled: !!user,
  });

  // Filter by specialty if provided
  const licenseTypes = useMemo(() => {
    if (!allLicenseTypes) return [];
    if (!specialty) return allLicenseTypes;
    return allLicenseTypes.filter(lt => lt.specialty === specialty);
  }, [allLicenseTypes, specialty]);

  // Get unique specialties for dropdown
  const uniqueSpecialties = useMemo(() => {
    return Array.from(
      new Set((allLicenseTypes ?? []).map((lt) => lt.specialty).filter(Boolean))
    ) as string[];
  }, [allLicenseTypes]);

  return {
    licenseTypes,
    allLicenseTypes: allLicenseTypes ?? [],
    uniqueSpecialties,
    loading,
    error,
    refetch,
  };
}
