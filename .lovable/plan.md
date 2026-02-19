
# Fix: Allow All Staff to Connect Google Calendar

## What Is Wrong

Two edge functions have a hardcoded admin-only gate that blocks every non-admin clinician from using the Google Calendar sync feature:

1. **`google-calendar-auth-start`** — generates the Google OAuth URL. Blocked at line 55 with `if (!adminRole) return 403`.
2. **`google-calendar-list-calendars`** — lists the user's Google calendars after connecting. Blocked at line 150 with the same check.

The correct authorization model for this feature is: **any authenticated staff member with a valid staff record should be able to connect their own Google calendar**. There is no reason to restrict this to admins — each connection is scoped to the individual staff member's own `staff_id` and `tenant_id`. One user cannot access or interfere with another user's calendar connection.

`google-calendar-watch-start` does NOT have this admin gate, so no change is needed there.

## What Changes

### File 1: `supabase/functions/google-calendar-auth-start/index.ts`

Remove the entire admin role check block (lines 42–63):

```typescript
// DELETE THIS ENTIRE BLOCK:
const { data: adminRole } = await supabaseAdmin
  .from("user_roles")
  .select("role")
  .eq("user_id", userId)
  .eq("role", "admin")
  .maybeSingle();

if (!adminRole) {
  return new Response(
    JSON.stringify({ error: "Admin access required" }),
    { status: 403, ... }
  );
}
```

The remaining logic — looking up the staff record by `profile_id`, building the HMAC-signed state, and generating the OAuth URL — is unchanged and correct for all staff users.

The security model remains sound: the function still requires a valid JWT (authenticated user), and the state parameter is HMAC-signed with `staffId:tenantId`, so no user can forge a connection for another user's staff record.

### File 2: `supabase/functions/google-calendar-list-calendars/index.ts`

Remove the same admin role check block (lines 142–158):

```typescript
// DELETE THIS ENTIRE BLOCK:
const { data: adminRole } = await supabaseAdmin
  .from("user_roles")
  .select("role")
  .eq("user_id", userId)
  .eq("role", "admin")
  .maybeSingle();

if (!adminRole) {
  return new Response(
    JSON.stringify({ error: "Admin access required" }),
    { status: 403, ... }
  );
}
```

After the gate is removed, the function looks up the staff record by `profile_id` (the authenticated user's own ID), then fetches only that staff member's calendar connection. Users can only ever see their own calendars — there is no cross-user data exposure.

## Security Confirmation

- Both functions still require a valid Supabase JWT. Unauthenticated requests get a 401.
- Both functions still require the caller to have a `staff` record in the database. Non-staff users get a 404.
- Each staff member can only connect and view calendars for their own `staff_id` — the lookup is always scoped to `profile_id = userId` (the authenticated user's own ID).
- No RLS changes are needed. The `staff_calendar_connections` table is already scoped per `staff_id`.

## No Other Changes Needed

- `google-calendar-watch-start` — no admin gate, already works for any staff member.
- `google-calendar-auth-callback` — no admin gate, already works.
- `google-calendar-sync-appointment` — no admin gate, already works.
- `google-calendar-webhook` — public webhook endpoint, no auth needed.
- Frontend (`useCalendarConnection.tsx`, `CalendarSettings.tsx`) — no changes needed.
- Database — no changes needed.
