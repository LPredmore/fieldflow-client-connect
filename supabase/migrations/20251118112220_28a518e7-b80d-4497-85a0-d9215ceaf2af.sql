-- Phase 1: Create User Roles Infrastructure
-- This migration creates a proper role-based access control system to fix circular RLS dependencies

-- Step 1: Create app_role enum
CREATE TYPE public.app_role AS ENUM (
  'client',
  'staff',
  'clinician',
  'admin',
  'billing_staff'
);

-- Step 2: Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  tenant_id UUID NOT NULL,
  granted_by_user_id UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure a user can only have one instance of each role per tenant
  UNIQUE(user_id, role, tenant_id)
);

-- Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_tenant_id ON public.user_roles(tenant_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_user_roles_active ON public.user_roles(is_active) WHERE is_active = true;

-- Step 3: Create user_roles_audit table
CREATE TABLE public.user_roles_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  tenant_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'granted', 'revoked', 'expired'
  performed_by_user_id UUID,
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  old_values JSONB,
  new_values JSONB,
  reason TEXT
);

CREATE INDEX idx_user_roles_audit_user_id ON public.user_roles_audit(user_id);
CREATE INDEX idx_user_roles_audit_performed_at ON public.user_roles_audit(performed_at DESC);

-- Step 4: Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles_audit ENABLE ROW LEVEL SECURITY;

-- Step 5: Create SECURITY DEFINER functions (bypass RLS to prevent recursion)

-- Function: has_role - Check if a user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Function: is_admin_safe - Check if user is an admin (replaces old is_admin)
CREATE OR REPLACE FUNCTION public.is_admin_safe(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Function: get_user_tenant_id_safe - Get user's tenant ID (replaces old get_user_tenant_id)
CREATE OR REPLACE FUNCTION public.get_user_tenant_id_safe(_user_id UUID DEFAULT auth.uid())
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.user_roles
  WHERE user_id = _user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1
$$;

-- Function: get_user_primary_role - Get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_primary_role(_user_id UUID DEFAULT auth.uid())
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'clinician' THEN 2
      WHEN 'billing_staff' THEN 3
      WHEN 'staff' THEN 4
      WHEN 'client' THEN 5
    END
  LIMIT 1
$$;

-- Function: get_user_roles - Get all active roles for a user
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID DEFAULT auth.uid())
RETURNS SETOF public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'clinician' THEN 2
      WHEN 'billing_staff' THEN 3
      WHEN 'staff' THEN 4
      WHEN 'client' THEN 5
    END
$$;

-- Step 6: Create RLS policies for user_roles table

-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can view all roles in their tenant
CREATE POLICY "Admins can view all roles in tenant"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id_safe(auth.uid())
  AND public.is_admin_safe(auth.uid())
);

-- Only admins can insert roles
CREATE POLICY "Admins can grant roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_safe(auth.uid())
  AND tenant_id = public.get_user_tenant_id_safe(auth.uid())
);

-- Only admins can update roles
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.is_admin_safe(auth.uid())
  AND tenant_id = public.get_user_tenant_id_safe(auth.uid())
)
WITH CHECK (
  public.is_admin_safe(auth.uid())
  AND tenant_id = public.get_user_tenant_id_safe(auth.uid())
);

-- Only admins can delete roles
CREATE POLICY "Admins can revoke roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.is_admin_safe(auth.uid())
  AND tenant_id = public.get_user_tenant_id_safe(auth.uid())
);

-- Step 7: Create RLS policies for audit table

-- Admins can view audit logs in their tenant
CREATE POLICY "Admins can view audit logs"
ON public.user_roles_audit
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id_safe(auth.uid())
  AND public.is_admin_safe(auth.uid())
);

-- System can insert audit logs (via trigger)
CREATE POLICY "System can insert audit logs"
ON public.user_roles_audit
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Step 8: Create trigger for audit logging
CREATE OR REPLACE FUNCTION public.audit_user_roles_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.user_roles_audit (
      user_id, role, tenant_id, action, performed_by_user_id, new_values
    ) VALUES (
      NEW.user_id, NEW.role, NEW.tenant_id, 'granted', 
      NEW.granted_by_user_id, to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.user_roles_audit (
      user_id, role, tenant_id, action, performed_by_user_id, 
      old_values, new_values
    ) VALUES (
      NEW.user_id, NEW.role, NEW.tenant_id, 
      CASE WHEN NEW.is_active = false THEN 'revoked' ELSE 'modified' END,
      auth.uid(), to_jsonb(OLD), to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.user_roles_audit (
      user_id, role, tenant_id, action, performed_by_user_id, old_values
    ) VALUES (
      OLD.user_id, OLD.role, OLD.tenant_id, 'revoked', 
      auth.uid(), to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER user_roles_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles_changes();

-- Step 9: Create trigger to auto-update updated_at
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add helpful comment
COMMENT ON TABLE public.user_roles IS 'Stores user roles with proper RBAC. Replaces role columns in profiles/clinicians tables to prevent privilege escalation and enable proper auditing.';
COMMENT ON TABLE public.user_roles_audit IS 'Audit log for all role changes. Immutable record for compliance and security investigations.';
COMMENT ON FUNCTION public.has_role IS 'SECURITY DEFINER function to check user roles without triggering RLS recursion.';
COMMENT ON FUNCTION public.is_admin_safe IS 'SECURITY DEFINER function to check admin status. Replaces old is_admin() to prevent RLS recursion.';
COMMENT ON FUNCTION public.get_user_tenant_id_safe IS 'SECURITY DEFINER function to get tenant ID. Replaces old get_user_tenant_id() to prevent RLS recursion.';