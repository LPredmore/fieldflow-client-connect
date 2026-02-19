

# Calendar Refresh on Settings Change + Time Slot Pre-fill

## Summary

Two changes: (1) the calendar automatically refreshes when any setting in the Calendar Settings panel is saved, and (2) clicking a time slot on the calendar pre-fills the Create Appointment dialog with that exact time.

## Change 1: Calendar refreshes after settings changes

### The problem

`AvailabilitySettings` and `CalendarSettings` each instantiate their own data hooks internally. When the user saves inside the panel, only the panel's hook re-fetches. The separate hook instances in `RBCCalendar` (which drive availability shading and external block rendering) remain stale until a full page reload.

### The right approach: callback prop, not shared state

The correct pattern here is a simple `onSaved` callback prop -- the same pattern the codebase already uses for `onAppointmentCreated`, `onBlockCreated`, and `onRefresh`. Alternatives like lifting the hooks to a shared parent or using a global event bus would introduce coupling and complexity that isn't justified. The callback pattern keeps components self-contained and follows the established convention documented in the project's architecture notes.

### File changes

**`AvailabilitySettings.tsx`** -- Accept an optional `onSaved?: () => void` prop. Call it at the end of every successful `upsertSlot`, `updateSlot`, and `deleteSlot` operation (three call sites).

**`CalendarSettings.tsx`** -- Accept an optional `onSaved?: () => void` prop. Call it after `selectCalendar` succeeds and after `disconnect` succeeds (the two operations that change calendar sync state).

**`CalendarSettingsPanel.tsx`** -- Accept an `onSettingsChanged?: () => void` prop. Pass it as `onSaved` to both `AvailabilitySettings` and `CalendarSettings`.

**`RBCCalendar.tsx`** -- Three things:
1. Destructure `refetch` from the existing `useStaffAvailability()` call (it's already returned as `refetch: fetchSlots`).
2. Create a `handleSettingsChanged` callback that calls both `refetch()` (availability shading) and `refetchBlocks()` (external calendar blocks).
3. Pass `onSettingsChanged={handleSettingsChanged}` to `CalendarSettingsPanel`.

Working hours changes already work reactively (they update React state in `RBCCalendar` directly via `onWorkingHoursChange`), so no additional wiring is needed for that section.

## Change 2: Pre-fill time from clicked calendar slot

### The problem

`handleSelectSlot` in `RBCCalendar` extracts only the date from `slotInfo.start` and passes it as `prefilledDate`. The time always defaults to `09:00` because that's the initial state in `CreateAppointmentDialog`.

### The right approach

Extract the time from `slotInfo.start` at the same point we already extract the date. Pass it as a separate `prefilledTime` prop. This is straightforward because `slotInfo.start` is a "fake local" Date whose `getHours()`/`getMinutes()` already represent the staff's local time -- no timezone conversion needed.

### File changes

**`RBCCalendar.tsx`**:
- Add a `prefilledTime` state variable (string, e.g. `"14:30"`).
- In `handleSelectSlot`, format the time from `slotInfo.start` using zero-padded hours and minutes: ``const hh = String(slotInfo.start.getHours()).padStart(2, '0'); const mm = String(slotInfo.start.getMinutes()).padStart(2, '0');`` then set `prefilledTime` to `${hh}:${mm}`.
- Pass `prefilledTime={prefilledTime}` to the `CreateAppointmentDialog`.

**`CreateAppointmentDialog.tsx`**:
- Add `prefilledTime?: string` to the props interface.
- Add a `useEffect` that syncs `prefilledTime` into `formData.time` when it changes (identical pattern to the existing `prefilledDate` effect on line 62-66).
- Keep the default initial time as `'09:00'` for cases where no slot was clicked (e.g. the header "Create Appointment" button).

Duration remains at 60 minutes by default -- no change needed.

## What does NOT change

- No database or table changes
- No hook logic changes (availability, calendar connection, appointments)
- No changes to the CalendarToolbar component
- No changes to working hours persistence (already reactive)

