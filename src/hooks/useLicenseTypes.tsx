import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';

// Match actual database schema for cliniclevel_license_types
type LicenseType = {
  id: string; // uuid in database
  license_code: string;
  license_label: string;
  specialty: string | null;
};

export function useLicenseTypes() {
  const { user } = useAuth();

  // Query for license types - this is reference data (not tenant-scoped)
  const {
    data: licenseTypes,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<LicenseType>({
    table: 'cliniclevel_license_types',
    // No filters - license types are shared reference data across all tenants
    enabled: !!user,
  });

  // Get unique specialties for dropdown
  const uniqueSpecialties = Array.from(
    new Set((licenseTypes ?? []).map((lt) => lt.specialty).filter(Boolean))
  ) as string[];

  return {
    licenseTypes,
    uniqueSpecialties,
    loading,
    error,
    refetch,
  };
}
