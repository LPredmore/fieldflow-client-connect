

# Fix: Appointment Display, Edit, and Calendar Block Timezone Issues

## What's Broken and Why

Three bugs, all caused by code paths that bypass the server-side timezone pipeline (the `get_staff_calendar_appointments` RPC) and attempt to re-derive timezone data independently, which fails.

### Bug 1: Blank Date/Time in Appointment Details (Calendar page)
When you click an appointment on the calendar, `RBCCalendar.tsx` runs a **raw Supabase query** (lines 189-230) against the `appointments` table. This raw query does NOT return `display_date`, `display_time`, or `display_end_time` -- those only exist in the RPC response. Meanwhile, `AppointmentView` renders those fields, so they show as blank.

The irony: the hook `useStaffAppointments` already has the full data loaded AND exposes a `getAppointmentById()` helper. The raw query is completely redundant.

### Bug 2: Edit Form Shows Wrong Time (5 AM instead of 11 PM)
`AppointmentForm.tsx` calls `splitUTCToLocalDateTime(appointment.start_at, userTimezone)` where `userTimezone` comes from `useStaffTimezone()`. That hook reads from `user.roleContext.staffData.prov_time_zone`. In the Lovable preview environment (which runs in UTC), if the auth data hasn't fully loaded yet or the value is missing, the conversion treats `05:00 UTC` as `05:00 America/New_York` -- producing the wrong result.

Additionally, `AppointmentView` strips out `display_timezone` when constructing the `formAppointment` object passed to `AppointmentForm` (lines 210-219), so even if we added a `resolvedTimezone` prop, the current code wouldn't pass it.

The save path has the same problem: `handleSubmit` in `AppointmentForm` uses `combineDateTimeToUTC(date, time, userTimezone)` where `userTimezone` comes from the same potentially-unloaded hook.

### Bug 3: Calendar Blocks at Wrong Time Slot
In `RBCCalendar.tsx`, the `staffTimezone` passed to `useStaffCalendarBlocks` comes from `useStaffAppointments`'s state variable, which is only set after appointments load (line 226 in the hook -- `setStaffTimezone` fires only when appointments return). If blocks load before appointments, the timezone is empty string, and `useStaffCalendarBlocks` falls back to `'America/New_York'`, which may not be correct.

---

## The Correct Technical Decision

**Use the already-resolved data from `useStaffAppointments` everywhere on the calendar page, and use `useFreshStaffTimezone` for the edit/create path.**

The principle: the `get_staff_calendar_appointments` RPC is the authoritative timezone source. It looks up `prov_time_zone` server-side with zero race conditions. Every frontend path should either (a) use data the RPC already provided, or (b) use `useFreshStaffTimezone` which does a direct DB query with a loading gate (returns `null` until the query completes).

I am NOT proposing we add a `resolvedTimezone` prop to `AppointmentForm`. That creates a dual-source pattern where sometimes the timezone comes from a prop and sometimes from the hook. Instead, `AppointmentForm` should switch from `useStaffTimezone()` (which can race) to `useFreshStaffTimezone()` (which blocks until the DB query completes). This fixes both the display AND save paths in one change, with no API changes to the component.

---

## Changes (4 files)

### Change 1: RBCCalendar.tsx -- Use `getAppointmentById` instead of raw query

**Remove:**
- The `selectedAppointment` state
- The `useEffect` that fetches from `supabase.from('appointments')` (lines 189-230)
- The `handleUpdateAppointment` function (lines 233-247)

**Replace with:**
- Derive `selectedAppointment` from `getAppointmentById(selectedAppointmentId)` (already available from the hook)
- Use the hook's `updateAppointment` for the `onUpdate` callback
- Pass the full `StaffAppointment` object to `AppointmentView`, which already has `display_date`, `display_time`, `display_end_time`, and `display_timezone`

**Risk: Missing client_email/client_phone.** The RPC does not return these fields. However, `AppointmentView` already conditionally renders them (`{appointment.client_email && ...}`), so they will simply not appear. This is acceptable -- contact info belongs on the client detail page, not an appointment popup.

**Risk: Out-of-range appointments.** The hook only loads a 14-day lookback / 90-day forward window. If a user navigates outside this range, `getAppointmentById` would return `undefined`. The calendar already constrains visible events to loaded data, so clicking an event that isn't loaded is impossible.

### Change 2: RBCCalendar.tsx -- Decouple block timezone from appointment loading

**Currently:** `staffTimezone` is a state variable set only after appointments load.

**Fix:** Import `useStaffTimezone()` directly in `RBCCalendar` and pass it to `useStaffCalendarBlocks`. This provides an immediate timezone value from auth context, independent of whether appointments have loaded.

Also use this value for the timezone mismatch indicator, which currently depends on the same delayed state.

### Change 3: AppointmentForm.tsx -- Switch to `useFreshStaffTimezone`

**Currently:** Uses `useStaffTimezone()` which reads from cached auth data and can race.

**Fix:** Switch to `useFreshStaffTimezone()` which:
1. Makes a direct DB query for `prov_time_zone` on mount
2. Returns `null` for timezone until the query completes
3. Falls back to `'America/New_York'` if no timezone is set

Show a loading state while the timezone is resolving (the query takes milliseconds). This fixes BOTH the initial form population (`splitUTCToLocalDateTime`) AND the save path (`combineDateTimeToUTC`), because both use the same `userTimezone` variable.

### Change 4: AppointmentView.tsx -- Pass `display_timezone` to AppointmentForm

Currently (lines 210-219), `AppointmentView` constructs a stripped-down `formAppointment` object that omits `display_timezone`. Since `AppointmentForm` now uses `useFreshStaffTimezone` internally, this is no longer strictly needed for the timezone. However, we should still keep the interface clean by not stripping useful data unnecessarily.

No interface changes to `AppointmentForm` are needed. The component self-resolves its timezone.

---

## What This Does NOT Change

- **No database changes.** The constraint migration from the previous message is the only DB change needed.
- **No Edge Function changes.** Inbound and outbound sync are working correctly.
- **No changes to `useStaffAppointments`, `useAllAppointments`, `useAppointmentCreation`, or `useAppointmentSeries`.** These are all correct.
- **No changes to the Appointments list page (`Appointments.tsx`).** It uses `useAllAppointments` which formats dates using browser-local time via `toLocaleDateString`. This is a separate, less-critical concern (browser-local is acceptable for a list view -- it shows approximate dates, not grid-positioned times).
- **No changes to the Dashboard (`Index.tsx`).** It correctly uses `useStaffAppointments` data throughout.

---

## Summary Table

```text
Bug                         Root Cause                              Fix
-------------------------   --------------------------------------  ------------------------------------------
Blank details on calendar   Raw query bypasses RPC display fields   Use getAppointmentById() from hook
Wrong edit time (5 AM)       useStaffTimezone() races on load        Switch to useFreshStaffTimezone() which
                                                                    blocks until DB query completes
Wrong save (would save 5AM) Same race condition on save path        Same fix -- useFreshStaffTimezone()
Blocks at wrong position    staffTimezone depends on appt loading   Use useStaffTimezone() directly for blocks
```

