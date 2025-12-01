// This hook is deprecated - use useClientData() from ClientDataContext instead
// Keeping for backward compatibility during migration
import { useClientData } from '@/contexts/ClientDataContext';

export type ClientStatus = 'new' | 'completing_signup' | 'registered';

// Database structure - matches actual customers table columns
interface ClientProfileData {
  // Core fields
  id: string;
  status: ClientStatus;
  tenant_id: string;
  client_user_id: string | null;
  
  // Database column names (healthcare-specific)
  pat_name_f: string | null;
  pat_name_l: string | null;
  pat_name_m: string | null;
  preferred_name?: string | null;
  email?: string | null;
  pat_phone?: string | null;
  pat_dob?: string | null;
  pat_sex?: string | null;
  gender_identity?: string | null;
  pat_addr_1?: string | null;
  pat_city?: string | null;
  pat_state?: string | null;
  pat_zip?: string | null;
  pat_country?: string | null;
  timezone?: string | null;
  notes?: string | null;
  assigned_clinician?: string | null;
  assigned_to_user_id?: string | null;
  created_at?: string;
  updated_at?: string;
  
  // Computed properties for backward compatibility (readonly)
  readonly fullName?: string;
  readonly name?: string;
  readonly phone?: string;
  readonly date_of_birth?: string;
  readonly gender?: string;
  readonly street_address?: string;
  readonly city?: string;
  readonly state?: string;
  readonly zip_code?: string;
}

/**
 * @deprecated Use useClientData() from ClientDataContext instead
 * This hook is kept for backward compatibility but will forward to the global context
 */
export function useClientProfile() {
  // Forward to global context to avoid duplicate queries
  return useClientData();
}