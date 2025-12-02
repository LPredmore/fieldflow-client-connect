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
  prov_title?: string | null;
  prov_field?: string | null;
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
  prov_accepting_new_clients?: 'Yes' | 'No' | null;
  created_at: string;
  updated_at: string;
}

interface StaffUpdateData {
  prov_name_f?: string;
  prov_name_l?: string;
  prov_name_m?: string;
  prov_title?: string;
  prov_license_type?: string;
  prov_license_number?: string;
  prov_npi?: string;
  prov_taxonomy?: string;
  prov_treatment_approaches?: string[];
  prov_bio?: string;
  prov_image_url?: string;
  prov_min_client_age?: number;
  prov_accepting_new_clients?: 'Yes' | 'No';
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
