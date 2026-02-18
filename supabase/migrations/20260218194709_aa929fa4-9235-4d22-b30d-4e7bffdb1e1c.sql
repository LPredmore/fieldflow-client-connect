-- Drop the partial index that doesn't work with ON CONFLICT
DROP INDEX IF EXISTS public.uq_staff_calendar_blocks_dedup;

-- Add a proper unique constraint that ON CONFLICT can target
ALTER TABLE public.staff_calendar_blocks
  ADD CONSTRAINT uq_staff_calendar_blocks_dedup
  UNIQUE (staff_id, source, external_event_id);