/**
 * useProfileCompletion Hook
 * Centralized validation logic for required profile fields before enabling "Accepting New Clients"
 */

import { useMemo } from 'react';
import type { StaffMember } from '@/hooks/useStaffData';
import type { StaffLicense } from '@/hooks/useStaffLicenses';

export interface MissingField {
  section: 'Personal Information' | 'Licensing & Credentials' | 'Client Facing Information';
  field: string;
}

export interface ProfileCompletionResult {
  isProfileComplete: boolean;
  missingFields: MissingField[];
  missingFieldsBySection: Record<string, string[]>;
  canAcceptClients: boolean;
}

interface UseProfileCompletionOptions {
  staff: StaffMember | null;
  licenses: StaffLicense[];
  licensesLoading?: boolean;
}

/**
 * Required fields for profile completion:
 * 
 * Personal Information:
 * - First Name (prov_name_f)
 * - Last Name (prov_name_l)
 * - Phone (prov_phone)
 * - Address Line 1 (prov_addr_1)
 * - City (prov_city)
 * - State (prov_state)
 * - ZIP (prov_zip)
 * - Time Zone (prov_time_zone)
 * 
 * Licensing & Credentials:
 * - Specialty (prov_field)
 * - Highest Degree (prov_degree)
 * - Taxonomy Code (prov_taxonomy)
 * - At least 1 license (staff_licenses table)
 * 
 * Client Facing Information:
 * - Profile Image (prov_image_url)
 * - Display Name (prov_name_for_clients)
 * - Bio (prov_bio)
 * 
 * NOT Required:
 * - NPI Number
 * - Treatment Approaches
 * - Min Client Age (has default of 18)
 */
export function useProfileCompletion({ 
  staff, 
  licenses, 
  licensesLoading = false 
}: UseProfileCompletionOptions): ProfileCompletionResult {
  return useMemo(() => {
    const missingFields: MissingField[] = [];

    if (!staff) {
      return {
        isProfileComplete: false,
        missingFields: [],
        missingFieldsBySection: {},
        canAcceptClients: false,
      };
    }

    // Personal Information checks
    if (!staff.prov_name_f?.trim()) {
      missingFields.push({ section: 'Personal Information', field: 'First Name' });
    }
    if (!staff.prov_name_l?.trim()) {
      missingFields.push({ section: 'Personal Information', field: 'Last Name' });
    }
    if (!staff.prov_phone?.trim()) {
      missingFields.push({ section: 'Personal Information', field: 'Phone Number' });
    }
    if (!staff.prov_addr_1?.trim()) {
      missingFields.push({ section: 'Personal Information', field: 'Address Line 1' });
    }
    if (!staff.prov_city?.trim()) {
      missingFields.push({ section: 'Personal Information', field: 'City' });
    }
    if (!staff.prov_state?.trim()) {
      missingFields.push({ section: 'Personal Information', field: 'State' });
    }
    if (!staff.prov_zip?.trim()) {
      missingFields.push({ section: 'Personal Information', field: 'ZIP Code' });
    }
    if (!staff.prov_time_zone?.trim()) {
      missingFields.push({ section: 'Personal Information', field: 'Time Zone' });
    }

    // Licensing & Credentials checks
    if (!staff.prov_field?.trim()) {
      missingFields.push({ section: 'Licensing & Credentials', field: 'Specialty' });
    }
    if (!staff.prov_degree?.trim()) {
      missingFields.push({ section: 'Licensing & Credentials', field: 'Highest Degree' });
    }
    if (!staff.prov_taxonomy?.trim()) {
      missingFields.push({ section: 'Licensing & Credentials', field: 'Taxonomy Code' });
    }
    // License check - only if not loading
    if (!licensesLoading && licenses.length === 0) {
      missingFields.push({ section: 'Licensing & Credentials', field: 'At least one license' });
    }

    // Client Facing Information checks
    if (!staff.prov_image_url?.trim()) {
      missingFields.push({ section: 'Client Facing Information', field: 'Profile Image' });
    }
    if (!staff.prov_name_for_clients?.trim()) {
      missingFields.push({ section: 'Client Facing Information', field: 'Display Name' });
    }
    if (!staff.prov_bio?.trim()) {
      missingFields.push({ section: 'Client Facing Information', field: 'Professional Bio' });
    }

    // Group by section for display
    const missingFieldsBySection: Record<string, string[]> = {};
    missingFields.forEach(({ section, field }) => {
      if (!missingFieldsBySection[section]) {
        missingFieldsBySection[section] = [];
      }
      missingFieldsBySection[section].push(field);
    });

    const isProfileComplete = missingFields.length === 0 && !licensesLoading;

    return {
      isProfileComplete,
      missingFields,
      missingFieldsBySection,
      canAcceptClients: isProfileComplete,
    };
  }, [staff, licenses, licensesLoading]);
}

/**
 * Check if pending form data would make the profile incomplete
 * Used to warn users before saving changes that would disable their availability
 */
export function checkFormDataCompleteness(
  currentStaff: StaffMember | null,
  pendingPersonalInfo: {
    prov_name_f?: string;
    prov_name_l?: string;
    prov_phone?: string;
    prov_addr_1?: string;
    prov_city?: string;
    prov_state?: string;
    prov_zip?: string;
    prov_time_zone?: string;
  },
  pendingCredentials: {
    prov_degree?: string;
    prov_taxonomy?: string;
  },
  pendingClientInfo: {
    prov_name_for_clients?: string;
    prov_bio?: string;
  },
  pendingSpecialty: string | undefined,
  licenses: StaffLicense[]
): MissingField[] {
  const missingFields: MissingField[] = [];

  if (!currentStaff) return missingFields;

  // Check Personal Information
  const firstName = pendingPersonalInfo.prov_name_f ?? currentStaff.prov_name_f;
  const lastName = pendingPersonalInfo.prov_name_l ?? currentStaff.prov_name_l;
  const phone = pendingPersonalInfo.prov_phone ?? currentStaff.prov_phone;
  const addr1 = pendingPersonalInfo.prov_addr_1 ?? currentStaff.prov_addr_1;
  const city = pendingPersonalInfo.prov_city ?? currentStaff.prov_city;
  const state = pendingPersonalInfo.prov_state ?? currentStaff.prov_state;
  const zip = pendingPersonalInfo.prov_zip ?? currentStaff.prov_zip;
  const timezone = pendingPersonalInfo.prov_time_zone ?? currentStaff.prov_time_zone;

  if (!firstName?.trim()) missingFields.push({ section: 'Personal Information', field: 'First Name' });
  if (!lastName?.trim()) missingFields.push({ section: 'Personal Information', field: 'Last Name' });
  if (!phone?.trim()) missingFields.push({ section: 'Personal Information', field: 'Phone Number' });
  if (!addr1?.trim()) missingFields.push({ section: 'Personal Information', field: 'Address Line 1' });
  if (!city?.trim()) missingFields.push({ section: 'Personal Information', field: 'City' });
  if (!state?.trim()) missingFields.push({ section: 'Personal Information', field: 'State' });
  if (!zip?.trim()) missingFields.push({ section: 'Personal Information', field: 'ZIP Code' });
  if (!timezone?.trim()) missingFields.push({ section: 'Personal Information', field: 'Time Zone' });

  // Check Licensing & Credentials
  const specialty = pendingSpecialty ?? currentStaff.prov_field;
  const degree = pendingCredentials.prov_degree ?? currentStaff.prov_degree;
  const taxonomy = pendingCredentials.prov_taxonomy ?? currentStaff.prov_taxonomy;

  if (!specialty?.trim()) missingFields.push({ section: 'Licensing & Credentials', field: 'Specialty' });
  if (!degree?.trim()) missingFields.push({ section: 'Licensing & Credentials', field: 'Highest Degree' });
  if (!taxonomy?.trim()) missingFields.push({ section: 'Licensing & Credentials', field: 'Taxonomy Code' });
  if (licenses.length === 0) missingFields.push({ section: 'Licensing & Credentials', field: 'At least one license' });

  // Check Client Facing Information
  const displayName = pendingClientInfo.prov_name_for_clients ?? currentStaff.prov_name_for_clients;
  const bio = pendingClientInfo.prov_bio ?? currentStaff.prov_bio;
  const imageUrl = currentStaff.prov_image_url; // Image is uploaded separately, use current value

  if (!imageUrl?.trim()) missingFields.push({ section: 'Client Facing Information', field: 'Profile Image' });
  if (!displayName?.trim()) missingFields.push({ section: 'Client Facing Information', field: 'Display Name' });
  if (!bio?.trim()) missingFields.push({ section: 'Client Facing Information', field: 'Professional Bio' });

  return missingFields;
}
