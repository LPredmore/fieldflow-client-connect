import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from '@/hooks/data/useSupabaseMutation';
import { useAuth } from '@/hooks/useAuth';

export interface ClinicianLicense {
  id: string;
  clinician_id: string;
  tenant_id: string;
  state: string;
  license_type: string;
  license_number: string;
  issue_date: string | null;
  expiration_date: string;
  is_primary: boolean;
  is_active: boolean;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  verified_by_user_id: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicianLicenseInsert {
  clinician_id: string;
  tenant_id: string;
  state: string;
  license_type: string;
  license_number: string;
  issue_date?: string;
  expiration_date: string;
  is_primary?: boolean;
  is_active?: boolean;
}

export function useClinicianLicenses(clinicianId?: string) {
  const { user } = useAuth();

  const {
    data: licenses,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<ClinicianLicense>({
    table: 'clinician_licenses',
    select: '*',
    filters: clinicianId ? { clinician_id: clinicianId } : {},
    enabled: !!clinicianId,
    orderBy: { column: 'is_primary', ascending: false },
  });

  const { mutate: insertLicense, loading: inserting } = useSupabaseInsert<ClinicianLicenseInsert>({
    table: 'clinician_licenses',
    onSuccess: () => refetch(),
  });

  const { mutate: updateLicense, loading: updating } = useSupabaseUpdate({
    table: 'clinician_licenses',
    onSuccess: () => refetch(),
  });

  const { mutate: deleteLicense, loading: deleting } = useSupabaseDelete({
    table: 'clinician_licenses',
    onSuccess: () => refetch(),
  });

  return {
    licenses,
    loading,
    error,
    refetch,
    insertLicense,
    updateLicense,
    deleteLicense,
    saving: inserting || updating || deleting,
  };
}
