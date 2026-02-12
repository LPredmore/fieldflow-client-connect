
-- ============================================================
-- Google Calendar Sync: Two new additive tables
-- Zero changes to existing tables
-- ============================================================

-- 1. staff_calendar_connections
CREATE TABLE public.staff_calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  staff_id UUID NOT NULL REFERENCES public.staff(id),
  provider TEXT NOT NULL DEFAULT 'google',
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  selected_calendar_id TEXT,
  connection_status TEXT NOT NULL DEFAULT 'disconnected',
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, provider)
);

-- RLS
ALTER TABLE public.staff_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Staff can read their own connection (matched through staff.profile_id = auth.uid())
CREATE POLICY "Staff can view own calendar connection"
  ON public.staff_calendar_connections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_calendar_connections.staff_id
        AND s.profile_id = auth.uid()
    )
  );

-- Staff can update their own connection
CREATE POLICY "Staff can update own calendar connection"
  ON public.staff_calendar_connections
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_calendar_connections.staff_id
        AND s.profile_id = auth.uid()
    )
  );

-- Insert handled by edge functions using service role, but allow staff self-insert
CREATE POLICY "Staff can insert own calendar connection"
  ON public.staff_calendar_connections
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_calendar_connections.staff_id
        AND s.profile_id = auth.uid()
    )
  );

-- Staff can delete/disconnect their own
CREATE POLICY "Staff can delete own calendar connection"
  ON public.staff_calendar_connections
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_calendar_connections.staff_id
        AND s.profile_id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_staff_calendar_connections_updated_at
  BEFORE UPDATE ON public.staff_calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 2. calendar_sync_log
CREATE TABLE public.calendar_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id),
  staff_id UUID NOT NULL REFERENCES public.staff(id),
  google_event_id TEXT,
  google_calendar_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  sync_direction TEXT NOT NULL DEFAULT 'outbound',
  last_synced_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, staff_id)
);

-- RLS
ALTER TABLE public.calendar_sync_log ENABLE ROW LEVEL SECURITY;

-- Staff can view their own sync logs
CREATE POLICY "Staff can view own sync logs"
  ON public.calendar_sync_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = calendar_sync_log.staff_id
        AND s.profile_id = auth.uid()
    )
  );

-- Insert/update handled by edge functions via service role key
-- But allow staff to see status
CREATE POLICY "Staff can insert own sync logs"
  ON public.calendar_sync_log
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = calendar_sync_log.staff_id
        AND s.profile_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update own sync logs"
  ON public.calendar_sync_log
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = calendar_sync_log.staff_id
        AND s.profile_id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_calendar_sync_log_updated_at
  BEFORE UPDATE ON public.calendar_sync_log
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
