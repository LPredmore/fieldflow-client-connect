import { useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useSupabaseUpdate } from '@/hooks/data/useSupabaseMutation';

interface Clinician {
  id: string;
  user_id: string;
  tenant_id: string;
  is_clinician: boolean;
  is_admin: boolean;
  clinician_status?: string;
  clinician_license_type?: string;
  clinician_license_number?: string;
  prov_npi?: string;
  prov_taxonomy?: string;
  clinician_taxonomy_code?: string;
  prov_name_f?: string;
  prov_name_last?: string;
  clinician_accepting_new_clients?: string;
  [key: string]: any;
}

interface UseClinicianProfileOptions {
  userId: string | undefined;
}

export function useClinicianProfile({ userId }: UseClinicianProfileOptions) {
  const {
    data: clinicianArray,
    loading: queryLoading,
    error: queryError,
    refetch: refetchClinician,
  } = useSupabaseQuery<Clinician>({
    table: 'clinicians',
    filters: {
      user_id: userId,
    },
    enabled: !!userId,
  });

  const clinician = useMemo(() => {
    if (clinicianArray?.length > 0) {
      const clinicianData = clinicianArray[0];
      
      // ⚠️ DEPRECATION WARNING for is_admin and is_clinician fields
      if (process.env.NODE_ENV === 'development' && (clinicianData.is_admin !== undefined || clinicianData.is_clinician !== undefined)) {
        console.warn(
          '[DEPRECATED] useClinicianProfile: is_admin and is_clinician fields from clinicians table are LEGACY fields.',
          'These fields should NOT be used for authorization checks.',
          'Use user_roles table or UnifiedRoleDetectionService instead.',
          { userId: userId, legacyIsAdmin: clinicianData.is_admin, legacyIsClinician: clinicianData.is_clinician }
        );
      }
      
      return clinicianData;
    }
    return null;
  }, [clinicianArray, userId]);

  const {
    mutate: updateClinicianMutation,
    loading: updateLoading,
    error: updateError,
  } = useSupabaseUpdate<Partial<Clinician>>({
    table: 'clinicians',
    onSuccess: () => {
      refetchClinician();
    },
  });

  const updateClinicianProfile = async (data: Partial<Clinician>) => {
    if (!clinician) {
      return { error: { message: "No clinician record found" } };
    }

    const result = await updateClinicianMutation({
      id: clinician.id,
      ...data,
    });

    return result;
  };

  return {
    clinician,
    loading: queryLoading || updateLoading,
    error: queryError || updateError,
    updateClinicianProfile,
    refetchClinician,
  };
}
