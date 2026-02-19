
-- ============================================================
-- 1. Create staff_availability_schedules table
-- ============================================================
CREATE TABLE public.staff_availability_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id),
  staff_id    UUID NOT NULL REFERENCES public.staff(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id, day_of_week, start_time)
);

-- Enable RLS
ALTER TABLE public.staff_availability_schedules ENABLE ROW LEVEL SECURITY;

-- RLS: Staff can SELECT their own rows
CREATE POLICY "Staff can view own availability"
  ON public.staff_availability_schedules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_availability_schedules.staff_id
        AND s.profile_id = auth.uid()
    )
  );

-- RLS: Staff can INSERT their own rows
CREATE POLICY "Staff can insert own availability"
  ON public.staff_availability_schedules
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_availability_schedules.staff_id
        AND s.profile_id = auth.uid()
    )
  );

-- RLS: Staff can UPDATE their own rows
CREATE POLICY "Staff can update own availability"
  ON public.staff_availability_schedules
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_availability_schedules.staff_id
        AND s.profile_id = auth.uid()
    )
  );

-- RLS: Staff can DELETE their own rows
CREATE POLICY "Staff can delete own availability"
  ON public.staff_availability_schedules
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_availability_schedules.staff_id
        AND s.profile_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER set_staff_availability_schedules_updated_at
  BEFORE UPDATE ON public.staff_availability_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. Add RLS policies on staff_calendar_blocks for manual blocks
-- ============================================================

-- INSERT: staff can insert manual blocks for themselves
CREATE POLICY "Staff can insert manual blocks"
  ON public.staff_calendar_blocks
  FOR INSERT
  WITH CHECK (
    source = 'manual'
    AND EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_calendar_blocks.staff_id
        AND s.profile_id = auth.uid()
    )
  );

-- UPDATE: staff can update their own manual blocks
CREATE POLICY "Staff can update manual blocks"
  ON public.staff_calendar_blocks
  FOR UPDATE
  USING (
    source = 'manual'
    AND EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_calendar_blocks.staff_id
        AND s.profile_id = auth.uid()
    )
  );

-- DELETE: staff can delete their own manual blocks
CREATE POLICY "Staff can delete manual blocks"
  ON public.staff_calendar_blocks
  FOR DELETE
  USING (
    source = 'manual'
    AND EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_calendar_blocks.staff_id
        AND s.profile_id = auth.uid()
    )
  );
