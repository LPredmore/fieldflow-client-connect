-- Create insurance_information table
CREATE TABLE IF NOT EXISTS public.insurance_information (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  insurance_type TEXT DEFAULT 'primary',
  payer_name TEXT,
  payer_id TEXT,
  policy_number TEXT NOT NULL,
  group_number TEXT,
  insured_name_first TEXT,
  insured_name_last TEXT,
  insured_name_middle TEXT,
  insured_dob DATE,
  insured_sex TEXT,
  insured_address_1 TEXT,
  insured_address_2 TEXT,
  insured_city TEXT,
  insured_state TEXT,
  insured_zip TEXT,
  relationship_to_patient TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.insurance_information ENABLE ROW LEVEL SECURITY;

-- RLS Policies for insurance_information
CREATE POLICY "Clients can view their own insurance"
  ON public.insurance_information FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE client_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage insurance"
  ON public.insurance_information FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'staff'
    )
  );

-- Create diagnosis_codes table
CREATE TABLE IF NOT EXISTS public.diagnosis_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  code_type TEXT DEFAULT 'ICD-10',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(tenant_id, code)
);

-- Enable RLS
ALTER TABLE public.diagnosis_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for diagnosis_codes
CREATE POLICY "Tenant users can view diagnosis codes"
  ON public.diagnosis_codes FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Staff can manage diagnosis codes"
  ON public.diagnosis_codes FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'staff'
    )
  );

-- Create indexes
CREATE INDEX idx_insurance_customer ON public.insurance_information(customer_id);
CREATE INDEX idx_insurance_tenant ON public.insurance_information(tenant_id);
CREATE INDEX idx_diagnosis_tenant ON public.diagnosis_codes(tenant_id);
CREATE INDEX idx_diagnosis_code ON public.diagnosis_codes(code);

-- Create update triggers
CREATE TRIGGER update_insurance_updated_at
  BEFORE UPDATE ON public.insurance_information
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_diagnosis_updated_at
  BEFORE UPDATE ON public.diagnosis_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();