-- Phase 1: Fix form_responses table to match UI expectations
-- Drop the old form_responses table (it uses bigint IDs and wrong column names)
DROP TABLE IF EXISTS form_responses CASCADE;

-- Create new form_responses table matching UI expectations
CREATE TABLE form_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    form_template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    submitted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    response_data JSONB NOT NULL DEFAULT '{}',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Staff can manage tenant form responses"
ON form_responses FOR ALL
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_memberships 
        WHERE profile_id = auth.uid()
    )
);

CREATE POLICY "Clients can view own responses"
ON form_responses FOR SELECT
USING (
    customer_id IN (
        SELECT id FROM clients WHERE profile_id = auth.uid()
    )
);

CREATE POLICY "Clients can insert own responses"
ON form_responses FOR INSERT
WITH CHECK (
    customer_id IN (
        SELECT id FROM clients WHERE profile_id = auth.uid()
    )
);

-- Create indexes for common queries
CREATE INDEX idx_form_responses_template ON form_responses(form_template_id);
CREATE INDEX idx_form_responses_customer ON form_responses(customer_id);
CREATE INDEX idx_form_responses_tenant ON form_responses(tenant_id);
CREATE INDEX idx_form_responses_submitted_at ON form_responses(submitted_at DESC);