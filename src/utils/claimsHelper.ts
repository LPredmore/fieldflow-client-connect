import { supabase } from '@/integrations/supabase/client';

/**
 * Get the appropriate license information for a clinician in a specific state
 * Used for populating CMS-1500 claim forms
 */
export async function getClinicianLicenseForState(
  clinicianId: string,
  state: string
): Promise<{
  license_type: string;
  license_number: string;
  expiration_date: string;
} | null> {
  try {
    const { data, error } = await supabase
      .from('clinician_licenses')
      .select('license_type, license_number, expiration_date')
      .eq('clinician_id', clinicianId)
      .eq('state', state)
      .eq('is_active', true)
      .gte('expiration_date', new Date().toISOString().split('T')[0])
      .order('is_primary', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching clinician license:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getClinicianLicenseForState:', error);
    return null;
  }
}

/**
 * Get all active licenses for a clinician
 */
export async function getClinicianLicenses(clinicianId: string) {
  try {
    const { data, error } = await supabase
      .from('clinician_licenses')
      .select('*')
      .eq('clinician_id', clinicianId)
      .eq('is_active', true)
      .gte('expiration_date', new Date().toISOString().split('T')[0])
      .order('is_primary', { ascending: false });

    if (error) {
      console.error('Error fetching clinician licenses:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getClinicianLicenses:', error);
    return [];
  }
}
