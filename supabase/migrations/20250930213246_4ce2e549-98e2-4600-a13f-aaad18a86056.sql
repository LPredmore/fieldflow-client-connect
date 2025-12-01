-- Create enum for form types
CREATE TYPE form_type AS ENUM ('signup', 'intake', 'session_notes');

-- Create enum for field types
CREATE TYPE field_type AS ENUM (
  'text',
  'textarea', 
  'email',
  'phone',
  'number',
  'date',
  'select',
  'multiselect',
  'radio',
  'checkbox',
  'file'
);

-- Create form_templates table
CREATE TABLE public.form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  form_type form_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, form_type, is_active)
);

-- Create form_fields table
CREATE TABLE public.form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  field_type field_type NOT NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  placeholder TEXT,
  help_text TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL,
  validation_rules JSONB DEFAULT '{}',
  options JSONB,
  conditional_logic JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create form_responses table
CREATE TABLE public.form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  submitted_by_user_id UUID,
  response_data JSONB NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add access_forms to user_permissions
ALTER TABLE public.user_permissions
ADD COLUMN access_forms BOOLEAN NOT NULL DEFAULT false;

-- Update existing business_admin permissions to have access_forms
UPDATE public.user_permissions
SET access_forms = true
WHERE user_id IN (
  SELECT user_id FROM public.profiles WHERE role = 'business_admin'
);

-- Enable RLS on all tables
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for form_templates
CREATE POLICY "Contractors can manage form templates"
  ON public.form_templates
  FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('business_admin', 'contractor')
    )
  );

CREATE POLICY "Tenant users can view form templates"
  ON public.form_templates
  FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Public can view active signup forms"
  ON public.form_templates
  FOR SELECT
  USING (form_type = 'signup' AND is_active = true);

-- RLS Policies for form_fields
CREATE POLICY "Contractors can manage form fields"
  ON public.form_fields
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM form_templates ft
      WHERE ft.id = form_fields.form_template_id
      AND ft.tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('business_admin', 'contractor')
      )
    )
  );

CREATE POLICY "Tenant users can view form fields"
  ON public.form_fields
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM form_templates ft
      WHERE ft.id = form_fields.form_template_id
      AND ft.tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Public can view active signup form fields"
  ON public.form_fields
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM form_templates ft
      WHERE ft.id = form_fields.form_template_id
      AND ft.form_type = 'signup'
      AND ft.is_active = true
    )
  );

-- RLS Policies for form_responses
CREATE POLICY "Contractors can view form responses"
  ON public.form_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM form_templates ft
      WHERE ft.id = form_responses.form_template_id
      AND ft.tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Clients can view their own responses"
  ON public.form_responses
  FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE client_user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can submit signup form responses"
  ON public.form_responses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM form_templates ft
      WHERE ft.id = form_responses.form_template_id
      AND ft.form_type = 'signup'
      AND ft.is_active = true
    )
  );

CREATE POLICY "Contractors can insert form responses"
  ON public.form_responses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM form_templates ft
      WHERE ft.id = form_responses.form_template_id
      AND ft.tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('business_admin', 'contractor')
      )
    )
  );

-- Create triggers for updated_at
CREATE TRIGGER update_form_templates_updated_at
  BEFORE UPDATE ON public.form_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_form_fields_updated_at
  BEFORE UPDATE ON public.form_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_form_responses_updated_at
  BEFORE UPDATE ON public.form_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_form_templates_tenant_type ON public.form_templates(tenant_id, form_type);
CREATE INDEX idx_form_templates_active ON public.form_templates(is_active) WHERE is_active = true;
CREATE INDEX idx_form_fields_template ON public.form_fields(form_template_id);
CREATE INDEX idx_form_fields_order ON public.form_fields(form_template_id, order_index);
CREATE INDEX idx_form_responses_template ON public.form_responses(form_template_id);
CREATE INDEX idx_form_responses_customer ON public.form_responses(customer_id);
