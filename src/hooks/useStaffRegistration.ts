import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRoleCacheInvalidation } from '@/hooks/useRoleCacheInvalidation';

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface ProfessionalDetails {
  isClinician: boolean;
  clinicianField?: string;
  npiNumber?: string;
  taxonomyCode?: string;
  bio?: string;
  minClientAge?: number;
  acceptingNewClients?: 'Yes' | 'No';
  licenseType?: string;
  licenseNumber?: string;
}

export interface RegistrationData {
  personalInfo: PersonalInfo;
  professionalDetails: ProfessionalDetails;
  profileId: string;
}

export function useStaffRegistration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { tenantId } = useAuth();
  const { invalidateUserRole } = useRoleCacheInvalidation();

  const registerStaff = async (data: RegistrationData) => {
    setLoading(true);
    setError(null);

    try {
      if (!tenantId) {
        throw new Error('No tenant ID found');
      }

      // 1. Create tenant membership (if doesn't exist)
      const { error: membershipError } = await supabase
        .from('tenant_memberships')
        .upsert({
          tenant_id: tenantId,
          profile_id: data.profileId,
          tenant_role: 'member',
        }, {
          onConflict: 'tenant_id,profile_id'
        });

      if (membershipError) throw membershipError;

      // 2. Create user_roles entry for staff role
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: data.profileId,
          role: 'staff',
        }, {
          onConflict: 'user_id,role'
        });

      if (roleError) throw roleError;

      // 3. Create/update staff record
      const staffData = {
        tenant_id: tenantId,
        profile_id: data.profileId,
        prov_name_f: data.personalInfo.firstName,
        prov_name_l: data.personalInfo.lastName,
        prov_name_m: null,
        prov_title: data.professionalDetails.clinicianField || null,
        prov_npi: data.professionalDetails.npiNumber || null,
        prov_taxonomy: data.professionalDetails.taxonomyCode || null,
        prov_license_type: data.professionalDetails.licenseType || null,
        prov_license_number: data.professionalDetails.licenseNumber || null,
        prov_status: 'Active',
        prov_accepting_new_clients: data.professionalDetails.acceptingNewClients === 'Yes',
        prov_min_client_age: data.professionalDetails.minClientAge || null,
        prov_bio: data.professionalDetails.bio || null,
      };

      const { data: staffRecord, error: staffError } = await supabase
        .from('staff')
        .upsert(staffData, { onConflict: 'profile_id,tenant_id' })
        .select()
        .single();

      if (staffError) throw staffError;

      // 4. If clinician, create staff_role_assignments for clinical role
      if (data.professionalDetails.isClinician && staffRecord) {
        // First, get a clinical staff role
        const { data: clinicalRole, error: roleQueryError } = await supabase
          .from('staff_roles')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('is_clinical', true)
          .limit(1)
          .maybeSingle();

        if (roleQueryError) {
          console.error('Failed to find clinical role:', roleQueryError);
        } else if (clinicalRole) {
          // Assign clinical role
          const { error: assignmentError } = await supabase
            .from('staff_role_assignments')
            .upsert({
              staff_id: staffRecord.id,
              role_id: clinicalRole.id,
              tenant_id: tenantId,
            }, {
              onConflict: 'staff_id,role_id'
            });

          if (assignmentError) {
            console.error('Failed to assign clinical role:', assignmentError);
          }
        }
      }

      // 5. Invalidate cache to ensure new role is reflected
      invalidateUserRole(data.profileId);

      setLoading(false);
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Registration failed';
      setError(errorMessage);
      setLoading(false);
      return { error: errorMessage };
    }
  };

  return {
    loading,
    error,
    registerStaff,
    register: registerStaff, // Alias for backward compatibility
  };
}
