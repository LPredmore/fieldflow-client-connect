/**
 * Client type definitions aligned with the clients database table
 */

export interface Client {
  id: string;
  tenant_id: string;
  profile_id: string | null; // Links to auth user if client has login
  // Patient Name Fields
  pat_name_f: string | null;
  pat_name_l: string | null;
  pat_name_m: string | null;
  pat_name_preferred: string | null;
  // Contact Info
  email: string | null;
  phone: string | null;
  // Address Fields
  pat_addr_1: string | null;
  pat_addr_2: string | null;
  pat_city: string | null;
  pat_state: string | null; // state_code_enum
  pat_zip: string | null;
  pat_country: string | null;
  // Patient Demographics
  pat_dob: string | null;
  pat_sex: string | null; // pat_sex_enum
  pat_gender_identity: string | null; // gender_identity_enum
  pat_time_zone: string | null; // time_zones enum
  pat_marital_status: string | null;
  pat_ssn: string | null;
  pat_status: string | null; // client_status_enum
  // Assignment
  primary_staff_id: string | null;
  // Goals
  pat_goal: string | null;
  // PCN (Patient Control Number)
  pcn: string | null;
  // Timestamps
  created_at: string;
  updated_at: string | null;
  // Computed helper fields (added in transform)
  full_name?: string;
  assigned_staff_name?: string;
}

export interface ClientFormData {
  // Patient Name
  pat_name_f: string;
  pat_name_l: string;
  pat_name_m?: string;
  pat_name_preferred?: string;
  // Contact
  email?: string;
  phone: string;
  // Address
  pat_addr_1?: string;
  pat_addr_2?: string;
  pat_city?: string;
  pat_state?: string;
  pat_zip?: string;
  pat_country?: string;
  // Demographics
  pat_dob?: string;
  pat_sex?: 'M' | 'F' | 'Other' | '';
  pat_gender_identity?: string;
  pat_time_zone?: string;
  pat_marital_status?: string;
  // Assignment
  primary_staff_id?: string;
  // Goals
  pat_goal?: string;
}
