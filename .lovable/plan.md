

# Fix Staff Portal Password Reset Flow

## Problem

When a user clicks a password reset link, Supabase fires a `PASSWORD_RECOVERY` auth event. The current `AuthenticationProvider` has no handler for this event, so it falls through to `SIGNED_IN`, which loads user data and sets the user context. The `UnifiedRoutingGuard` then sees an authenticated user and redirects them straight into the portal -- they never see the password reset form.

## Solution

Three targeted changes to intercept the recovery flow before the normal auth pipeline takes over.

## Changes

### 1. AuthenticationProvider.tsx -- Handle `PASSWORD_RECOVERY` event

Add a new state flag `isPasswordRecovery` and a `clearPasswordRecovery` function. In the `onAuthStateChange` listener, add a `PASSWORD_RECOVERY` case **before** `SIGNED_IN` that:
- Sets `isPasswordRecovery = true`
- Sets loading to false
- Does NOT call `loadUserData()` (no redirect to dashboard)

Also expose `isPasswordRecovery` and `clearPasswordRecovery` through the context.

### 2. AuthenticationContext.tsx -- Extend context interface

Add `isPasswordRecovery: boolean` and `clearPasswordRecovery: () => void` to the `AuthenticationContextValue` interface so consuming components can access them.

### 3. Auth.tsx -- Use `isPasswordRecovery` flag to show reset form

- Pull `isPasswordRecovery` and `clearPasswordRecovery` from `useAuth()`
- When `isPasswordRecovery` is true, set `showUpdatePassword = true` immediately (show the "Set New Password" form)
- In the redirect effect (lines 79-87), skip the redirect if `isPasswordRecovery` is true or `showUpdatePassword` is true
- After successful password update: call `clearPasswordRecovery()`, sign out, then redirect to `/auth`

### 4. UnifiedRoutingGuard.tsx -- Allow recovery users to reach /auth

- Pull `isPasswordRecovery` from `useAuth()`
- If `isPasswordRecovery` is true and user is on `/auth`, skip redirect (return `shouldRedirect: false`)

## Files Changed

| File | Change |
|---|---|
| `src/contexts/AuthenticationContext.tsx` | Add `isPasswordRecovery` and `clearPasswordRecovery` to context interface and defaults |
| `src/providers/AuthenticationProvider.tsx` | Add `isPasswordRecovery` state, handle `PASSWORD_RECOVERY` event, expose via context |
| `src/pages/Auth.tsx` | Use `isPasswordRecovery` to show reset form, skip redirect, sign out after update |
| `src/components/routing/UnifiedRoutingGuard.tsx` | Skip redirect when `isPasswordRecovery` is true and user is on `/auth` |

## What Does NOT Change

- No database changes
- No Edge Function changes
- No RLS policy changes
- No new routes needed (`/auth` already exists)
- The existing `?mode=reset` and `#type=recovery` URL detection in `Auth.tsx` remains as a fallback

