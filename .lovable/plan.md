

# Add "Start Session" Button to Today's Appointments Cards

## Problem

The `AppointmentCard` component on the Dashboard shows a "Telehealth" badge and a "Document Session" button, but has no way to launch the video call. Clinicians must navigate to the full appointment view just to click "Join Video Call." For the primary landing page of the app, this is a broken workflow.

## Technical Decision

Add an optional `videoroomUrl` prop to `AppointmentCard` and render a "Start Session" button that opens the Daily.co room in a new tab. This is the right approach because:

- The data is already loaded. `StaffAppointment` includes `videoroom_url` on every appointment record. No new queries or API calls are needed.
- `AppointmentCard` is a presentational component. It should receive what to render via props and not fetch data itself.
- Opening in a new tab (`target="_blank"`) matches the existing pattern in `AppointmentView.tsx` (line 357-365) where "Join Video Call" is an anchor tag opening in a new window.
- The button should only appear when `isTelehealth` is true AND `videoroomUrl` is a non-empty string. If the room is still being provisioned (URL is null), the button is not shown -- no confusing disabled states.

## Changes

### 1. `src/components/Dashboard/AppointmentCard.tsx`

- Add optional prop `videoroomUrl?: string | null`
- Render a "Start Session" button (with `Video` icon) when `isTelehealth && videoroomUrl` is truthy
- The button is an anchor styled as a primary button, opening the URL in a new tab
- It renders above the "Document Session" button (if present), since starting the session is the higher-priority action

### 2. `src/pages/Index.tsx`

- Pass `videoroomUrl={appt.videoroom_url}` to every `AppointmentCard` in the Today's Appointments section
- No change needed to the Undocumented Appointments section (those sessions already happened -- starting a video call is not relevant there)
- No change needed to the Upcoming Appointments section (those are future-dated, not actionable today)

## What does NOT change

- No database changes
- No new hooks or queries
- No changes to `useStaffAppointments` -- it already returns `videoroom_url`
- No changes to the Upcoming or Undocumented sections
- The existing "Document Session" button behavior is untouched

