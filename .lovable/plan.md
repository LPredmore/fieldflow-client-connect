

# Fix: `useFreshStaffTimezone` Race Condition

## The Problem

When `AppointmentForm` mounts, it calls `useFreshStaffTimezone()`. The hook's `useEffect` runs immediately, but at that point `user?.roleContext?.staffData?.id` is still `undefined` because auth is still hydrating. The current code (lines 58-64) treats "no staff ID" as "query complete" and immediately sets `queryComplete = true` with `isLoading = false`. This releases the loading gate, and the form initializes React Hook Form `defaultValues` using the fallback timezone (`America/New_York`). 

When auth finishes hydrating and `staffId` becomes available, the `useEffect` re-runs and fetches the real timezone (`America/Chicago`). But it's too late -- React Hook Form locked in its `defaultValues` on first render and won't update them.

## The Fix

**One file change: `src/hooks/useStaffTimezone.tsx`**

Modify the `useFreshStaffTimezone` hook so that when `staffId` is not available, it does **nothing** -- it stays in loading state (`isLoading: true`, `queryComplete: false`, `timezone: null`). It simply returns early without setting any state. When the `useEffect` dependency (`user?.roleContext?.staffData?.id`) changes from `undefined` to an actual ID, the effect re-runs and performs the real fetch. Only then does it set `queryComplete = true`.

This means:
- `AppointmentForm` stays on its loading spinner (the "Loading timezone..." screen) until the real timezone is fetched
- React Hook Form `defaultValues` are only calculated once the correct timezone is available
- The save path (`combineDateTimeToUTC`) also uses the correct timezone

### Specific code change

In the `useEffect` inside `useFreshStaffTimezone`, replace the early-exit block (lines 58-64):

```
if (!staffId) {
  // No staff ID available yet, mark complete to use browser fallback
  if (mounted) {
    setQueryComplete(true);
    setIsLoading(false);
  }
  return;
}
```

With:

```
if (!staffId) {
  // Staff ID not available yet (auth still hydrating).
  // Stay in loading state -- do NOT mark queryComplete.
  // The effect will re-run when staffId becomes available.
  return;
}
```

That is the entire fix. No other files need to change. `AppointmentForm` already handles the loading state correctly (it shows a spinner when `timezoneLoading || !userTimezone`), so the gate holds until the real timezone resolves.

## Risk

If `staffId` never becomes available (e.g., a non-staff user somehow reaches this form), the form will stay on the loading spinner indefinitely. This is acceptable because:
1. Only staff users can access the appointment form (routing guards enforce this)
2. An infinite spinner is better than silently saving appointments in the wrong timezone

