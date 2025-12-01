import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRoleCacheInvalidation } from '@/hooks/useRoleCacheInvalidation';

export interface License {
  licenseNumber: string;
  licenseType: string;
  state: string;
  issueDate?: string;
  expirationDate: string;
  isPrimary: boolean;
}

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
}

export interface RegistrationData {
  personalInfo: PersonalInfo;
  professionalDetails: ProfessionalDetails;
  licenses: License[];
  userId: string;
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

      // 1. Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: data.personalInfo.firstName,
          last_name: data.personalInfo.lastName,
          full_name: `${data.personalInfo.firstName} ${data.personalInfo.lastName}`,
          phone: data.personalInfo.phone,
          role: 'staff',
        })
        .eq('user_id', data.userId);

      if (profileError) throw profileError;

      // 2. Create/update clinician record
      const clinicianData = {
        user_id: data.userId,
        tenant_id: tenantId,
        is_clinician: data.professionalDetails.isClinician,
        clinician_status: data.professionalDetails.isClinician ? 'New' : 'Active',
        clinician_field: data.professionalDetails.clinicianField || null,
        prov_npi: data.professionalDetails.npiNumber || null,
        prov_taxonomy: data.professionalDetails.taxonomyCode || null,
        clinician_bio: data.professionalDetails.bio || null,
        clinician_min_client_age: data.professionalDetails.minClientAge || null,
        clinician_accepting_new_clients: data.professionalDetails.acceptingNewClients || null,
        prov_name_f: data.personalInfo.firstName,
        prov_name_last: data.personalInfo.lastName,
      };

      const { data: clinicianRecord, error: clinicianError } = await supabase
        .from('clinicians')
        .upsert(clinicianData, { onConflict: 'user_id' })
        .select()
        .single();

      if (clinicianError) throw clinicianError;

      // 3. Create license records (if clinician and has licenses)
      if (data.professionalDetails.isClinician && data.licenses.length > 0 && clinicianRecord) {
        const licenseRecords = data.licenses.map(license => ({
          clinician_id: clinicianRecord.id,
          tenant_id: tenantId,
          license_number: license.licenseNumber,
          license_type: license.licenseType,
          state: license.state,
          issue_date: license.issueDate || null,
          expiration_date: license.expirationDate,
          is_primary: license.isPrimary,
          is_active: true,
        }));

        const { error: licenseError } = await supabase
          .from('clinician_licenses')
          .insert(licenseRecords);

        if (licenseError) throw licenseError;
      }

      // 4. Update clinician status to Active after successful registration
      if (data.professionalDetails.isClinician && clinicianRecord) {
        const { error: statusError } = await supabase
          .from('clinicians')
          .update({ clinician_status: 'Active' })
          .eq('id', clinicianRecord.id);

        if (statusError) throw statusError;
      }

      // 5. Explicitly create user_roles entry for clinician role
      if (data.professionalDetails.isClinician && tenantId) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .upsert({
            user_id: data.userId,
            role: 'clinician',
            tenant_id: tenantId,
            granted_by_user_id: data.userId,
            is_active: true,
          }, {
            onConflict: 'user_id,role,tenant_id'
          });

        if (roleError) {
          console.error('Failed to create clinician role:', roleError);
          throw roleError;
        }
      }

      // 6. Invalidate cache to ensure new role is reflected
      invalidateUserRole(data.userId);

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
