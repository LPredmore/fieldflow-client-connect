
# Fix: Timezone Propagation — Definitive Technical Decision

## The Actual Problem

There are **two separate caches** that hold `prov_time_zone`, and they have different lifetimes:

| Cache | What reads it | Invalidated when |
|---|---|---|
| `SessionCacheService` + auth context `user` object | `useStaffTimezone` → `useAppointmentCreation`, `useAppointmentSeries`, `RBCCalendar` | Login / logout / `refreshUserData()` |
| `useSupabaseQuery` (React Query) for the `staff` table | `useStaffData` → Profile page display | After any `updateStaffInfo()` call |

When a user saves a new timezone in Profile:
- Cache #2 updates immediately. The Profile page shows the right value.
- Cache #1 is untouched. Appointment creation uses the old value for up to 1 hour.

## Why the Previous Proposal Was Wrong

The previous plan proposed calling `refreshUserData()` after saving the timezone in `Profile.tsx`. This is incorrect for the following reason:

`refreshUserData()` in `AuthenticationProvider` sets `isLoading: true` for the duration of the full round-trip (`detectUserRole` → `fetchStaffData` → `fetchTenantMembership` → role assignment queries). That is 4–6 sequential database queries. Running this silently in the background while the user is on the Profile page creates a race condition: if the auth context rebuilds while the user navigates to Calendar and opens the appointment form, the form may render before the new context is ready, and will still pick up the old value from whatever is in state at render time. Additionally, `refreshUserData` throws on any error, which the "fire-and-forget" pattern suppresses — creating invisible silent failures.

## The Correct Decision

**Use `useFreshStaffTimezone` in `useAppointmentCreation` instead of `useStaffTimezone`.**

This hook already exists and was built for exactly this scenario. It makes a direct, targeted database query (`SELECT prov_time_zone FROM staff WHERE id = $staffId`) on mount, completely bypassing both caches. It already has:
- An auth hydration gate (waits for `staffId` to be available)
- A loading state that prevents use of stale data while the query runs
- A fallback to `America/New_York` after the query completes

The appointment creation form already **blocks on loading state** via the `useFreshStaffTimezone` pattern used in `CreateAppointmentDialog`. The infrastructure is already there — it just isn't wired to the hook that actually performs the conversion.

This approach is correct because:
1. It adds **one small, targeted SELECT query** at the moment the appointment form opens — not at profile save time, not at auth refresh time.
2. It is **stateless with respect to the auth cache**. No cache invalidation, no race conditions, no background refreshes.
3. It correctly models the intent: "what is this staff member's timezone right now, at the moment they are about to create an appointment?" — not "what was their timezone when they last logged in?"
4. It follows the existing architecture pattern already established in this codebase.

## What Changes

### File 1: `src/hooks/useAppointmentCreation.tsx`

Replace `useStaffTimezone` with `useFreshStaffTimezone`. The hook must return the loading state so callers can gate on it.

**Current:**
```typescript
import { useStaffTimezone } from './useStaffTimezone';
// ...
const staffTimezone = useStaffTimezone(); // reads from stale auth cache
```

**New:**
```typescript
import { useFreshStaffTimezone } from './useStaffTimezone';
// ...
const { timezone: staffTimezone, isLoading: timezoneLoading } = useFreshStaffTimezone();
```

The `createAppointment` function already throws when required fields are missing. Add one guard at the top:
```typescript
if (timezoneLoading || !staffTimezone) {
  throw new Error('Timezone not yet loaded. Please try again.');
}
```

Return `timezoneLoading` from the hook so UI consumers can disable the submit button while it resolves (typically < 200ms).

### File 2: `src/hooks/useAppointmentSeries.tsx`

Same change — this hook creates recurring appointment series and uses `useStaffTimezone` for the same RPC conversion. Apply identical replacement.

### File 3: `src/components/Appointments/AppointmentForm.tsx`

`AppointmentForm` calls `useStaffTimezone()` and passes `staffTimezone` as `userTimezone` prop to `AppointmentFormInner`. This is used **only for display** (showing the user which timezone is active). Replace with `useFreshStaffTimezone` here as well so the displayed timezone also reflects the actual value being used — not a stale cached value.

### No Changes To

- `RBCCalendar.tsx` — uses `useStaffTimezone` for calendar **display/positioning**, not for write operations. A 1-hour stale display timezone is acceptable UX. The fresh value will appear on next page load. This is a read-only display concern, not a data integrity concern.
- `Profile.tsx` — no change needed at all. No cache invalidation, no `refreshUserData` call.
- `SessionCacheService` — no change.
- `UnifiedRoleDetectionService` — no change.
- `AuthenticationProvider` — no change.
- Database — no change.

## Why This Is The Right Tradeoff

The alternative (calling `refreshUserData()` on profile save) has the right idea but wrong execution surface. It couples profile editing to auth state re-initialization, which is a large side effect for a small data change. It also doesn't solve the problem for users who set their timezone long ago and are now creating their first appointment — `refreshUserData` is only called on save, not on "open the appointment form."

The direct DB query approach (`useFreshStaffTimezone`) is already the established pattern in this codebase for exactly this class of problem. The memory note in the system context explicitly states: "The `useFreshStaffTimezone` hook is used in appointment forms to reliably fetch the staff member's authoritative timezone string directly from the database... This ensures that the conversion of user-entered local times to UTC always uses the correct timezone, bypassing potential race conditions in the authentication context."

The bug is simply that `useAppointmentCreation` and `useAppointmentSeries` were never updated to use it.

## Files to Change

1. `src/hooks/useAppointmentCreation.tsx` — swap import, add loading guard, return `timezoneLoading`
2. `src/hooks/useAppointmentSeries.tsx` — swap import, add loading guard
3. `src/components/Appointments/AppointmentForm.tsx` — swap import for display consistency
