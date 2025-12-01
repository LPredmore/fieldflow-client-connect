-- Create CMS-1500 Claims table
CREATE TABLE public.cms_1500_claims (
  -- Primary Key & Tenant Association
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Internal References
  customer_id UUID REFERENCES customers(id),
  appointment_id UUID REFERENCES appointment_occurrences(id),
  invoice_id UUID REFERENCES invoices(id),
  
  -- Claim Status Tracking
  claim_status TEXT DEFAULT 'draft',
  claim_number TEXT,
  claim_md_claim_id TEXT,
  submission_date TIMESTAMP WITH TIME ZONE,
  response_date TIMESTAMP WITH TIME ZONE,
  
  -- Box 1 - Insurance Type & Payer Details
  insurance_type TEXT,
  payer_name TEXT NOT NULL,
  payerid TEXT NOT NULL,
  payer_addr_1 TEXT,
  payer_addr_2 TEXT,
  payer_city TEXT,
  payer_state TEXT,
  payer_zip TEXT,
  
  -- Box 1a - Insured's ID Number
  ins_number TEXT NOT NULL,
  
  -- Box 2 - Patient Name
  pat_name_l TEXT NOT NULL,
  pat_name_f TEXT NOT NULL,
  pat_name_m TEXT,
  
  -- Box 3 - Patient Date of Birth & Sex
  pat_dob DATE NOT NULL,
  patient_sex TEXT NOT NULL,
  
  -- Box 4 - Insured's Name
  ins_name_l TEXT,
  ins_name_f TEXT,
  ins_name_m TEXT,
  
  -- Box 5 - Patient Address
  pat_addr_1 TEXT NOT NULL,
  pat_addr_2 TEXT,
  pat_city TEXT NOT NULL,
  pat_state TEXT NOT NULL,
  pat_zip TEXT NOT NULL,
  pat_country TEXT,
  pat_phone TEXT,
  
  -- Box 6 - Patient Relationship to Insured
  pat_rel TEXT NOT NULL,
  
  -- Box 7 - Insured's Address
  ins_addr_1 TEXT,
  ins_addr_2 TEXT,
  ins_city TEXT,
  ins_state TEXT,
  ins_zip TEXT,
  ins_phone TEXT,
  
  -- Box 8 - Patient Status
  pat_marital_status TEXT,
  pat_employment_status TEXT,
  pat_student_status TEXT,
  
  -- Box 9 - Other Insured Information
  other_ins_name_l TEXT,
  other_ins_name_f TEXT,
  other_ins_name_m TEXT,
  other_ins_policy_number TEXT,
  other_ins_dob DATE,
  other_ins_sex TEXT,
  other_ins_employer_name TEXT,
  other_ins_plan_name TEXT,
  
  -- Box 10 - Condition Related To
  condition_related_to_employment BOOLEAN,
  condition_related_to_auto_accident BOOLEAN,
  auto_accident_state TEXT,
  condition_related_to_other_accident BOOLEAN,
  claim_codes TEXT,
  
  -- Box 11 - Insured's Policy Information
  ins_policy_group_number TEXT,
  ins_dob DATE,
  ins_sex TEXT,
  other_claim_id TEXT,
  ins_plan_name TEXT,
  another_health_benefit_plan BOOLEAN,
  
  -- Box 12-13 - Signatures
  patient_signature_on_file BOOLEAN DEFAULT true,
  patient_signature_date DATE,
  insured_signature_on_file BOOLEAN DEFAULT true,
  
  -- Box 14-19 - Claim Information
  illness_injury_date DATE,
  illness_injury_qual TEXT,
  other_date DATE,
  other_date_qual TEXT,
  unable_to_work_from DATE,
  unable_to_work_to DATE,
  
  -- Box 17 - Referring Provider
  referring_provider_name_l TEXT,
  referring_provider_name_f TEXT,
  referring_provider_name_m TEXT,
  referring_provider_npi TEXT,
  referring_provider_other_id TEXT,
  referring_provider_other_id_qual TEXT,
  
  -- Box 18 - Hospitalization Dates
  hospitalization_from DATE,
  hospitalization_to DATE,
  
  -- Box 19 - Additional Claim Information
  additional_claim_info TEXT,
  
  -- Box 20 - Outside Lab
  outside_lab_charges BOOLEAN DEFAULT false,
  outside_lab_charge_amount NUMERIC(10, 2),
  
  -- Box 21 - Diagnosis Codes (ICD-10)
  diagnosis_code_a TEXT,
  diagnosis_code_b TEXT,
  diagnosis_code_c TEXT,
  diagnosis_code_d TEXT,
  diagnosis_code_e TEXT,
  diagnosis_code_f TEXT,
  diagnosis_code_g TEXT,
  diagnosis_code_h TEXT,
  diagnosis_code_i TEXT,
  diagnosis_code_j TEXT,
  diagnosis_code_k TEXT,
  diagnosis_code_l TEXT,
  
  -- Box 22 - Resubmission
  resubmission_code TEXT,
  original_ref_number TEXT,
  
  -- Box 23 - Prior Authorization
  prior_authorization_number TEXT,
  
  -- Box 25 - Federal Tax ID
  federal_tax_id TEXT NOT NULL,
  federal_tax_id_type TEXT,
  
  -- Box 26 - Patient's Account Number
  patient_account_number TEXT,
  
  -- Box 27 - Accept Assignment
  accept_assignment BOOLEAN DEFAULT true,
  
  -- Box 28-30 - Financial Summary
  total_charge NUMERIC(10, 2) NOT NULL,
  amount_paid NUMERIC(10, 2) DEFAULT 0,
  balance_due NUMERIC(10, 2),
  
  -- Box 31 - Provider Signature
  provider_signature_on_file BOOLEAN DEFAULT true,
  provider_signature_date DATE,
  
  -- Box 32 - Service Facility Location
  service_facility_name TEXT,
  service_facility_addr_1 TEXT,
  service_facility_addr_2 TEXT,
  service_facility_city TEXT,
  service_facility_state TEXT,
  service_facility_zip TEXT,
  service_facility_npi TEXT,
  
  -- Box 33 - Billing Provider
  billing_provider_name TEXT NOT NULL,
  billing_provider_addr_1 TEXT NOT NULL,
  billing_provider_addr_2 TEXT,
  billing_provider_city TEXT NOT NULL,
  billing_provider_state TEXT NOT NULL,
  billing_provider_zip TEXT NOT NULL,
  billing_provider_phone TEXT NOT NULL,
  billing_provider_npi TEXT NOT NULL,
  billing_provider_taxonomy_code TEXT
);

-- Create Service Lines table (Box 24)
CREATE TABLE public.cms_1500_service_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cms_1500_claim_id UUID NOT NULL REFERENCES cms_1500_claims(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  
  -- Box 24A - Date(s) of Service
  service_date_from DATE NOT NULL,
  service_date_to DATE,
  
  -- Box 24B - Place of Service
  place_of_service TEXT NOT NULL,
  
  -- Box 24C - EMG
  emergency_indicator TEXT,
  
  -- Box 24D - Procedures, Services, or Supplies
  cpt_hcpcs_code TEXT NOT NULL,
  modifier_1 TEXT,
  modifier_2 TEXT,
  modifier_3 TEXT,
  modifier_4 TEXT,
  
  -- Box 24E - Diagnosis Pointer
  diagnosis_pointer TEXT NOT NULL,
  
  -- Box 24F - Charges
  charges NUMERIC(10, 2) NOT NULL,
  
  -- Box 24G - Days or Units
  units NUMERIC(10, 3) NOT NULL DEFAULT 1,
  
  -- Box 24H - EPSDT Family Plan
  epsdt_family_plan TEXT,
  
  -- Box 24I-J - Rendering Provider
  rendering_provider_id_qual TEXT,
  rendering_provider_npi TEXT,
  
  -- Additional fields for electronic claims
  drug_ndc_code TEXT,
  drug_unit_of_measure TEXT,
  drug_quantity NUMERIC(10, 3),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(cms_1500_claim_id, line_number)
);

-- Create Attachments table
CREATE TABLE public.cms_1500_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cms_1500_claim_id UUID NOT NULL REFERENCES cms_1500_claims(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  attachment_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Status History table
CREATE TABLE public.cms_1500_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cms_1500_claim_id UUID NOT NULL REFERENCES cms_1500_claims(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  status_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  changed_by_user_id UUID
);

-- Create Remittances table
CREATE TABLE public.cms_1500_remittances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cms_1500_claim_id UUID NOT NULL REFERENCES cms_1500_claims(id),
  remittance_date DATE NOT NULL,
  check_number TEXT,
  paid_amount NUMERIC(10, 2),
  adjustment_amount NUMERIC(10, 2),
  remark_codes TEXT[],
  reason_codes TEXT[],
  raw_835_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_cms_claims_tenant ON cms_1500_claims(tenant_id);
CREATE INDEX idx_cms_claims_customer ON cms_1500_claims(customer_id);
CREATE INDEX idx_cms_claims_status ON cms_1500_claims(claim_status);
CREATE INDEX idx_cms_claims_submission ON cms_1500_claims(submission_date);
CREATE INDEX idx_service_lines_claim ON cms_1500_service_lines(cms_1500_claim_id);
CREATE INDEX idx_attachments_claim ON cms_1500_attachments(cms_1500_claim_id);
CREATE INDEX idx_status_history_claim ON cms_1500_status_history(cms_1500_claim_id);
CREATE INDEX idx_remittances_claim ON cms_1500_remittances(cms_1500_claim_id);

-- Enable RLS on all tables
ALTER TABLE public.cms_1500_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_1500_service_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_1500_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_1500_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_1500_remittances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cms_1500_claims
CREATE POLICY "Staff can manage CMS-1500 claims"
ON public.cms_1500_claims
FOR ALL
TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'staff'
  )
);

CREATE POLICY "Clients can view their CMS-1500 claims"
ON public.cms_1500_claims
FOR SELECT
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers WHERE client_user_id = auth.uid()
  )
);

-- RLS Policies for cms_1500_service_lines
CREATE POLICY "Users can manage service lines for accessible claims"
ON public.cms_1500_service_lines
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cms_1500_claims 
    WHERE cms_1500_claims.id = cms_1500_service_lines.cms_1500_claim_id
  )
);

-- RLS Policies for cms_1500_attachments
CREATE POLICY "Users can manage attachments for accessible claims"
ON public.cms_1500_attachments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cms_1500_claims 
    WHERE cms_1500_claims.id = cms_1500_attachments.cms_1500_claim_id
  )
);

-- RLS Policies for cms_1500_status_history
CREATE POLICY "Users can view status history for accessible claims"
ON public.cms_1500_status_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cms_1500_claims 
    WHERE cms_1500_claims.id = cms_1500_status_history.cms_1500_claim_id
  )
);

CREATE POLICY "Staff can insert status history"
ON public.cms_1500_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cms_1500_claims 
    WHERE cms_1500_claims.id = cms_1500_status_history.cms_1500_claim_id
    AND cms_1500_claims.tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'staff'
    )
  )
);

-- RLS Policies for cms_1500_remittances
CREATE POLICY "Users can manage remittances for accessible claims"
ON public.cms_1500_remittances
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cms_1500_claims 
    WHERE cms_1500_claims.id = cms_1500_remittances.cms_1500_claim_id
  )
);

-- Create trigger for updated_at on cms_1500_claims
CREATE TRIGGER update_cms_claims_updated_at
BEFORE UPDATE ON public.cms_1500_claims
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();