-- Create missing authentication and role tables for Phase 8
-- These tables are required for the authentication system to work

-- 1. Ensure staff_roles table exists
CREATE TABLE IF NOT EXISTS public.staff_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  is_clinical boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for staff_roles
CREATE POLICY "Staff roles are viewable by authenticated users"
  ON public.staff_roles FOR SELECT
  TO authenticated
  USING (true);

-- 2. Create staff_role_assignments table
CREATE TABLE IF NOT EXISTS public.staff_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  staff_role_id uuid NOT NULL REFERENCES public.staff_roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(staff_id, staff_role_id)
);

-- Enable RLS
ALTER TABLE public.staff_role_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for staff_role_assignments
CREATE POLICY "Users can view their own staff role assignments"
  ON public.staff_role_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE staff.id = staff_role_assignments.staff_id
      AND staff.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all staff role assignments"
  ON public.staff_role_assignments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Ensure tenant_memberships table exists
CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, profile_id)
);

-- Enable RLS
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;

-- RLS policies for tenant_memberships
CREATE POLICY "Users can view their own tenant memberships"
  ON public.tenant_memberships FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can view all tenant memberships"
  ON public.tenant_memberships FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Insert core staff roles if they don't exist
INSERT INTO public.staff_roles (code, name, description, is_clinical)
VALUES 
  ('ACCOUNT_OWNER', 'Account Owner', 'Full administrative access to all system features', false),
  ('CLINICIAN', 'Clinician', 'Clinical staff with patient care responsibilities', true),
  ('SUPERVISOR', 'Clinical Supervisor', 'Supervises other clinicians and reviews clinical work', true),
  ('BILLING', 'Billing Specialist', 'Manages billing and insurance claims', false)
ON CONFLICT (code) DO NOTHING;

-- 5. Add updated_at trigger for staff_role_assignments
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.staff_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 6. Add updated_at trigger for staff_roles
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.staff_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();