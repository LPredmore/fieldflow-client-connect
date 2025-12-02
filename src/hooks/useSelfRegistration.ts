/**
 * Self-Registration Hook
 * For existing authenticated users to complete their staff profile.
 * This is different from useAddStaff which creates new users via admin.
 */

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';

type StateCodeEnum = Database['public']['Enums']['state_code_enum'];

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface LicenseEntry {
  state: string;
  licenseNumber: string;
  issuedOn?: string | null;
  expiresOn?: string | null;
}

export interface ProfessionalDetails {
  isStaff: boolean;
  npiNumber?: string;
  taxonomyCode?: string;
  bio?: string;
  minClientAge?: number;
  licenseType: string; // Required - primary license type (license_code from cliniclevel_license_types)
  licenses: LicenseEntry[]; // Required - at least one state license
}

export interface SelfRegistrationData {
  personalInfo: PersonalInfo;
  professionalDetails: ProfessionalDetails;
  profileId: string;
}

export function useSelfRegistration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { tenantId, refreshUserData } = useAuth();
  const queryClient = useQueryClient();

  const registerSelf = async (data: SelfRegistrationData) => {
    setLoading(true);
    setError(null);

    try {
      if (!tenantId) {
        throw new Error('No tenant ID found');
      }

      // 1. Upsert tenant membership
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

      // 2. Upsert user_roles entry for staff role
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: data.profileId,
          role: 'staff',
        }, {
          onConflict: 'user_id,role'
        });

      if (roleError) throw roleError;

      // 3. Create/update staff record (without legacy license fields)
      const staffData = {
        tenant_id: tenantId,
        profile_id: data.profileId,
        prov_name_f: data.personalInfo.firstName,
        prov_name_l: data.personalInfo.lastName,
        prov_npi: data.professionalDetails.npiNumber || null,
        prov_taxonomy: data.professionalDetails.taxonomyCode || null,
        prov_min_client_age: data.professionalDetails.minClientAge || null,
        prov_bio: data.professionalDetails.bio || null,
        prov_status: 'Active',  // Mark registration as complete
        // Store license_type on staff for quick reference (used in claims)
        prov_license_type: data.professionalDetails.licenseType || null,
      };

      const { data: staffRecord, error: staffError } = await supabase
        .from('staff')
        .upsert(staffData, { onConflict: 'profile_id,tenant_id' })
        .select()
        .single();

      if (staffError) throw staffError;

      // 4. Insert licenses into staff_licenses table
      if (staffRecord && data.professionalDetails.licenses.length > 0) {
        const licensesToInsert = data.professionalDetails.licenses.map(license => ({
          tenant_id: tenantId,
          staff_id: staffRecord.id,
          license_type: data.professionalDetails.licenseType,
          license_number: license.licenseNumber,
          license_state: license.state as StateCodeEnum,
          issue_date: license.issuedOn || null,
          expiration_date: license.expiresOn || null,
          is_active: true,
        }));

        const { error: licensesError } = await supabase
          .from('staff_licenses')
          .insert(licensesToInsert);

        if (licensesError) {
          console.error('Failed to insert licenses:', licensesError);
          // Don't throw - staff record was created, licenses can be added later
        }
      }

      // 5. If clinical staff, create staff_role_assignments for CLINICIAN role
      if (data.professionalDetails.isStaff && staffRecord) {
        // Get CLINICIAN role ID
        const { data: clinicianRole, error: roleQueryError } = await supabase
          .from('staff_roles')
          .select('id')
          .eq('code', 'CLINICIAN')
          .single();

        if (roleQueryError) {
          console.error('Failed to find CLINICIAN role:', roleQueryError);
        } else if (clinicianRole) {
          // Assign CLINICIAN role
          const { error: assignmentError } = await supabase
            .from('staff_role_assignments')
            .upsert({
              staff_id: staffRecord.id,
              staff_role_id: clinicianRole.id,
              tenant_id: tenantId,
            }, {
              onConflict: 'tenant_id,staff_id,staff_role_id'
            });

          if (assignmentError) {
            console.error('Failed to assign CLINICIAN role:', assignmentError);
          }
        }
      }

      // 6. Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff_licenses'] });

      // 7. Refresh auth context so routing logic gets updated prov_status
      await refreshUserData();

      setLoading(false);
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      setLoading(false);
      return { error: errorMessage };
    }
  };

  return {
    loading,
    error,
    registerSelf,
    register: registerSelf, // Alias for backward compatibility
  };
}
