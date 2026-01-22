-- Create client_form_assignments table for tracking form assignments to clients
CREATE TABLE public.client_form_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    form_template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
    assigned_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
    completed_at TIMESTAMPTZ,
    form_response_id UUID REFERENCES form_responses(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_client_form_assignments_client_status 
    ON client_form_assignments(client_id, status);
CREATE INDEX idx_client_form_assignments_tenant 
    ON client_form_assignments(tenant_id);

-- Prevent duplicate pending assignments of same form to same client
CREATE UNIQUE INDEX idx_unique_pending_assignment 
    ON client_form_assignments(client_id, form_template_id) 
    WHERE status = 'pending';

-- Enable RLS
ALTER TABLE client_form_assignments ENABLE ROW LEVEL SECURITY;

-- Staff can manage assignments in their tenant
CREATE POLICY "Staff can manage tenant assignments"
ON client_form_assignments FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_memberships 
        WHERE profile_id = auth.uid()
    )
);

-- Clients can view their own assignments (for future portal)
CREATE POLICY "Clients can view own assignments"
ON client_form_assignments FOR SELECT
TO authenticated
USING (
    client_id IN (
        SELECT id FROM clients WHERE profile_id = auth.uid()
    )
);

-- Add updated_at trigger
CREATE TRIGGER set_client_form_assignments_updated_at
    BEFORE UPDATE ON client_form_assignments
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();