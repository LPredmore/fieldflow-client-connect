import { useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useSupabaseUpdate } from '@/hooks/data/useSupabaseMutation';

interface StaffMember {
  id: string;
  profile_id: string;
  tenant_id: string;
  prov_status?: string | null;
  prov_name_f?: string | null;
  prov_name_l?: string | null;
  prov_name_m?: string | null;
  prov_name_for_clients?: string | null;
  prov_title?: string | null;
  prov_field?: string | null;
  prov_phone?: string | null;
  prov_addr_1?: string | null;
  prov_addr_2?: string | null;
  prov_city?: string | null;
  prov_state?: string | null;
  prov_zip?: string | null;
  /** @deprecated Use staff_licenses table for license management. Retained for claims compatibility. */
  prov_license_type?: string | null;
  /** @deprecated Use staff_licenses table for license management. Retained for claims compatibility. */
  prov_license_number?: string | null;
  prov_npi?: string | null;
  prov_taxonomy?: string | null;
  prov_treatment_approaches?: string[] | null;
  prov_bio?: string | null;
  prov_image_url?: string | null;
  prov_min_client_age?: number | null;
  /** Boolean in database - convert to "Yes"/"No" for display only */
  prov_accepting_new_clients?: boolean | null;
}

interface UseStaffProfileOptions {
  profileId: string | undefined;
}

export function useStaffProfile({ profileId }: UseStaffProfileOptions) {
  const {
    data: staffArray,
    loading: queryLoading,
    error: queryError,
    refetch: refetchStaff,
  } = useSupabaseQuery<StaffMember>({
    table: 'staff',
    filters: {
      profile_id: profileId,
    },
    enabled: !!profileId,
  });

  const staff = useMemo(() => {
    if (staffArray?.length > 0) {
      return staffArray[0];
    }
    return null;
  }, [staffArray]);

  const {
    mutate: updateStaffMutation,
    loading: updateLoading,
    error: updateError,
  } = useSupabaseUpdate<Partial<StaffMember>>({
    table: 'staff',
    onSuccess: () => {
      refetchStaff();
    },
  });

  const updateStaffProfile = async (data: Partial<StaffMember>) => {
    if (!staff) {
      return { error: { message: "No staff record found" } };
    }

    const result = await updateStaffMutation({
      id: staff.id,
      ...data,
    });

    return result;
  };

  return {
    staff,
    loading: queryLoading || updateLoading,
    error: queryError || updateError,
    updateStaffProfile,
    refetchStaff,
  };
}
