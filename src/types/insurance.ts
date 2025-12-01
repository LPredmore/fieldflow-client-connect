export interface InsuranceFormData {
  // Required fields
  payer_name: string;
  policy_number: string;
  
  // Insurance type
  insurance_type: 'primary' | 'secondary' | 'tertiary';
  
  // Optional but important
  group_number?: string;
  payer_id?: string;
  
  // Insured information
  same_as_client: boolean;
  insured_name_first: string;
  insured_name_last: string;
  insured_name_middle?: string;
  insured_dob: string;
  insured_sex: 'M' | 'F' | 'Other' | ''; // Biological sex (standardized format)
  relationship_to_patient: string;
  
  // Insured address
  insured_address_1: string;
  insured_address_2?: string;
  insured_city: string;
  insured_state: string;
  insured_zip: string;
  
  // Additional information
  ins_phone?: string;
  ins_employer?: string;
  ins_plan?: string;
  
  // Insurance card images
  insurance_card_front?: File | null;
  insurance_card_back?: File | null;
}

export interface InsurancePolicy {
  id: string;
  customer_id: string;
  tenant_id: string;
  payer_name: string | null;
  policy_number: string;
  group_number: string | null;
  insurance_type: string;
  payer_id: string | null;
  insured_name_first: string | null;
  insured_name_last: string | null;
  insured_name_middle: string | null;
  insured_dob: string | null;
  insured_sex: string | null;
  insured_address_1: string | null;
  insured_address_2: string | null;
  insured_city: string | null;
  insured_state: string | null;
  insured_zip: string | null;
  relationship_to_patient: string | null;
  ins_phone: number | null;
  ins_employer: string | null;
  ins_plan: string | null;
  verification_status: string | null;
  verified_date: string | null;
  verification_notes: string | null;
  is_active: boolean | null;
  insurance_card_front_url: string | null;
  insurance_card_back_url: string | null;
  created_at: string;
  updated_at: string;
}
