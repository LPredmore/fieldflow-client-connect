import { useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useSupabaseUpdate } from '@/hooks/data/useSupabaseMutation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface StaffMember {
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
  /**
   * @deprecated Use staff_licenses table for license management.
   * This field is retained for backward compatibility with claims processing (CMS-1500 forms).
   */
  prov_license_type?: string | null;
  /**
   * @deprecated Use staff_licenses table for license management.
   * This field is retained for backward compatibility with claims processing (CMS-1500 forms).
   */
  prov_license_number?: string | null;
  prov_npi?: string | null;
  prov_taxonomy?: string | null;
  prov_treatment_approaches?: string[] | null;
  prov_bio?: string | null;
  prov_image_url?: string | null;
  prov_min_client_age?: number | null;
  /** Boolean in database - convert to "Yes"/"No" for display only */
  prov_accepting_new_clients?: boolean | null;
  prov_time_zone?: string | null;
  created_at: string;
  updated_at: string;
}

interface StaffUpdateData {
  prov_name_f?: string;
  prov_name_l?: string;
  prov_name_m?: string;
  prov_name_for_clients?: string;
  prov_title?: string;
  prov_phone?: string;
  prov_addr_1?: string;
  prov_addr_2?: string;
  prov_city?: string;
  prov_state?: string;
  prov_zip?: string;
  prov_license_type?: string;
  prov_license_number?: string;
  prov_npi?: string;
  prov_taxonomy?: string;
  prov_treatment_approaches?: string[];
  prov_bio?: string;
  prov_image_url?: string;
  prov_min_client_age?: number;
  /** Boolean in database */
  prov_accepting_new_clients?: boolean;
  prov_time_zone?: string;
}

export function useStaffData() {
  const { user } = useAuth();
  const { toast } = useToast();

  const {
    data: staffArray,
    loading: queryLoading,
    error: queryError,
    refetch: refetchStaff,
  } = useSupabaseQuery<StaffMember>({
    table: 'staff',
    filters: {
      profile_id: user?.id,
    },
    enabled: !!user,
    onError: (error) => {
      console.error('Error loading staff data:', error);
    },
  });

  const staff = useMemo(() => {
    if (staffArray && staffArray.length > 0) {
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
      toast({
        title: "Staff profile updated",
        description: "Your staff information has been updated successfully.",
      });
    },
  });

  const updateStaffInfo = async (data: StaffUpdateData) => {
    if (!user || !staff) {
      return { error: { message: "User not authenticated or no staff record found" } };
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
    updateStaffInfo,
    refetchStaff,
  };
}
