

# Move Calendar Settings to Calendar Page

## Summary

Replace the small "Working Hours" popover on the Calendar toolbar's settings gear with a larger slide-out panel (Sheet) containing three collapsible sections: **Working Hours**, **Availability**, and **Calendar Integration**. Remove the corresponding entries from the Settings page since they'll live on the Calendar page now.

## Changes

### 1. Create `CalendarSettingsPanel` component

New file: `src/components/Calendar/CalendarSettingsPanel.tsx`

A Sheet (slide-out drawer) triggered by the existing Settings gear icon. Contains three `Collapsible` sections using the existing collapsible component:

- **Working Hours** -- The existing start/end hour selectors (currently in the Popover). Controls which hours the calendar grid displays.
- **Availability** -- The full `AvailabilitySettings` content (day-by-day slot management). Rendered inline without its wrapping Card.
- **Calendar Integration** -- The full `CalendarSettings` content (Google Calendar OAuth, calendar selector, privacy info). Rendered inline without its wrapping Card.

Each section will have a header row with a chevron toggle, expanding/collapsing its content.

### 2. Update `CalendarToolbar.tsx`

- Remove the `Popover` that currently wraps the Settings gear
- Instead, the Settings gear button will call a new `onSettingsClick` callback prop
- Remove the working hours `Select` components from this file (they move to the panel)
- The toolbar still receives `workingHoursStart` / `workingHoursEnd` props for display but doesn't edit them directly

### 3. Update `RBCCalendar.tsx`

- Add state: `const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)`
- Pass `onSettingsClick={() => setSettingsPanelOpen(true)}` to `CalendarToolbar`
- Render `<CalendarSettingsPanel>` with the working hours state, its change handler, and the open/onOpenChange props

### 4. Update `Settings.tsx`

- Remove the `'calendar'` and `'availability'` entries from `settingsCategories`
- Remove the corresponding `case` branches in `renderContent()`
- Remove the imports for `CalendarSettings`, `AvailabilitySettings`, `Calendar` icon, and `Clock` icon

### 5. Refactor `AvailabilitySettings.tsx` and `CalendarSettings.tsx`

Make both components accept an optional `embedded` prop. When `embedded={true}`, they skip rendering their outer `<Card>` wrapper and just render the inner content directly. This avoids card-inside-sheet visual nesting while keeping them usable standalone if ever needed again.

## What does NOT change

- The `useStaffAvailability` hook, `useCalendarConnection` hook, and all data logic remain identical
- No database or table changes
- No route changes -- the Calendar page route stays the same
- The Settings page continues to exist with Business Profile, Clinical Settings, and User Management

## Risk Assessment

- **Low risk**: The Availability and Calendar Integration components are self-contained. Moving them into a Sheet is purely a layout change.
- **No data impact**: All hooks and DB queries remain unchanged.
- **Settings page still works**: Only two sidebar entries are removed; the page and remaining sections are untouched.

