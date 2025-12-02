/**
 * Self-Registration Hook
 * For existing authenticated users to complete their staff profile.
 * 
 * IMPORTANT: This hook ONLY updates user-editable data:
 * - staff table (professional details)
 * - staff_licenses table (license entries)
 * 
 * Admin-controlled tables are NOT touched here (already created by edge function):
 * - tenant_memberships
 * - user_roles
 * - staff_role_assignments
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
  // Note: isStaff removed - clinical status is determined by admin via staff_role_assignments
  npiNumber?: string;
  taxonomyCode?: string;
  bio?: string;
  minClientAge?: number;
  licenseType?: string; // Optional - only required for clinicians
  licenses?: LicenseEntry[]; // Optional - only required for clinicians
}

export interface SelfRegistrationData {
  personalInfo: PersonalInfo;
  professionalDetails: ProfessionalDetails;
  profileId: string;
}

export function useSelfRegistration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const registerSelf = async (data: SelfRegistrationData) => {
    setLoading(true);
    setError(null);

    try {
      if (!tenantId) {
        throw new Error('No tenant ID found');
      }

      // 1. UPDATE staff record (not upsert - record already exists from admin invitation)
      // Only update user-editable professional details
      const staffUpdateData = {
        prov_name_f: data.personalInfo.firstName,
        prov_name_l: data.personalInfo.lastName,
        prov_npi: data.professionalDetails.npiNumber || null,
        prov_taxonomy: data.professionalDetails.taxonomyCode || null,
        prov_min_client_age: data.professionalDetails.minClientAge || null,
        prov_bio: data.professionalDetails.bio || null,
        prov_status: 'New',  // Mark as completed registration (was 'Invited')
        // Store license_type on staff for quick reference (used in claims)
        prov_license_type: data.professionalDetails.licenseType || null,
      };

      const { data: staffRecord, error: staffError } = await supabase
        .from('staff')
        .update(staffUpdateData)
        .eq('profile_id', data.profileId)
        .eq('tenant_id', tenantId)
        .select('id')
        .single();

      if (staffError) {
        console.error('Staff update error:', staffError);
        throw new Error(`Failed to update staff profile: ${staffError.message}`);
      }

      if (!staffRecord) {
        throw new Error('Staff record not found. Please contact your administrator.');
      }

      // 2. Insert licenses into staff_licenses table (if provided)
      const licenses = data.professionalDetails.licenses || [];
      if (staffRecord && licenses.length > 0) {
        const licensesToInsert = licenses
          .filter(license => license.state && license.licenseNumber) // Only valid entries
          .map(license => ({
            tenant_id: tenantId,
            staff_id: staffRecord.id,
            license_type: data.professionalDetails.licenseType || null,
            license_number: license.licenseNumber,
            license_state: license.state as StateCodeEnum,
            issue_date: license.issuedOn || null,
            expiration_date: license.expiresOn || null,
            is_active: true,
          }));

        if (licensesToInsert.length > 0) {
          const { error: licensesError } = await supabase
            .from('staff_licenses')
            .insert(licensesToInsert);

          if (licensesError) {
            console.error('Failed to insert licenses:', licensesError);
            // Don't throw - staff record was updated, licenses can be added later
          }
        }
      }

      // 3. Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff_licenses'] });

      // 4. Return success - form component will handle navigation via full page reload
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
