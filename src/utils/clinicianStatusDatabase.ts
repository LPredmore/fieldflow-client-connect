/**
 * Database utilities for staff/clinician status operations
 * 
 * NOTE: This file references legacy table structure.
 * The database has been restructured:
 * - 'clinicians' table is now 'staff'
 * - 'profiles' table structure has changed
 * 
 * This file is kept for backwards compatibility but should be updated
 * to use the new schema structure defined in src/schema/
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * @deprecated This utility file references a legacy database structure.
 * The actual database schema is documented in src/schema/
 * 
 * Current schema:
 * - profiles table: id, email, password, email_verified, is_active, etc.
 * - staff table: id, tenant_id, profile_id, prov_name_f, prov_status, etc.
 * 
 * Please update this file to match the current schema or create new utilities.
 */

export function legacyNotice() {
  console.warn(
    'clinicianStatusDatabase.ts uses legacy schema structure. ' +
    'Refer to src/schema/ for current database structure.'
  );
}

// Placeholder exports to prevent build errors
export async function getStaffRecord(userId: string): Promise<any | null> {
  legacyNotice();
  return null;
}

export async function isClinicianStaff(userId: string): Promise<boolean> {
  legacyNotice();
  return false;
}

export async function getClinicianStatus(userId: string): Promise<any | null> {
  legacyNotice();
  return null;
}

export async function setClinicianStatus(userId: string, status: any): Promise<void> {
  legacyNotice();
}

export async function getClinicianRecord(userId: string): Promise<any | null> {
  legacyNotice();
  return null;
}

export async function initializeClinicianRecord(userId: string, isClinicianStaff: boolean): Promise<void> {
  legacyNotice();
}

export async function getMultipleStaffRecords(userIds: string[]): Promise<any[]> {
  legacyNotice();
  return [];
}

export async function setMultipleClinicianStatuses(updates: Array<{ userId: string; status: any }>): Promise<void> {
  legacyNotice();
}
