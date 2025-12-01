import { useEffect, useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useSupabaseUpdate } from '@/hooks/data/useSupabaseMutation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Clinician {
  id: string;
  user_id: string;
  tenant_id: string;
  clinician_bio?: string;
  clinician_treatment_approaches?: string[];
  clinician_min_client_age?: number;
  clinician_accepting_new_clients?: 'Yes' | 'No';
  clinician_field?: string | null;
  clinician_license_type?: string;
  clinician_license_number?: string;
  clinician_taxonomy_code?: string;
  prov_name_f?: string;
  prov_name_last?: string;
  prov_npi?: string;
  prov_taxonomy?: string;
  clinician_image_url?: string;
  clinician_licensed_states?: string[];
  clinician_licenses_detailed?: Array<{
    state: string;
    licenseType: string;
    licenseNumber: string;
    isPrimary: boolean;
  }>;
  clinician_status?: 'New' | 'Active' | 'Inactive' | 'On Leave';
  clinician_temppassword?: string;
  created_at: string;
  updated_at: string;
}

interface ClinicianUpdateData {
  clinician_licensed_states?: string[];
  clinician_licenses_detailed?: Array<{
    state: string;
    licenseType: string;
    licenseNumber: string;
    isPrimary: boolean;
  }>;
  clinician_bio?: string;
  prov_name_f?: string;
  prov_name_last?: string;
  clinician_treatment_approaches?: string[];
  clinician_min_client_age?: number;
  clinician_accepting_new_clients?: 'Yes' | 'No';
  clinician_license_type?: string;
  clinician_license_number?: string;
  prov_npi?: string;
  clinician_taxonomy_code?: string;
  clinician_image_url?: string;
}

export function useClinician() {
  const { user } = useAuth();
  const { toast } = useToast();

  const {
    data: clinicianArray,
    loading: queryLoading,
    error: queryError,
    refetch: refetchClinician,
  } = useSupabaseQuery<Clinician>({
    table: 'clinicians',
    filters: {
      user_id: user?.id,
    },
    enabled: !!user,
    onError: (error) => {
      console.error('Error loading clinician data:', error);
    },
  });

  const clinician = useMemo(() => {
    if (clinicianArray && clinicianArray.length > 0) {
      const rawClinician = clinicianArray[0];
      
      // Defensive: Transform legacy array clinician_field to string
      if (rawClinician && Array.isArray(rawClinician.clinician_field)) {
        console.warn('⚠️ [useClinician] Detected array clinician_field, converting to string:', rawClinician.clinician_field);
        return {
          ...rawClinician,
          clinician_field: rawClinician.clinician_field[0] || null,
        };
      }
      
      return rawClinician;
    }
    return null;
  }, [clinicianArray]);

  const {
    mutate: updateClinicianMutation,
    loading: updateLoading,
    error: updateError,
  } = useSupabaseUpdate<Partial<Clinician>>({
    table: 'clinicians',
    onSuccess: () => {
      refetchClinician();
      toast({
        title: "Clinician profile updated",
        description: "Your clinician information has been updated successfully.",
      });
    },
  });

  const updateClinicianInfo = async (data: ClinicianUpdateData) => {
    if (!user || !clinician) {
      return { error: { message: "User not authenticated or no clinician record found" } };
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
    updateClinicianInfo,
    refetchClinician,
  };
}
