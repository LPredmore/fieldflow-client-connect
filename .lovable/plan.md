

# Fix Edit Form 9:00 AM Default and Misplaced Busy Blocks

## Two Bugs, One Root Cause

Both issues stem from incomplete adoption of the server-authoritative timezone model. Some code paths still rely on the browser's broken `Intl` API or simply never received the server-computed data.

---

## Bug 1: Edit Form Always Shows 9:00 AM

### What is happening

The RPC `get_staff_calendar_appointments` returns seven time component columns for every appointment: `start_year`, `start_month`, `start_day`, `start_hour`, `start_minute`, `end_hour`, `end_minute`. These are correct -- PostgreSQL computes them using `AT TIME ZONE`.

The `useStaffAppointments` hook reads these columns to build `calendar_start` and `calendar_end` Date objects (lines 177-192), but then **discards them**. The `StaffAppointment` interface (lines 12-51) does not declare `start_year`, `start_month`, `start_day`, `start_hour`, or `start_minute` as fields, and the object constructed at lines 194-221 never maps them.

When `AppointmentView` tries to build `serverLocalDate` and `serverLocalTime` (lines 216-235), it accesses `appointment.start_year` etc., but these are all `undefined` because they were never carried through. The fallback in `AppointmentForm.getInitialValues` (line 105) then fires: `time: '09:00'`.

### The fix

Add `start_year`, `start_month`, `start_day`, `start_hour`, and `start_minute` to the `StaffAppointment` interface and populate them in the transform mapping inside `useStaffAppointments`. No new RPC, no new database function -- the data is already there, it just gets dropped at the TypeScript mapping step.

### Files changed

- `src/hooks/useStaffAppointments.tsx`
  - Add five fields to the `StaffAppointment` interface: `start_year: number`, `start_month: number`, `start_day: number`, `start_hour: number`, `start_minute: number`
  - Add five lines to the transform object (around line 218): `start_year: row.start_year`, `start_month: row.start_month`, `start_day: row.start_day`, `start_hour: row.start_hour`, `start_minute: row.start_minute`

That is the entire fix for Bug 1. No other files need changes -- `AppointmentView` already reads these fields and formats them for `AppointmentForm`, which already accepts `server_local_date` and `server_local_time`.

---

## Bug 2: Busy Block at 5 AM on Feb 19 (Should Be 11 PM on Feb 18)

### What is happening

The database contains a Google Calendar block:
- `start_at`: `2026-02-19 05:00:00+00` (UTC)
- `end_at`: `2026-02-19 06:00:00+00` (UTC)

In `America/Chicago` (UTC-6), this is **February 18, 11:00 PM to midnight**. But `useStaffCalendarBlocks` uses `createFakeLocalDateFromISO`, which calls `Intl.DateTimeFormat` with `timeZone: 'America/Chicago'`. In the production environment, this API is broken and returns UTC components (offset 0), so the block renders at 5:00 AM on Feb 19.

### The fix

Apply the same server-authoritative pattern: create a small PostgreSQL RPC that fetches calendar blocks with server-side timezone conversion, returning integer time components just like `get_staff_calendar_appointments` does for appointments.

### New database function

```sql
CREATE OR REPLACE FUNCTION get_staff_calendar_blocks(
  p_staff_id UUID,
  p_from_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  id UUID,
  staff_id UUID,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  source TEXT,
  summary TEXT,
  start_year INT, start_month INT, start_day INT,
  start_hour INT, start_minute INT,
  end_year INT, end_month INT, end_day INT,
  end_hour INT, end_minute INT
)
```

This function looks up the staff member's `prov_time_zone` and uses `EXTRACT(... FROM timestamp AT TIME ZONE tz)` to return integer components, exactly matching the appointments RPC pattern.

### Hook refactor

`useStaffCalendarBlocks` will:
- Call the new RPC instead of a direct table query
- Use `createFakeLocalDate(year, month, day, hour, minute)` (the same function already in `useStaffAppointments`) instead of `createFakeLocalDateFromISO`
- Delete the broken `createFakeLocalDateFromISO` function entirely

### Files changed

- New migration: create `get_staff_calendar_blocks` function
- `src/hooks/useStaffCalendarBlocks.tsx`: replace direct query with RPC call, use integer components for fake local dates, remove `createFakeLocalDateFromISO`

---

## Bug 2b: Metadata Timestamps (created_at, updated_at)

`AppointmentView` lines 104-116 use `dt.setZone(appointmentTimezone)` via Luxon to format `created_at` and `updated_at`. This also produces wrong times due to the same broken `Intl` API. Since this is low-priority metadata (not clinical data), the fix is to use the `format_timestamp_in_timezone` PostgreSQL function that already exists in the database, called via RPC when the view renders. Alternatively, accept slightly wrong metadata timestamps for now and address in a follow-up.

**Decision**: Use the existing `format_timestamp_in_timezone` database function via RPC for these two values. This keeps the "zero client-side timezone conversion" guarantee complete rather than leaving a known-broken path in the code.

### Files changed

- `src/components/Appointments/AppointmentView.tsx`: Replace Luxon-based `displayCreatedAt` and `displayUpdatedAt` with calls to `format_timestamp_in_timezone` RPC, or accept raw UTC display with a "(UTC)" label as a simpler alternative.

---

## Execution Order

1. Add `start_year/month/day/hour/minute` to `StaffAppointment` interface and mapping (fixes Bug 1)
2. Create `get_staff_calendar_blocks` database function (migration)
3. Refactor `useStaffCalendarBlocks` to use the new RPC (fixes Bug 2)
4. Fix metadata timestamp display in `AppointmentView` (fixes Bug 2b)
5. Remove dead `createFakeLocalDateFromISO` function

## What This Does NOT Change

- No database table columns are modified (respecting the custom knowledge constraint)
- No changes to appointment creation or write path (already fixed in prior work)
- No changes to the calendar grid display (already working via fake local dates)
- No changes to client portal code

