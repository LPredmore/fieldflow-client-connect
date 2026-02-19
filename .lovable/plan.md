

# Add Self-Scheduling Toggle and Slot Interval to Calendar Settings

## Summary

Add two new per-clinician settings to the Calendar Settings panel: (1) a toggle for whether the clinician allows client self-scheduling, and (2) a selector for whether clients can book on the hour only (60-minute intervals) or also on the half-hour (30-minute intervals). This requires two new columns on the `staff` table and a corresponding update to the `get_available_appointment_slots` database function.

## Why these belong on the `staff` table

Both settings are per-clinician preferences that directly affect how *their* availability is computed and presented. The `staff` table already holds analogous per-clinician flags (`prov_accepting_new_clients`, `prov_time_zone`). A separate settings table would add a join for no benefit.

## Database changes (migration)

### New columns on `staff`

| Column | Type | Default | Purpose |
|---|---|---|---|
| `prov_self_scheduling_enabled` | `boolean NOT NULL` | `false` | Whether this clinician's slots appear in the client self-scheduling flow |
| `prov_scheduling_interval_minutes` | `integer NOT NULL` | `60` | Slot step size: 60 = hour-only, 30 = half-hour |

Both columns are additive with safe defaults. Existing rows get `false` / `60`, so nothing changes for current users until they opt in.

### Update `get_available_appointment_slots` function

The function currently hardcodes `'30 minutes'::INTERVAL` for slot generation. Replace this with a dynamic lookup:

1. At the top of the function, query the staff member's `prov_scheduling_interval_minutes` value.
2. Use that value in the `generate_series` call instead of the hardcoded 30 minutes.

This keeps all slot math server-side (consistent with the project's "zero client-side timezone math" principle).

### Validation trigger

Add a validation trigger on `staff` that ensures `prov_scheduling_interval_minutes` is either 30 or 60 (using a trigger, not a CHECK constraint, per project guidelines).

## Frontend changes

### 1. CalendarSettingsPanel.tsx -- Add "Scheduling Preferences" collapsible

Add a fourth collapsible section titled **Scheduling Preferences** between Availability and Calendar Integration. It contains:

- **Allow Client Self-Scheduling** -- A `Switch` toggle with descriptive text: "When enabled, clients can book appointments during your available time slots."
- **Booking Interval** -- A `Select` dropdown with two options: "On the hour (e.g., 9:00, 10:00)" and "On the half-hour (e.g., 9:00, 9:30, 10:00)". Only visible/enabled when self-scheduling is turned on.

Both controls save immediately on change (same pattern as the Google Calendar selector -- no separate Save button).

### 2. New hook: useSchedulingPreferences.ts

A small hook that:
- Reads the current staff member's `prov_self_scheduling_enabled` and `prov_scheduling_interval_minutes` from the `staff` table (using the existing `staffId` from `useAuth`).
- Exposes `updatePreference(field, value)` that performs a targeted `supabase.from('staff').update(...)`.
- Calls `onSaved?.()` after a successful update so the calendar can refresh.

This is kept separate from `useStaffProfile` because `useStaffProfile` is a heavier general-purpose hook. A focused hook avoids re-fetching all staff fields on every toggle.

### 3. Update types in useStaffProfile.tsx and useStaffData.tsx

Add the two new fields to the `StaffMember` interfaces so TypeScript knows about them (the generated `types.ts` will update automatically after migration, but the manually-defined interfaces in hooks need the fields added).

### 4. No changes to CalendarToolbar, RBCCalendar, or appointments

These settings affect the *client-facing* slot generation function, not the staff calendar view. The staff calendar grid step size, appointment creation dialog, and toolbar remain unchanged.

## What does NOT change

- No existing columns modified or removed
- No changes to RLS policies (the staff table's existing policies already gate access)
- No changes to the CalendarToolbar, RBCCalendar, or appointment creation flow
- No changes to AvailabilitySettings or CalendarSettings components
- The `check_staff_availability` function is unaffected (it checks conflicts, not slot generation)

## Technical detail: migration SQL sketch

```text
-- 1. Add columns
ALTER TABLE staff
  ADD COLUMN prov_self_scheduling_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN prov_scheduling_interval_minutes integer NOT NULL DEFAULT 60;

-- 2. Validation trigger
CREATE OR REPLACE FUNCTION validate_scheduling_interval()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.prov_scheduling_interval_minutes NOT IN (30, 60) THEN
    RAISE EXCEPTION 'scheduling interval must be 30 or 60';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_scheduling_interval
  BEFORE INSERT OR UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION validate_scheduling_interval();

-- 3. Update slot generation function
--    Replace hardcoded '30 minutes' with staff preference lookup
```

## Risk assessment

**Low risk.** Two additive columns with safe defaults, a validation trigger, and a self-contained UI section. The only behavioral change is in `get_available_appointment_slots`, which gains a dynamic interval lookup instead of a hardcoded value -- a one-line change in the function body.

