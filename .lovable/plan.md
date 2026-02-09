

# Add `documented_at` Column to Appointments

## Summary

Add an immutable `documented_at` timestamptz column to the `appointments` table, set automatically by a database trigger when status transitions to `'documented'`. Backfill existing documented appointments using their `start_at` (session date), not `updated_at`.

## Why `start_at` for Backfill

For historical records, the date the session actually occurred is the correct payroll reference. `updated_at` could reflect any later edit and would introduce the same inaccuracy this feature is designed to eliminate. Going forward, the trigger captures the real-time moment of documentation.

## Database Migration

```text
-- 1. Add column
ALTER TABLE appointments ADD COLUMN documented_at timestamptz;

-- 2. Trigger function: set documented_at once on status -> 'documented'
CREATE OR REPLACE FUNCTION set_documented_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'documented'
     AND (OLD.status IS DISTINCT FROM 'documented')
     AND NEW.documented_at IS NULL THEN
    NEW.documented_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_documented_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION set_documented_at();

-- 3. Backfill: use session date (start_at) for existing documented appointments
UPDATE appointments
SET documented_at = start_at
WHERE status = 'documented' AND documented_at IS NULL;
```

## Application Code Changes

| File | Change |
|---|---|
| `src/integrations/supabase/types.ts` | Add `documented_at` to appointments Row, Insert, Update types |
| `src/schema/tables/appointments.ts` | Add `documented_at` column definition |
| `src/hooks/useStaffAppointments.tsx` | Add `documented_at` to `StaffAppointment` interface and row mapping |

## What Does NOT Change

- No existing columns modified
- `useSessionNote.tsx` unchanged -- the trigger handles everything
- No RLS policy changes needed
- `updated_at` continues to work as before

## Payroll Coordination

After deployment, any external system querying payroll dates should switch from `updated_at` to `documented_at`.
