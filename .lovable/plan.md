

# Server-Authoritative Timezone Conversion for Staff Portal

## The Problem (confirmed by debug logs)

Luxon's `setZone('America/Chicago')` returns `offset: 0` and `hour: 16` (unchanged from UTC input). The browser's `Intl` API in the production environment does not have timezone data, so **every client-side timezone library silently fails** -- both `date-fns-tz` and Luxon produce UTC values instead of local values.

This affects two directions:
- **Reads (Edit form)**: `utcToLocalStrings` shows UTC time instead of local time
- **Writes (Create/Edit save)**: `localToUTC` uses `date-fns-tz`'s `fromZonedTime`, which also depends on `Intl` -- meaning new appointments may be stored with wrong UTC values

The calendar display works because it uses `get_staff_calendar_appointments` RPC, which does all conversion inside PostgreSQL using `AT TIME ZONE`. **PostgreSQL is the only reliable timezone engine in this stack.**

## The Decision: Eliminate All Client-Side Timezone Conversion

Move to 100% server-authoritative timezone handling, matching the pattern the client portal already uses successfully. This is not a preference -- it is the only correct option given the confirmed environmental constraint.

**Why not "fix" the client-side libraries?**
The `Intl` API limitation is a property of the deployment environment, not a bug in the libraries. There is no client-side fix. Any library that calls `Intl.DateTimeFormat` with a timezone will fail the same way.

## Scope of Changes

### 1. Fix READS: Edit Form Prepopulation

**File:** `src/components/Appointments/AppointmentView.tsx`

The `AppointmentView` component already has access to `display_date`, `display_time`, `display_end_time`, `start_hour`, `start_minute` etc. from the `StaffAppointment` interface (provided by `useStaffAppointments`). When it passes the appointment to `AppointmentForm` for editing, it currently only passes `start_at` (raw UTC), forcing the form to reconvert.

**Change:** Pass server-resolved time components into `AppointmentForm` so it never needs to call `utcToLocalStrings`.

**File:** `src/components/Appointments/AppointmentForm.tsx`

- Remove the `utcToLocalStrings` import and usage in `getInitialValues`
- Accept server-provided date/time strings (from the RPC) as props
- Use those directly as `defaultValues` for the date and time form fields

### 2. Fix WRITES: Appointment Creation and Editing

**File:** `src/lib/appointmentTimezone.ts`

Replace the `localToUTC` implementation. Instead of using `date-fns-tz`'s `fromZonedTime` (which depends on broken `Intl`), use pure arithmetic with Luxon's `DateTime.fromObject` with an explicit `zone` parameter, then call `.toUTC().toISO()`. 

**However** -- since we just proved Luxon's `setZone` also fails in this environment, Luxon arithmetic will also produce wrong results. Therefore:

**The real fix for writes:** Create a small PostgreSQL RPC function (e.g., `convert_local_to_utc`) that accepts a date string, time string, and timezone, and returns the UTC timestamp. This moves the write-path conversion server-side too, matching the read path. The function is trivial:

```sql
CREATE OR REPLACE FUNCTION convert_local_to_utc(
  p_date TEXT,
  p_time TEXT, 
  p_timezone TEXT DEFAULT 'America/New_York'
) RETURNS TIMESTAMPTZ
LANGUAGE SQL STABLE
AS $$
  SELECT (p_date || ' ' || p_time)::TIMESTAMP AT TIME ZONE p_timezone;
$$;
```

**Files affected:**
- `src/hooks/useAppointmentCreation.tsx` -- call RPC instead of `localToUTC`
- `src/hooks/useAppointmentSeries.tsx` -- call RPC instead of `localToUTC`
- `src/components/Appointments/AppointmentForm.tsx` -- call RPC instead of `localToUTC` in `handleSubmit`

### 3. Propagate Server Data Through the Edit Flow

**File:** `src/components/Appointments/AppointmentView.tsx` (lines 210-218)

Currently passes a stripped-down object to `AppointmentForm`. Expand this to include:
- `display_date` (for prepopulating the date input)
- `start_hour`, `start_minute` (for prepopulating the time input)
- Or simply pass a pre-formatted `YYYY-MM-DD` date and `HH:mm` time derived from the RPC's time components

The `StaffAppointment` interface already includes `start_year`, `start_month`, `start_day`, `start_hour`, `start_minute` from the RPC. These can be formatted into `YYYY-MM-DD` and `HH:mm` strings trivially without any timezone conversion.

### 4. Clean Up Dead Code

- Remove `utcToLocalStrings` from `appointmentTimezone.ts` (no longer called anywhere)
- Remove `localToUTC` and `localToUTCDate` from `appointmentTimezone.ts` (replaced by RPC)
- Remove `formatUTCAsLocal` if unused
- Remove `fromZonedTime` import from `date-fns-tz`
- Keep `calculateEndUTC` and `calculateEndDate` (pure arithmetic, no timezone logic)
- Keep `getDBTimezoneEnum` (simple string mapping)
- Remove the debug `console.log` added in the previous step

### 5. Update `AppointmentView` Metadata Timestamps

Lines 98-110 in `AppointmentView.tsx` use `dt.setZone(appointmentTimezone)` for `created_at` and `updated_at` display. These will also show wrong times. Either:
- Accept slightly wrong metadata timestamps (low impact), or
- Add `display_created_at` and `display_updated_at` to the RPC return (preferred for consistency)

## Execution Order

1. Create the `convert_local_to_utc` database function
2. Update `AppointmentForm` interface to accept server-resolved date/time props, remove `utcToLocalStrings`
3. Update `AppointmentView` to pass server-resolved date/time when entering edit mode
4. Replace `localToUTC` calls in `useAppointmentCreation`, `useAppointmentSeries`, and `AppointmentForm.handleSubmit` with the new RPC call
5. Clean up dead code in `appointmentTimezone.ts`
6. Remove debug logging
7. Test create and edit flows

## Architecture After This Change

```
READS (display):
  PostgreSQL AT TIME ZONE --> pre-formatted strings --> React renders as-is

WRITES (save):
  User input (date + time) --> PostgreSQL convert_local_to_utc RPC --> UTC timestamptz stored

Client-side timezone code:
  None. Zero. Eliminated entirely.
```

This matches the client portal architecture exactly and makes PostgreSQL the single authority for all timezone operations in both directions.

