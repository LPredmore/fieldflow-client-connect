export interface CustomerFormData {
  // Patient Name
  pat_name_f: string;
  pat_name_l: string;
  pat_name_m?: string;
  preferred_name?: string;
  // Contact
  email?: string;
  pat_phone: string;
  // Address (flat structure)
  pat_addr_1?: string;
  pat_city?: string;
  pat_state?: string;
  pat_zip?: string;
  pat_country?: string;
  // Demographics
  pat_dob?: string;
  pat_sex?: 'M' | 'F' | 'Other' | ''; // Biological sex (standardized format)
  gender_identity?: string;
  // Assignment
  assigned_to_user_id?: string;
  assigned_clinician?: string;
  // Other
  timezone?: string;
  notes?: string;
}

