
-- =============================================================
-- Phase 1: staff_calendar_blocks + calendar_watch_channels
-- =============================================================

-- Table: staff_calendar_blocks
-- Stores external calendar busy periods (Google, etc.)
CREATE TABLE public.staff_calendar_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  staff_id uuid NOT NULL REFERENCES public.staff(id),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'google',
  external_event_id text,
  summary text NOT NULL DEFAULT 'Busy',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint for dedup: one external event per staff per source
CREATE UNIQUE INDEX uq_staff_calendar_blocks_dedup
  ON public.staff_calendar_blocks (staff_id, source, external_event_id)
  WHERE external_event_id IS NOT NULL;

-- Fast range queries for availability checks
CREATE INDEX idx_staff_calendar_blocks_availability
  ON public.staff_calendar_blocks (staff_id, start_at, end_at);

-- Tenant scoping index
CREATE INDEX idx_staff_calendar_blocks_tenant
  ON public.staff_calendar_blocks (tenant_id);

-- Enable RLS
ALTER TABLE public.staff_calendar_blocks ENABLE ROW LEVEL SECURITY;

-- Staff can read their own blocks
CREATE POLICY "Staff can view their own calendar blocks"
  ON public.staff_calendar_blocks
  FOR SELECT
  USING (
    staff_id IN (
      SELECT s.id FROM public.staff s
      WHERE s.profile_id = auth.uid()
    )
  );

-- Service role can do everything (Edge Functions use service role)
CREATE POLICY "Service role full access to calendar blocks"
  ON public.staff_calendar_blocks
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER set_staff_calendar_blocks_updated_at
  BEFORE UPDATE ON public.staff_calendar_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- =============================================================
-- Table: calendar_watch_channels
-- Tracks Google push notification subscriptions
-- =============================================================
CREATE TABLE public.calendar_watch_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  staff_id uuid NOT NULL REFERENCES public.staff(id),
  channel_id text NOT NULL,
  resource_id text NOT NULL,
  calendar_id text NOT NULL,
  expiration timestamptz NOT NULL,
  sync_token text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for webhook validation lookups
CREATE INDEX idx_calendar_watch_channels_channel
  ON public.calendar_watch_channels (channel_id);

-- Index for renewal queries
CREATE INDEX idx_calendar_watch_channels_expiration
  ON public.calendar_watch_channels (expiration);

-- Enable RLS
ALTER TABLE public.calendar_watch_channels ENABLE ROW LEVEL SECURITY;

-- Service role only (Edge Functions manage these)
CREATE POLICY "Service role full access to watch channels"
  ON public.calendar_watch_channels
  FOR ALL
  USING (true)
  WITH CHECK (true);


-- =============================================================
-- Phase 7: check_staff_availability function
-- =============================================================
CREATE OR REPLACE FUNCTION public.check_staff_availability(
  p_staff_id uuid,
  p_start timestamptz,
  p_end timestamptz
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM appointments
    WHERE staff_id = p_staff_id
      AND status = 'scheduled'
      AND start_at < p_end
      AND end_at > p_start
  )
  AND NOT EXISTS (
    SELECT 1 FROM staff_calendar_blocks
    WHERE staff_id = p_staff_id
      AND start_at < p_end
      AND end_at > p_start
  );
$$;
