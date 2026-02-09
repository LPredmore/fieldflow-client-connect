

# Fix Telehealth Default and Post-Creation Refresh

## Changes

### 1. Telehealth defaults to ON

In `CreateAppointmentDialog`, change the initial `is_telehealth` value from `false` to `true`. This is the only behavioral change needed -- the form already has the toggle, it just starts in the wrong position.

### 2. Eliminate the duplicate "Create Appointment" dialog on the Calendar page

**Problem**: `Calendar.tsx` creates its own `CreateAppointmentDialog` in the page header, but it has no way to trigger a refresh of `RBCCalendar`'s internal data (which uses `useStaffAppointments`). Meanwhile, `RBCCalendar` already has its own `CreateAppointmentDialog` that correctly refreshes.

**Fix**: Remove the standalone dialog from `Calendar.tsx` entirely. Instead, add a `showCreateButton` prop to `RBCCalendar` (defaulting to `false`) so the calendar's own header can include the "Create Appointment" button. This keeps a single dialog instance that already has direct access to `refetch`. This is the architecturally correct approach because:

- It eliminates duplicate component instances doing the same thing
- The component that owns the data (`RBCCalendar` via `useStaffAppointments`) also owns the create action
- No prop-drilling or callback chains needed
- The existing `onAppointmentCreated={refetch}` wiring already works

**Files changed**:
- `src/pages/Calendar.tsx` -- Remove the `CreateAppointmentDialog` and import, simplify to just render heading + `CalendarWrapper`
- `src/components/Calendar/CalendarWrapper.tsx` -- Pass `showCreateButton` through to `RBCCalendar`
- `src/components/Calendar/RBCCalendar.tsx` -- Accept `showCreateButton` prop; render the "Create Appointment" button in the card header next to the title when true

### 3. Appointments page: ensure refresh after recurring creation

The `onAppointmentCreated` callback fires after the series is created, but the edge function that generates individual appointment rows runs asynchronously. By the time `refetchAppointments()` runs, the rows may not exist yet.

**Fix**: Add a small delay (1.5 seconds) before calling the refresh callback in `CreateAppointmentDialog` specifically for recurring appointments. This gives the `generate-appointment-occurrences` edge function time to insert the materialized rows before the list re-fetches. This is pragmatic -- the alternative (polling or WebSocket subscriptions) adds significant complexity for minimal gain.

**File changed**: `src/components/Appointments/CreateAppointmentDialog.tsx`

---

## Technical Summary

| File | Change |
|---|---|
| `src/components/Appointments/CreateAppointmentDialog.tsx` | Set `is_telehealth: true` in initial state; add 1.5s delay before callback for recurring appointments |
| `src/pages/Calendar.tsx` | Remove duplicate CreateAppointmentDialog; pass `showCreateButton` to CalendarWrapper |
| `src/components/Calendar/CalendarWrapper.tsx` | Accept and forward `showCreateButton` prop |
| `src/components/Calendar/RBCCalendar.tsx` | Accept `showCreateButton` prop; render create button in card header |

Four files, no database changes, no new dependencies.

