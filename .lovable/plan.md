

# Fix: Current Time Indicator Using Staff Timezone

## Problem

The green "current time" line on the calendar shows the wrong time because react-big-calendar's internal clock uses a plain `new Date()`, which returns the browser's local time (or UTC depending on the localizer). Meanwhile, all appointment events are positioned using "fake local" Date objects where `getHours()` returns the staff's timezone hour. These two coordinate systems don't match, so the line appears in the wrong place.

## Why this is the correct fix

The system already uses a "fake local Date" pattern: appointment Dates are constructed so that `getHours()` returns the staff's local hour, tricking react-big-calendar into correct grid positioning. The current-time indicator must use the same trick. The utility function `getFakeLocalNow(timezone)` in `src/lib/timezoneUtils.ts` already exists for exactly this purpose -- it creates a fake local Date representing "right now" in the staff's timezone. It just needs to be wired into the calendar.

react-big-calendar accepts a `getNow` prop -- a function that returns a Date used for both the red/green time indicator line and for determining "today" highlighting. Passing a function that calls `getFakeLocalNow(staffTimezone)` aligns the indicator with the same coordinate system used by events.

## Change: `src/components/Calendar/RBCCalendar.tsx`

One edit:

1. Import `getFakeLocalNow` from `@/lib/timezoneUtils`
2. Create a memoized `getNow` callback that returns `getFakeLocalNow(authStaffTimezone)`
3. Pass `getNow={getNow}` to the `<Calendar>` component

That is the entire change. No new files, no database changes, no other components affected.

## Technical detail

```text
Before:
  <Calendar localizer={localizer} ... />
  (no getNow prop --> library uses new Date() --> wrong coordinate system)

After:
  <Calendar localizer={localizer} getNow={getNow} ... />
  getNow = () => getFakeLocalNow(authStaffTimezone)
  (returns fake local Date where getHours() = staff's current hour)
```

`getFakeLocalNow` uses `formatInTimeZone` from date-fns-tz to get the real hour/minute in the staff's timezone, then constructs a Date with those values set via `setHours()`. This is the same pattern used by `createFakeLocalDate` in `useStaffAppointments`, so the indicator and events share the same coordinate system.

