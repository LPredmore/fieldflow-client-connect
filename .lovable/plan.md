

# Fix: AppointmentForm Using Broken Timezone Library

## Problem Summary

The Edit Appointment form shows UTC time (e.g., 7:00 PM) instead of the staff member's local time (1:00 PM CST). The timezone hook fix we applied earlier is working correctly -- the real bug is that `AppointmentForm` calls a conversion function (`splitUTCToLocalDateTime`) that uses a broken library (`date-fns-tz`), when a working Luxon-based equivalent (`utcToLocalStrings`) already exists in the codebase but is not being used.

## Root Cause

`splitUTCToLocalDateTime` in `src/lib/timezoneUtils.ts` calls `formatInTimeZone()` from `date-fns-tz` v3.x, which silently fails to apply the timezone conversion in the Lovable preview environment (UTC system timezone). It returns the raw UTC hour instead of the converted local hour.

Meanwhile, `src/lib/appointmentTimezone.ts` already contains `utcToLocalStrings()` -- a Luxon-based function that does the exact same conversion correctly and reliably.

## The Fix

**One file change: `src/components/Appointments/AppointmentForm.tsx`**

### Step 1: Change the import

Replace:
```
import { combineDateTimeToUTC, splitUTCToLocalDateTime } from '@/lib/timezoneUtils';
```

With:
```
import { utcToLocalStrings, localToUTC } from '@/lib/appointmentTimezone';
```

### Step 2: Update `getInitialValues` (line 94)

Replace:
```
const { date, time } = splitUTCToLocalDateTime(appointment.start_at, userTimezone);
```

With:
```
const { date, time } = utcToLocalStrings(appointment.start_at, userTimezone);
```

### Step 3: Update `handleSubmit` (line 140)

Replace:
```
const utcStart = combineDateTimeToUTC(data.scheduled_date, data.start_time, userTimezone);
const utcEnd = new Date(utcStart.getTime() + data.duration_minutes * 60 * 1000);
```

With:
```
const utcStartISO = localToUTC(data.scheduled_date, data.start_time, userTimezone);
const utcStart = new Date(utcStartISO);
const utcEnd = new Date(utcStart.getTime() + data.duration_minutes * 60 * 1000);
```

Note: `localToUTC` returns an ISO string, so we wrap it in `new Date()` to maintain the same downstream behavior for `utcEnd` calculation and `.toISOString()` calls.

### Step 4: Remove debug logging

Remove the `console.log` statements added in the previous debugging session (lines 98-104 in `AppointmentForm.tsx` and the three logging statements in `useStaffTimezone.tsx`).

## Why This Is the Right Decision

1. **Luxon is already the canonical timezone library for this system.** The calendar (RBCCalendar), appointment display (AppointmentView), and the appointment utility file all use Luxon. `date-fns-tz` is a secondary dependency that has proven unreliable.

2. **`appointmentTimezone.ts` was specifically built for this purpose.** It has matching read/write functions (`utcToLocalStrings` / `localToUTC`) designed as a pair for appointment forms. Using them together ensures round-trip consistency.

3. **No new code is being written.** We are wiring up existing, tested functions instead of writing yet another conversion implementation.

4. **No database or schema changes.** The fix is purely a client-side import swap.

## What Is NOT Changing

- No changes to `timezoneUtils.ts` itself (other code may depend on it)
- No changes to the database, RPC functions, or edge functions
- No changes to `useFreshStaffTimezone` (it is now working correctly)
- No changes to `appointmentTimezone.ts` (it already has everything we need)

## Files Modified

| File | Change |
|------|--------|
| `src/components/Appointments/AppointmentForm.tsx` | Switch imports from `timezoneUtils` to `appointmentTimezone`; update two function calls; remove debug logs |
| `src/hooks/useStaffTimezone.tsx` | Remove debug console.log statements (cleanup only) |

