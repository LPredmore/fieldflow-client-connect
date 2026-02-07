

# Password Reset Flow Alignment with Custom Email System

## Current State Analysis

The password reset flow currently works as follows:

```text
User clicks "Forgot Password" in Auth.tsx
         ↓
resetPassword() called with redirectTo: /reset-password
         ↓
Supabase Auth Hook triggers → send-auth-email edge function
         ↓
Email sent from noreply@valorwell.org (already working!)
         ↓
User clicks link → /reset-password#access_token=...&type=recovery
         ↓
ResetPasswordRedirect exchanges token, redirects to /auth#...
         ↓
Auth.tsx detects type=recovery in hash, shows "Set New Password" form
```

**Good News**: The core flow is already functional! The custom email system is working because the Supabase Auth Hook applies to ALL authentication emails for the project.

**Issues Identified**:
1. The redirect URL uses `/reset-password` which requires an extra redirect hop
2. The Auth page detection logic relies on hash parameters, which works but could be cleaner
3. The flow could be simplified to match the documentation's recommended pattern

---

## Recommended Changes

### Option A: Minimal Changes (Lower Risk)
Keep the current two-step flow but ensure it's robust:
- The `/reset-password` intermediary page handles token exchange
- Auth page continues to detect `type=recovery` from hash

**Pros**: Minimal code changes, existing flow works
**Cons**: Extra redirect hop, slightly more complex

### Option B: Streamlined Flow (Recommended)
Align with the documentation's pattern - redirect directly to `/auth`:

```text
User clicks "Forgot Password"
         ↓
resetPassword() with redirectTo: /auth?mode=reset
         ↓
User clicks email link → /auth?mode=reset#access_token=...
         ↓
Auth.tsx handles token exchange AND shows password form
```

**Pros**: Single page, cleaner URL, matches documentation
**Cons**: Auth.tsx becomes slightly more complex

---

## Implementation Plan (Option B - Recommended)

### File 1: `src/providers/AuthenticationProvider.tsx`

**Change**: Update the `resetPassword` function redirect URL

**Current** (line 553-554):
```typescript
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`
});
```

**Updated**:
```typescript
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/auth?mode=reset`
});
```

---

### File 2: `src/pages/Auth.tsx`

**Changes**:
1. Detect password reset from BOTH `?mode=reset` query param AND `type=recovery` hash param
2. Handle PKCE code exchange if `?code=` is present
3. Add error handling for token exchange

**Current detection** (lines 36-47):
```typescript
useEffect(() => {
  const hashParams = new URLSearchParams(location.hash.slice(1));
  const type = hashParams.get('type');
  
  if (type === 'recovery') {
    setShowUpdatePassword(true);
    setShowForgotPassword(false);
    setIsLogin(true);
  }
}, [location.hash]);
```

**Updated logic**:
```typescript
useEffect(() => {
  const handlePasswordRecovery = async () => {
    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.slice(1));
    
    const isResetMode = searchParams.get('mode') === 'reset';
    const isRecoveryType = hashParams.get('type') === 'recovery';
    const code = searchParams.get('code');
    
    // Handle PKCE code exchange if present
    if (code) {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setAuthError(`Failed to process reset link: ${error.message}`);
          return;
        }
      } catch (err) {
        setAuthError('Failed to process reset link');
        return;
      }
    }
    
    // Show password update form if this is a reset flow
    if (isResetMode || isRecoveryType) {
      setShowUpdatePassword(true);
      setShowForgotPassword(false);
      setIsLogin(true);
    }
  };
  
  handlePasswordRecovery();
}, [location.search, location.hash]);
```

---

### File 3: `src/pages/ResetPasswordRedirect.tsx`

**Change**: Keep for backwards compatibility but simplify to just redirect

This page can remain as a fallback for any old/existing password reset emails that may have been sent before the change. It will continue to work but new emails will go directly to `/auth`.

**Optional Enhancement**: Add a message indicating redirect is happening, then forward to the new URL pattern.

---

### File 4: `src/App.tsx`

**No changes required** - the `/reset-password` route stays for backwards compatibility.

---

## Testing Plan

After implementation, test the following:

1. **New Password Reset Flow**:
   - Go to `/auth`
   - Click "Forgot Password"
   - Enter email and submit
   - Verify email arrives from `noreply@valorwell.org` (not Supabase default)
   - Click the "Reset Your Password" button in email
   - Verify redirect to `/auth?mode=reset#...` (not `/reset-password`)
   - Verify "Set New Password" form appears
   - Enter new password and confirm
   - Verify password is updated and success message shown

2. **Legacy Fallback** (if old emails exist):
   - Any existing emails pointing to `/reset-password` should still work
   - The ResetPasswordRedirect page will handle token exchange and forward to `/auth`

3. **Edge Function Logs**:
   - Check https://supabase.com/dashboard/project/ahqauomkgflopxgnlndd/functions/send-auth-email/logs
   - Look for `Processing recovery email for:` entries to confirm custom email system is processing requests

---

## Summary of Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `src/providers/AuthenticationProvider.tsx` | Edit | Change redirectTo from `/reset-password` to `/auth?mode=reset` |
| `src/pages/Auth.tsx` | Edit | Add PKCE code exchange handling, detect both query param and hash param |
| `src/pages/ResetPasswordRedirect.tsx` | No change | Keep for backwards compatibility |
| `src/App.tsx` | No change | Routes remain the same |

---

## Why This Approach

1. **Alignment with Documentation**: Matches the recommended pattern from the client portal implementation notes

2. **Backwards Compatible**: Old emails still work via the ResetPasswordRedirect fallback

3. **Cleaner URLs**: Users see `/auth?mode=reset` instead of `/reset-password` then `/auth`

4. **Single Page Handling**: All password reset UI logic lives in Auth.tsx

5. **Custom Email System Already Works**: The Supabase Auth Hook is project-wide, so no edge function changes needed

