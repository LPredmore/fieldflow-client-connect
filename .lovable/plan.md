

# Fix: Inbound Google Calendar Sync Database Constraint

## Problem

The `staff_calendar_blocks` table has a **partial unique index** (line 22-24 of the migration):

```sql
CREATE UNIQUE INDEX uq_staff_calendar_blocks_dedup
  ON public.staff_calendar_blocks (staff_id, source, external_event_id)
  WHERE external_event_id IS NOT NULL;
```

Both Edge Functions (`google-calendar-webhook` and `google-calendar-watch-start`) use Supabase's `.upsert()` with `onConflict: "staff_id,source,external_event_id"`. PostgreSQL does not allow `ON CONFLICT` to target a partial unique index -- it requires a full unique constraint. This is why every upsert fails with:

> `"there is no unique or exclusion constraint matching the ON CONFLICT specification"`

The pipeline is otherwise fully functional: Google sends push notifications, the webhook receives them, fetches changed events, and attempts to write -- but the final database write always fails.

## Fix

A single migration that:

1. Drops the partial unique index `uq_staff_calendar_blocks_dedup`
2. Adds a proper unique constraint on `(staff_id, source, external_event_id)`

Since `external_event_id` is nullable, PostgreSQL's unique constraint treats NULLs as distinct (per SQL standard), so rows without an `external_event_id` will never conflict with each other -- which is the correct behavior. The partial index was unnecessary.

No Edge Function code changes are needed. The existing `onConflict` specification will work correctly once the real constraint exists.

## Technical Details

### Migration SQL

```sql
-- Drop the partial index that doesn't work with ON CONFLICT
DROP INDEX IF EXISTS public.uq_staff_calendar_blocks_dedup;

-- Add a proper unique constraint that ON CONFLICT can target
ALTER TABLE public.staff_calendar_blocks
  ADD CONSTRAINT uq_staff_calendar_blocks_dedup
  UNIQUE (staff_id, source, external_event_id);
```

### Why this is safe

- All Google-sourced events always have a non-null `external_event_id`, so the uniqueness behavior is identical to the partial index for real data.
- NULL values in `external_event_id` are treated as distinct by PostgreSQL unique constraints, so manually inserted blocks without an external ID will never collide.
- The table is currently empty (all upserts have been failing), so no data conflicts are possible.
- No existing tables are modified -- this only changes an index on the new `staff_calendar_blocks` table.

### Verification after deployment

After the migration runs, the next Google push notification will trigger the webhook, which will successfully upsert events into `staff_calendar_blocks`. The `useStaffCalendarBlocks` hook will then display them on the calendar as "Busy" background events.

