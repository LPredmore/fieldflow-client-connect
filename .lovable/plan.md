

# Unified Timezone Fix: Server-Authoritative "Now" + Dead Code Cleanup

## Problem Statement

The system has three competing timezone strategies:

1. **Writes** (server-authoritative via `convert_local_to_utc` RPC) -- Working correctly
2. **Reads/Positioning** (server-authoritative via `get_staff_calendar_appointments` RPC returning integer components) -- Working correctly
3. **"Now" calculations** (client-side via `date-fns-tz` / `formatInTimeZone`) -- **Broken**: silently returns UTC in the production environment because the Intl API lacks timezone data

This causes two visible bugs:
- The green current-time indicator on the calendar shows UTC instead of the staff's local time
- Dashboard filters (Today's / Upcoming / Undocumented) use `getTodayInTimezone` and `getFakeLocalNow`, which also silently fall back to UTC, causing appointments to appear in the wrong category

Additionally, `AppointmentSeriesView` uses `formatInUserTimezone`, which ignores the timezone parameter entirely and formats in the browser's local timezone -- a third inconsistent behavior.

## Technical Decision

**Extend the server-authoritative model to cover "now".**

This is the only correct choice. Here is why the alternatives are wrong:

- **Native `Intl.DateTimeFormat`**: The existing comment in `appointmentTimezone.ts` explicitly documents that "the production environment's Intl API lacks timezone data." The same `Intl` API that `date-fns-tz` uses internally is what is failing. Using `Intl.DateTimeFormat` directly would fail for the same reason. We cannot verify this works without deploying and testing in production, making it a risky bet.

- **Browser timezone only**: Would work for the green line if the staff's system clock matches their profile timezone. But the system already handles timezone mismatches (the yellow "Showing times in X" badge exists). Staff using a VPN, traveling, or on a shared device would see incorrect results.

**Server-authoritative "now"** is the only approach that is guaranteed to work, because PostgreSQL's `AT TIME ZONE` is already proven reliable in this system. It uses the same code path as appointment positioning, which is already correct.

## Implementation Plan

### Phase 1: Create a PostgreSQL RPC for "now" components

Create a new database function `get_now_in_timezone` that returns the current time's integer components in a specified timezone:

```sql
CREATE OR REPLACE FUNCTION public.get_now_in_timezone(p_timezone text DEFAULT 'America/New_York')
RETURNS TABLE(
  now_year integer,
  now_month integer,
  now_day integer,
  now_hour integer,
  now_minute integer,
  today_date text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXTRACT(YEAR   FROM NOW() AT TIME ZONE p_timezone)::integer,
    EXTRACT(MONTH  FROM NOW() AT TIME ZONE p_timezone)::integer,
    EXTRACT(DAY    FROM NOW() AT TIME ZONE p_timezone)::integer,
    EXTRACT(HOUR   FROM NOW() AT TIME ZONE p_timezone)::integer,
    EXTRACT(MINUTE FROM NOW() AT TIME ZONE p_timezone)::integer,
    TO_CHAR(NOW() AT TIME ZONE p_timezone, 'YYYY-MM-DD');
$$;
```

This mirrors the exact pattern used in `get_staff_calendar_appointments` (EXTRACT + AT TIME ZONE), so it is guaranteed to produce consistent results.

### Phase 2: Create a `useServerNow` hook

A new hook that fetches "now" from the server on mount and refreshes every 60 seconds:

```text
src/hooks/useServerNow.ts
```

- Calls `get_now_in_timezone` RPC with the staff's `prov_time_zone`
- Returns `{ fakeLocalNow: Date, todayDate: string, isLoading: boolean }`
- `fakeLocalNow` is constructed using `createFakeLocalDate` (same pattern as appointments)
- `todayDate` is the `YYYY-MM-DD` string for dashboard filtering
- Refreshes every 60 seconds via `setInterval` to keep the green line moving
- Falls back to previous value during refresh (no loading flicker)

### Phase 3: Wire into RBCCalendar

In `src/components/Calendar/RBCCalendar.tsx`:

- Import and call `useServerNow(authStaffTimezone)`
- Replace `getNow={() => getFakeLocalNow(authStaffTimezone)}` with `getNow={() => serverNow.fakeLocalNow}`
- The `fakeLocalNow` Date is in the same coordinate system as the appointment `calendar_start` Dates, so the Luxon localizer's `diff` will produce correct results

### Phase 4: Wire into useStaffAppointments dashboard filters

In `src/hooks/useStaffAppointments.tsx`:

- Accept an optional `serverNow` parameter (or create a separate internal call)
- Replace `getTodayInTimezone(tz)` in `todaysAppointments` with the server-provided `today_date`
- Replace `getFakeLocalNow(tz)` in `upcomingAppointments` and `undocumentedAppointments` with the server-provided `fakeLocalNow`
- This ensures dashboard cards use the same server-authoritative time source

### Phase 5: Fix AppointmentSeriesView

In `src/components/Appointments/AppointmentSeriesView.tsx`:

- Replace `formatInUserTimezone(series.start_at, userTimezone, ...)` calls with the existing `format_timestamp_in_timezone` PostgreSQL RPC
- This eliminates the last place where timezone formatting pretends to use a timezone parameter but actually ignores it
- The series data already includes `time_zone`, so the RPC call has the correct timezone

### Phase 6: Clean up dead code in timezoneUtils.ts

Remove unused/broken functions from `src/lib/timezoneUtils.ts`:

- `getFakeLocalNow` (replaced by server-authoritative hook)
- `getTodayInTimezone` (replaced by server-authoritative hook)
- `getNowComponentsInTimezone` (replaced by server-authoritative hook)
- `combineDateTimeToUTC` (writes use `convert_local_to_utc` RPC)
- `convertToUTC` (already marked deprecated)
- `splitUTCToLocalDateTime` (unused)
- `convertFromUTC` (trivial wrapper, unused in meaningful way)
- `formatInUserTimezone` (replaced in Phase 5)
- `formatLocalTime` (only used by `formatInUserTimezone`)
- `getLocalDateTimeStrings` (only used by `splitUTCToLocalDateTime`)

Keep only:
- `normalizeTimestamp` + `parseUTCTimestamp` (used for parsing raw DB strings)
- `DEFAULT_TIMEZONE` constant
- `getDateFromFakeLocalDate` (used in dashboard filters)
- `calculateEndTime` (pure arithmetic)
- `toCalendarFormat` (pure formatting)

Remove the `date-fns-tz` import entirely from `timezoneUtils.ts`.

## Files Modified

| File | Change |
|------|--------|
| **New SQL migration** | `get_now_in_timezone` RPC |
| `src/hooks/useServerNow.ts` | **New file** - server-authoritative "now" hook |
| `src/components/Calendar/RBCCalendar.tsx` | Use `useServerNow` instead of `getFakeLocalNow` |
| `src/hooks/useStaffAppointments.tsx` | Use server "now" for dashboard filters |
| `src/components/Appointments/AppointmentSeriesView.tsx` | Use `format_timestamp_in_timezone` RPC |
| `src/lib/timezoneUtils.ts` | Remove all broken/dead functions, remove `date-fns-tz` import |

## What This Does NOT Touch (Confirmed Safe)

- **Appointment grid positioning**: Already uses server-provided integer components via `createFakeLocalDate` -- no change
- **Blocked time positioning**: Already uses server-provided integer components via `get_staff_calendar_blocks` RPC -- no change
- **Availability shading**: Uses raw `HH:MM:SS` strings from DB compared to slot hours -- no change
- **Writes (creating appointments/blocks)**: Already uses `convert_local_to_utc` RPC -- no change
- **Google Calendar sync**: Runs in Deno edge functions server-side -- no change
- **Database tables**: No columns added or modified

## Risk Assessment

- **Low risk**: The RPC pattern (`EXTRACT` + `AT TIME ZONE`) is identical to what already works for appointment positioning
- **Stale "now"**: The 60-second refresh interval means the green line could be up to 60 seconds behind. This is acceptable for a calendar UI. A 30-second interval could be used if needed.
- **Network dependency**: If the RPC call fails, the hook retains the last known value. On initial load failure, it falls back to `new Date()` (browser time) -- same behavior as today, no regression.
