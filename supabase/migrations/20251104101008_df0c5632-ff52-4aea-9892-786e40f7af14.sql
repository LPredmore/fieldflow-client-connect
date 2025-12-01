-- Phase 1: Create clinician_licenses table
CREATE TABLE public.clinician_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id UUID NOT NULL REFERENCES public.clinicians(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  state us_states NOT NULL,
  license_type TEXT NOT NULL,
  license_number TEXT NOT NULL,
  issue_date DATE,
  expiration_date DATE NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinician_id, state, license_type)
);

-- Add indexes for performance
CREATE INDEX idx_clinician_licenses_clinician_id ON public.clinician_licenses(clinician_id);
CREATE INDEX idx_clinician_licenses_state ON public.clinician_licenses(state);
CREATE INDEX idx_clinician_licenses_active ON public.clinician_licenses(is_active) WHERE is_active = true;
CREATE INDEX idx_clinician_licenses_expiration ON public.clinician_licenses(expiration_date) WHERE is_active = true;
CREATE INDEX idx_clinician_licenses_tenant ON public.clinician_licenses(tenant_id);

-- Enable RLS
ALTER TABLE public.clinician_licenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Clinicians can view their own licenses"
  ON public.clinician_licenses
  FOR SELECT
  USING (clinician_id IN (
    SELECT id FROM public.clinicians WHERE user_id = auth.uid()
  ));

CREATE POLICY "Clinicians can manage their own licenses"
  ON public.clinician_licenses
  FOR ALL
  USING (clinician_id IN (
    SELECT id FROM public.clinicians WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all licenses in tenant"
  ON public.clinician_licenses
  FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
    AND is_admin(auth.uid())
  );

CREATE POLICY "Tenant users can view licenses in their tenant"
  ON public.clinician_licenses
  FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Clients can view licenses of clinicians in their state"
  ON public.clinician_licenses
  FOR SELECT
  USING (
    is_active = true
    AND state = (
      SELECT pat_state FROM public.customers 
      WHERE client_user_id = auth.uid()
      LIMIT 1
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_clinician_licenses_updated_at
  BEFORE UPDATE ON public.clinician_licenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data from clinician_licenses_detailed JSONB
INSERT INTO public.clinician_licenses (
  clinician_id,
  tenant_id,
  state,
  license_type,
  license_number,
  expiration_date,
  is_primary,
  is_active
)
SELECT 
  c.id as clinician_id,
  c.tenant_id,
  (license->>'state')::us_states as state,
  license->>'licenseType' as license_type,
  license->>'licenseNumber' as license_number,
  COALESCE(
    (license->>'expirationDate')::DATE,
    (CURRENT_DATE + INTERVAL '1 year')::DATE
  ) as expiration_date,
  false as is_primary,
  true as is_active
FROM public.clinicians c
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(c.clinician_licenses_detailed, '[]'::jsonb)
) as license
WHERE license->>'state' IS NOT NULL
  AND license->>'licenseType' IS NOT NULL
  AND license->>'licenseNumber' IS NOT NULL;

-- Migrate legacy single license data (mark as primary)
INSERT INTO public.clinician_licenses (
  clinician_id,
  tenant_id,
  state,
  license_type,
  license_number,
  expiration_date,
  is_primary,
  is_active
)
SELECT 
  c.id as clinician_id,
  c.tenant_id,
  states.state,
  c.clinician_license_type,
  c.clinician_license_number,
  (CURRENT_DATE + INTERVAL '1 year')::DATE as expiration_date,
  true as is_primary,
  true as is_active
FROM public.clinicians c
CROSS JOIN LATERAL unnest(
  COALESCE(c.clinician_licensed_states, ARRAY[]::us_states[])
) as states(state)
WHERE c.clinician_license_type IS NOT NULL
  AND c.clinician_license_number IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.clinician_licenses cl
    WHERE cl.clinician_id = c.id
      AND cl.state = states.state
      AND cl.license_type = c.clinician_license_type
  );