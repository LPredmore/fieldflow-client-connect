

# Fix Google Calendar OAuth Redirect URI

## The Problem

The `GOOGLE_REDIRECT_URI` secret currently points to `google-oauth-callback`, but the actual deployed edge function is named `google-calendar-auth-callback`. This causes a 404 when Google tries to deliver the OAuth authorization code.

## What Needs to Happen

### Step 1: Update the Supabase Secret

Update the `GOOGLE_REDIRECT_URI` secret value to:

```
https://ahqauomkgflopxgnlndd.supabase.co/functions/v1/google-calendar-auth-callback
```

This is done via Lovable's secret management -- no code changes required.

### Step 2: Update Google Cloud Console (manual, done by you)

In your Google Cloud Console project:

1. Go to **APIs & Services > Credentials**
2. Click on your OAuth 2.0 Client ID (Web application)
3. Under **Authorized redirect URIs**, find the old entry (`...google-oauth-callback`) and replace it with:
   ```
   https://ahqauomkgflopxgnlndd.supabase.co/functions/v1/google-calendar-auth-callback
   ```
4. Save

### No Code Changes

No files need to be modified. The edge functions already read `GOOGLE_REDIRECT_URI` from the environment, so once the secret value is corrected, everything will point to the right place.

