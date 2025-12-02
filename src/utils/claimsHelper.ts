import { supabase } from '@/integrations/supabase/client';

/**
 * Get the appropriate license information for a staff member in a specific state
 * Used for populating CMS-1500 claim forms
 */
export async function getStaffLicenseForState(
  staffId: string,
  state: string
): Promise<{
  license_type: string;
  license_number: string;
  expiration_date: string | null;
} | null> {
  try {
    const { data, error } = await supabase
      .from('staff_licenses')
      .select('license_type, license_number, expiration_date')
      .eq('staff_id', staffId)
      .eq('license_state', state)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching staff license:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getStaffLicenseForState:', error);
    return null;
  }
}

/**
 * Get all active licenses for a staff member
 */
export async function getStaffLicenses(staffId: string) {
  try {
    const { data, error } = await supabase
      .from('staff_licenses')
      .select('*')
      .eq('staff_id', staffId)
      .eq('is_active', true)
      .order('license_state', { ascending: true });

    if (error) {
      console.error('Error fetching staff licenses:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getStaffLicenses:', error);
    return [];
  }
}

// Legacy aliases for backward compatibility
export const getClinicianLicenseForState = getStaffLicenseForState;
export const getClinicianLicenses = getStaffLicenses;
