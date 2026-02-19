

# Show Availability Windows on the Calendar

## Approach: `slotPropGetter` to Dim Unavailable Slots

React Big Calendar's `slotPropGetter` callback is called for every 30-minute slot in the week/day views. It receives a `Date` object where `getDay()` returns 0-6 and `getHours()`/`getMinutes()` return the time -- which, thanks to the "fake local date" pattern already in use, correspond directly to the staff's local timezone.

The availability data in `staff_availability_schedules` is stored as plain `TIME` values (e.g., `09:00`, `17:00`) in the staff's local timezone with a `day_of_week` (0=Sunday, 6=Saturday).

This means **zero timezone conversion is needed**. The slot's `date.getHours()` already returns the staff-local hour, and the availability `start_time` is already in the staff-local hour. A simple numeric comparison determines whether a slot is inside or outside availability.

Slots outside the clinician's defined availability will be shaded with a subtle background color (light grey/striped), making it immediately obvious which times are open for booking. This is purely visual -- it does not prevent clicking to create appointments (clinicians may occasionally need to book outside their standard hours).

## Technical Details

### Data flow

1. `useStaffAvailability` already fetches all `staff_availability_schedules` rows for the logged-in staff
2. In `RBCCalendar`, import and call this hook
3. Build a lookup structure: `Map<dayOfWeek, Array<{startMinutes, endMinutes}>>` from active slots
4. Pass a `slotPropGetter` function that checks whether the slot falls inside any active availability window for that day
5. If outside all windows (or no windows defined for that day), return a dimmed background style

### Lookup logic (pseudocode)

```text
Parse "09:00" -> 540 minutes from midnight
Parse "17:00" -> 1020 minutes from midnight
Slot date -> day = date.getDay(), minutes = date.getHours() * 60 + date.getMinutes()
isAvailable = windows[day].some(w => minutes >= w.start && minutes < w.end)
```

### Files changed

**`src/components/Calendar/RBCCalendar.tsx`**
- Import `useStaffAvailability`
- Call the hook to get `slots` (the weekly schedule)
- Build a `useMemo` availability lookup map from active slots
- Add a `slotPropGetter` callback that dims slots outside availability
- Pass `slotPropGetter` to the `<Calendar>` component
- Add a small legend indicator in the header (e.g., "Grey = outside availability")

**`src/styles/react-big-calendar.css`**
- Add a CSS class `.rbc-slot-unavailable` with a subtle striped or dimmed background pattern for unavailable slots, ensuring it works in both light and dark mode

### No other files change

- No database changes
- No new hooks or components
- No timezone conversion (the data is already in the right coordinate space)
- `useStaffAvailability` is called read-only; no mutations
- Appointments and blocks continue to render exactly as before on top of the shaded grid

### Edge cases

- **No availability configured**: All slots render normally (no dimming) so the calendar looks unchanged until the clinician sets up their schedule
- **Month view**: `slotPropGetter` only fires in week/day views, so month view is unaffected (correct behavior -- time slots don't exist in month view)
- **Multiple windows per day** (split shifts): The lookup checks all windows for the day, so 9-12 and 1-5 both show as available with the lunch gap dimmed

