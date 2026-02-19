
# Fix: Stuck Loading State on SPA Navigation — Full System Plan

## The Definitive Technical Decision

The fix is confined to **one file**: `src/providers/AuthenticationProvider.tsx`.

The correct approach is to add a **`loadedUserIdRef`** — a React ref that tracks the user ID currently loaded in state — and use it to short-circuit the `SIGNED_IN` event handler when the incoming session belongs to the user already in state. This is the right decision because:

- It attacks the **actual root cause** directly, not a symptom.
- It is **O(1)** with no async behavior, no timers, no debounce.
- It follows the **exact pattern already in the file** (`lastFailedUserId` on line 424).
- It requires **zero changes** to any other file — no routing guards, no hooks, no page components.
- It is **reversible** — if something unexpected happens, removing three lines restores the original behavior.

---

## The Three Confirmed Bugs (Full System View)

### Bug 1 — Primary: `SIGNED_IN` fires during token refresh, `loadUserData` runs bare

Supabase fires events in this sequence during a background token refresh:
```
TOKEN_REFRESHED → SIGNED_IN
```

The `TOKEN_REFRESHED` case (line 464) correctly does nothing. But `SIGNED_IN` fires immediately after with the same `session.user.id`. The handler on line 448 then calls `loadUserData(session.user.id, ...)` — which runs **5 sequential database queries** (profile → tenant_membership → user_roles → staff → staff_role_assignments) against the live database.

Critically: this call is **not wrapped in `setIsLoading(true/false)`**. The `login()` method correctly brackets its `loadUserData` call in `setIsLoading(true)` at the top and `setIsLoading(false)` in a `finally` block. The event listener does not. So:

- `isLoading` never becomes `true` before the call.
- If `loadUserData` throws, `isLoading` stays `false` forever, leaving the app in a partially-loaded state.
- If it succeeds, `setUser(userData)` fires mid-navigation, causing a full re-render of everything below `AuthenticationProvider` while the route is still mounting.

### Bug 2 — Compounding: `onAuthStateChange` listener captures a stale `user` closure

The `useEffect` on line 502 lists `[loadUserData, user]` as dependencies. Every time `user` changes, the effect tears down and re-registers the `onAuthStateChange` listener. This means:

1. User navigates to a page.
2. Token refresh fires → `SIGNED_IN` → `loadUserData` runs → `setUser(newUserData)`.
3. `user` reference changed → the auth listener is **torn down and re-created**.
4. While the listener is briefly unregistered, any Supabase event that fires is silently dropped.
5. The new listener is registered → Supabase fires `INITIAL_SESSION` → the `INITIAL_SESSION` case does nothing, which is correct, but the re-registration itself causes an extra render cycle.

This dependency on `user` in the listener's `useEffect` is unnecessary — the only place `user` is read inside the listener is the `USER_UPDATED` case on line 471, and only to guard against updating when no user exists. That guard can be replaced with a ref.

### Bug 3 — Amplifier: Three independent loading signals in `AppRouter`

`AppRouter` subscribes to three separate loading sources:
- `isLoading` from `useAuth()` directly
- `permissionsLoading` from `usePermissionContext()` — which is literally `isLoading` aliased from auth
- `staffLoading` from `useContractorRouting()` — which returns `isLoading || permissionsLoading`

All three are derived from the same single `isLoading` boolean in `AuthenticationProvider`, but because they are read through separate hook calls, React schedules three separate re-render passes when `isLoading` changes. During Bug 1's mid-navigation re-render, these three signals can momentarily disagree, leaving `AppRouter` believing one of them is still `true`.

This bug is benign once Bug 1 is fixed — the signals will all read the same stable value. Fixing it independently would require restructuring the entire permission/routing hook chain, which introduces more surface area than it removes.

---

## What Changes — Exactly

### Change 1: Add `loadedUserIdRef`

Add one line immediately before the `onAuthStateChange` listener setup:

```typescript
const loadedUserIdRef = useRef<string | null>(null);
```

### Change 2: Keep the ref current when `setUser` is called in `loadUserData`

In `loadUserData`, on the line after `setUser(userData)` (line 91):

```typescript
setUser(userData);
loadedUserIdRef.current = userData.id;  // ← ADD THIS
```

### Change 3: Guard the `SIGNED_IN` handler

In the `SIGNED_IN` case (line 438), add the guard as the **first check** inside `if (session?.user)`:

```typescript
case 'SIGNED_IN':
  if (session?.user) {
    // Guard against token refresh re-fires
    if (loadedUserIdRef.current === session.user.id) {
      console.debug('[AuthenticationProvider] SIGNED_IN skipped — already loaded (token refresh)');
      return;
    }
    // ... rest of existing logic unchanged
```

### Change 4: Clear the ref on sign-out

In the `SIGNED_OUT` case (line 457), after `setUser(null)`:

```typescript
case 'SIGNED_OUT':
  setUser(null);
  loadedUserIdRef.current = null;  // ← ADD THIS
  setError(null);
  sessionCacheService.clear();
  break;
```

### Change 5: Remove `user` from the `onAuthStateChange` `useEffect` dependency array

On line 502:

```typescript
// BEFORE:
}, [loadUserData, user]);

// AFTER:
}, [loadUserData]);
```

And replace the `user` reference inside the listener (line 471, `USER_UPDATED` case) with the ref:

```typescript
case 'USER_UPDATED':
  if (session?.user && loadedUserIdRef.current !== null) {
    await loadUserData(session.user.id, session.user.email || '');
  }
  break;
```

This eliminates the listener teardown/re-registration cycle that happens on every user state change.

### Change 6: Wrap the `SIGNED_IN` `loadUserData` call with `setIsLoading` brackets

The event listener path must match the same pattern as `login()`:

```typescript
case 'SIGNED_IN':
  if (session?.user) {
    if (loadedUserIdRef.current === session.user.id) {
      return; // token refresh skip
    }
    if (lastFailedUserId === session.user.id) {
      return; // existing retry guard
    }
    setIsLoading(true);                                  // ← ADD
    try {
      await loadUserData(session.user.id, session.user.email || '');
      lastFailedUserId = null;
    } catch (err) {
      lastFailedUserId = session.user.id;
      throw err;
    } finally {
      setIsLoading(false);                               // ← ADD
    }
  }
  break;
```

---

## Side Effects Analysis — Every Part of the App This Touches

### `login()` — No impact
`login()` invalidates the cache before calling `loadUserData`, so `loadedUserIdRef.current` will already be `null` (first login) or stale (re-login as different user). The guard will not trigger. Behavior unchanged.

### `logout()` / `SIGNED_OUT` — Safe
The ref is cleared to `null`. The next `SIGNED_IN` event (for any user) will not be skipped. Behavior unchanged.

### `refreshUserData()` — No impact
This method calls `loadUserData` directly (not through the event listener) and already has `setIsLoading(true/false)` brackets. It also invalidates the cache before calling. No change to this path.

### `resetAuth()` — No impact
Same as `refreshUserData()` — direct call with brackets. No change.

### `USER_UPDATED` event — Adjusted but functionally equivalent
The guard changes from checking `user` (the state variable, which caused the listener re-registration) to checking `loadedUserIdRef.current !== null` (the ref). The semantic meaning is identical: only refresh if a user is currently loaded.

### `initializeSession` on mount — No impact
`initializeSession` calls `loadUserData` directly. After it completes, `setUser(userData)` fires, which now also sets `loadedUserIdRef.current`. This means the subsequent `SIGNED_IN` event that Supabase fires as `INITIAL_SESSION` is handled on line 478 (does nothing), and any stray `SIGNED_IN` after initialization is now correctly skipped by the ref guard.

### `UnifiedRoutingGuard` — Indirectly improved
This component reacts to `isLoading` and `error` from `useAuth()`. With Bug 1 fixed, `isLoading` no longer spikes `false → (silent) → false` mid-navigation. The guard's loading spinner will only appear during legitimate loading events.

### `AppRouter` — Indirectly improved
Same as above. The three loading signals (Bug 3) still exist structurally, but since the underlying `isLoading` will no longer have unexpected transitions during navigation, they will remain consistently `false` during page transitions.

### `useContractorRouting` — Indirectly improved
The `lastStableState` ref in this hook exists specifically to compensate for `isLoading` flickering during re-renders. With Bug 1 fixed, this compensation mechanism will still work but will be triggered far less often.

### `SessionCacheService` — Role confirmed, no conflict
The cache has a 1-hour TTL. `initializeSession` already checks the cache first (line 372). With the ref guard in place, the `SIGNED_IN` event during a token refresh will be skipped before it even reaches the cache check — meaning the cache is never consulted unnecessarily during token refreshes. This is strictly better than before.

### `UnifiedRoleDetectionService` — Database queries eliminated on token refresh
Previously, every token refresh triggered 5 database queries (profile, tenant_membership, user_roles, staff, staff_role_assignments). With the ref guard, these queries will not fire during token refreshes for an already-loaded user. This reduces unnecessary database load.

---

## What Could Go Wrong and Why It Won't

**"The guard might skip a genuine new sign-in."**
A genuine new sign-in always either (a) starts from `null` state — `loadedUserIdRef.current` is `null`, guard does not trigger; or (b) is a different user — IDs won't match, guard does not trigger. The guard only skips when the same user's session fires `SIGNED_IN` again, which is the token refresh case.

**"The ref might get out of sync with user state."**
The ref is set in `loadUserData` (which is the only place `setUser` is called with a non-null value) and cleared in `SIGNED_OUT`. These are the only two state transitions that matter. There is no code path where `user` is non-null and `loadedUserIdRef.current` is null (after initialization), or vice versa.

**"This doesn't fix the triple-subscription issue in AppRouter."**
Correct — Bug 3 is not directly fixed. But Bug 3 only causes a problem when `isLoading` has unexpected transitions. Once Bug 1 is fixed, `isLoading` is stable during navigation, and Bug 3's structural issue becomes inert. Fixing Bug 3 independently would require restructuring the permission and routing hook chain — a significant refactor with its own risk surface. That can be done separately if needed, but it is not required to resolve the stuck loading issue.

---

## Files Changed

| File | Change |
|------|--------|
| `src/providers/AuthenticationProvider.tsx` | Add `loadedUserIdRef`. Update `loadUserData` to set ref. Guard `SIGNED_IN`. Bracket `SIGNED_IN` with `setIsLoading`. Clear ref in `SIGNED_OUT`. Remove `user` from effect deps. Replace `user` with ref in `USER_UPDATED`. |

**No other files change.**

---

## Verification Steps After Implementation

1. Navigate between Dashboard → Calendar → Clients → Settings rapidly. No stuck loading spinner should appear.
2. Leave the app open for 60+ minutes (past the JWT refresh window, typically 50-55 min) and then navigate. Token refresh fires — no spinner, page loads immediately.
3. Sign out and sign back in. Full `loadUserData` runs (ref is null, guard does not trigger). User loads correctly.
4. Sign in as one user, sign out, sign in as a different user. Ref is cleared on sign-out, new user loads fully.
5. Check browser console — `SIGNED_IN skipped` debug message should appear after any background token refresh.
