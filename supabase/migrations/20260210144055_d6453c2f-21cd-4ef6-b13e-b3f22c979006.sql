
-- Create training_videos table
CREATE TABLE public.training_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  title TEXT NOT NULL,
  description TEXT,
  drive_file_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.training_videos ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated users within the same tenant
CREATE POLICY "Authenticated users can view training videos in their tenant"
  ON public.training_videos
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT s.tenant_id FROM public.staff s WHERE s.profile_id = auth.uid()
    )
  );

-- INSERT: Only ADMIN or ACCOUNT_OWNER staff roles
CREATE POLICY "Admins can insert training videos"
  ON public.training_videos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_role_assignments sra
      JOIN public.staff_roles sr ON sr.id = sra.staff_role_id
      JOIN public.staff st ON st.id = sra.staff_id
      WHERE st.profile_id = auth.uid()
        AND sra.tenant_id = training_videos.tenant_id
        AND sr.code IN ('ADMIN', 'ACCOUNT_OWNER')
    )
  );

-- UPDATE: Only ADMIN or ACCOUNT_OWNER staff roles
CREATE POLICY "Admins can update training videos"
  ON public.training_videos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_role_assignments sra
      JOIN public.staff_roles sr ON sr.id = sra.staff_role_id
      JOIN public.staff st ON st.id = sra.staff_id
      WHERE st.profile_id = auth.uid()
        AND sra.tenant_id = training_videos.tenant_id
        AND sr.code IN ('ADMIN', 'ACCOUNT_OWNER')
    )
  );

-- DELETE: Only ADMIN or ACCOUNT_OWNER staff roles
CREATE POLICY "Admins can delete training videos"
  ON public.training_videos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_role_assignments sra
      JOIN public.staff_roles sr ON sr.id = sra.staff_role_id
      JOIN public.staff st ON st.id = sra.staff_id
      WHERE st.profile_id = auth.uid()
        AND sra.tenant_id = training_videos.tenant_id
        AND sr.code IN ('ADMIN', 'ACCOUNT_OWNER')
    )
  );

-- Index for tenant filtering and ordering
CREATE INDEX idx_training_videos_tenant_active ON public.training_videos(tenant_id, is_active, sort_order);

-- Trigger for auto-updating updated_at
CREATE TRIGGER set_training_videos_updated_at
  BEFORE UPDATE ON public.training_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
