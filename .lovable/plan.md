

# Google Calendar Sync -- Admin-Only Implementation Plan

## Architecture Summary

The backend (5 edge functions, 2 database tables, encrypted tokens, RLS policies) is fully deployed and idle. What's missing is the **frontend**: there is no UI to initiate OAuth, select a calendar, view connection status, or trigger syncs. This plan builds that UI and wires it into the appointment lifecycle, restricted to admin users only.

## Why Admin-Only is the Right Decision

This system connects a Google account to the EHR's OAuth credentials. If every clinician could connect independently, you'd need per-clinician consent flows, disconnection management, and support overhead for token expiration across dozens of users. Restricting to admins means:

- One person controls the organization's external integrations
- The Settings page (where this belongs) is already admin-only
- The edge functions already authenticate the caller and look up their staff record -- adding an admin check server-side is straightforward
- Non-admin clinicians still benefit: once an admin connects a clinician's calendar on their behalf (future feature), the sync functions use the staff_id on the appointment, not the caller's identity

## What Gets Built (4 parts)

### Part 1: Calendar Settings UI Component

**New file**: `src/components/Settings/CalendarSettings.tsx`

A new settings category panel that shows:
- **Connection status**: Reads `staff_calendar_connections` for the current user's staff record. Shows "Not Connected", "Connected", or "Needs Reconnect" with appropriate styling.
- **Connect button**: Calls `google-calendar-auth-start` edge function, receives the OAuth URL, and opens it (the callback redirects back to `/staff/settings?calendar_connected=true`).
- **Calendar selector**: After connection, calls `google-calendar-list-calendars` to show a dropdown of available calendars. Selecting one updates `staff_calendar_connections.selected_calendar_id` via a direct Supabase update.
- **Disconnect button**: Deletes the row from `staff_calendar_connections` (RLS already allows this for the owning staff member).
- **Error handling**: Reads URL query params (`calendar_connected`, `calendar_error`) on mount to show success/error toasts from the OAuth callback redirect.

### Part 2: Register Calendar Settings in the Settings Page

**Modified file**: `src/pages/Settings.tsx`

Add a new entry to `settingsCategories`:
```
{
  id: 'calendar',
  name: 'Calendar Integration',
  icon: Calendar,
  description: 'Connect Google Calendar for scheduling sync',
  adminOnly: true
}
```

Add the corresponding `case 'calendar'` in `renderContent()` to render `<CalendarSettings />`.

The `adminOnly: true` flag ensures the sidebar entry is only visible to users who pass `canManageUsers(userRole, isAdmin)`, which is the existing pattern for admin-gated settings.

### Part 3: Server-Side Admin Validation in Edge Functions

**Modified files**: `google-calendar-auth-start/index.ts`, `google-calendar-list-calendars/index.ts`

These two functions are called directly from the UI. After authenticating the caller and looking up the staff record, add a check:

1. Query `user_roles` via the service role client to confirm the caller has `role = 'admin'`
2. If not admin, return 403 Forbidden

The other three functions (`auth-callback`, `get-availability`, `sync-appointment`) don't need this check because:
- `auth-callback` is a redirect from Google -- the HMAC state already validates the staff_id that was authorized by an admin who initiated the flow
- `get-availability` and `sync-appointment` are backend operations that work on behalf of any staff member's connection (they look up the connection by staff_id on the appointment, not the caller)

### Part 4: Wire Appointment Sync Triggers

**Modified file**: `src/hooks/useAppointmentCreation.tsx`

After a successful appointment insert, fire-and-forget a call to `google-calendar-sync-appointment` with `{ appointment_id, action: "create" }`. This call is non-blocking -- if the staff member has no calendar connection, the edge function returns `{ synced: false, reason: "no_calendar_connection" }` gracefully. No UI change needed; the sync is silent.

**No changes to recurring appointment flows yet** -- single appointment creation is the first integration point. Recurring series and appointment updates/deletions can be wired in a follow-up.

## What Does NOT Change

- **No database changes** -- tables and RLS policies are already correct
- **No changes to existing edge functions** beyond the admin check in two of them
- **No changes to navigation** -- Settings is already admin-only in `StaffPortalApp.tsx` and `navigation.ts`
- **No changes to the permission system** -- the admin check uses the existing `has_role` pattern via `user_roles` table
- **No changes to the calendar view** -- availability overlay is a separate future feature

## File Change Summary

| File | Action |
|------|--------|
| `src/components/Settings/CalendarSettings.tsx` | Create |
| `src/pages/Settings.tsx` | Add calendar category + render case |
| `supabase/functions/google-calendar-auth-start/index.ts` | Add admin role check |
| `supabase/functions/google-calendar-list-calendars/index.ts` | Add admin role check |
| `src/hooks/useAppointmentCreation.tsx` | Add fire-and-forget sync call after insert |

## Technical Details

### Admin Check in Edge Functions

```typescript
// After getting userId from getClaims()
const { data: adminRole } = await supabaseAdmin
  .from('user_roles')
  .select('role')
  .eq('user_id', userId)
  .eq('role', 'admin')
  .maybeSingle();

if (!adminRole) {
  return new Response(
    JSON.stringify({ error: 'Admin access required' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

This uses the service role client (`supabaseAdmin`) to query `user_roles`, consistent with the existing `has_role()` security definer function pattern.

### Calendar Settings Hook

A new custom hook `useCalendarConnection` will encapsulate:
- Fetching the current staff member's `staff_calendar_connections` row
- Invoking `google-calendar-auth-start` to get the OAuth URL
- Invoking `google-calendar-list-calendars` to get available calendars
- Updating `selected_calendar_id` on the connection row
- Deleting the connection row for disconnect

### OAuth Callback Flow

The callback already redirects to `/staff/settings?calendar_connected=true` (or `?calendar_error=...`). The `CalendarSettings` component will read these params on mount, show a toast, and clean up the URL.

