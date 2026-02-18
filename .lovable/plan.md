

# Fix Google Calendar OAuth Redirect URI Mismatch

## The Core Problem

There are three things that must all agree on the same URL:

1. **Google Cloud Console** -- the URI Google will accept
2. **`GOOGLE_REDIRECT_URI` secret** -- the URI the app sends to Google
3. **The actual deployed Edge Function** -- what lives at that URL

Right now:
- Google Console has: `.../google-oauth-callback`
- The secret has: `.../google-calendar-auth-callback`
- The deployed function is named: `google-calendar-auth-callback`

Items 2 and 3 match, but Google Console still has the old name. That is why Google returns `redirect_uri_mismatch`.

## The Decision: Update the Google Console URI (not rename the function)

The correct fix is to update the **Google Cloud Console** to use:

```
https://ahqauomkgflopxgnlndd.supabase.co/functions/v1/google-calendar-auth-callback
```

**Why this is the right call, not the alternative of renaming the function:**

- All five Google Calendar edge functions follow the naming convention `google-calendar-*`. Renaming the callback to `google-oauth-callback` would break this consistency and make the codebase confusing (one function named differently from its four siblings).
- The `config.toml` already declares `google-calendar-auth-callback` with `verify_jwt = false`. The code, the config, and the secret are all aligned. The only outlier is the Google Console entry.
- Creating a new function folder, deleting the old one, updating the config, and redeploying introduces risk and downtime for zero functional benefit.
- Renaming would also mean updating the `GOOGLE_REDIRECT_URI` secret *again*, creating churn.

The Google Console is the one piece that is wrong. Fix it there.

## Implementation Steps

### Step 1 -- You (manual, in Google Cloud Console)

1. Go to **Google Cloud Console > APIs and Services > Credentials**
2. Click your **OAuth 2.0 Client ID** (Web application type)
3. In **Authorized redirect URIs**, **remove** the old entry:
   `https://ahqauomkgflopxgnlndd.supabase.co/functions/v1/google-oauth-callback`
4. **Add** (if not already present):
   `https://ahqauomkgflopxgnlndd.supabase.co/functions/v1/google-calendar-auth-callback`
5. Click **Save**
6. Wait 1-2 minutes for Google's propagation

### Step 2 -- No code or secret changes

The `GOOGLE_REDIRECT_URI` secret already contains the correct value. The edge function code already reads from that secret. Nothing in the codebase needs to change.

### Step 3 -- Verify

After updating Google Console, click **Connect Google Calendar** in Settings and confirm the OAuth flow completes without error.

## Summary

This is a one-line configuration fix in Google Cloud Console. The application code, the Supabase secret, and the deployed edge function are all already correct and consistent. The only thing out of sync is the authorized redirect URI registered with Google.

