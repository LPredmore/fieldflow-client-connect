

# Fix: Update Resend "From" Address to Verified Domain

## Problem

The `notify-new-message` Edge Function sends emails from `noreply@valorwell.com`, but the verified sending domain in Resend is `valorwell.org`. This causes Resend to silently reject the email (returning `undefined` for the `resend_id`).

## Fix

One line change in `supabase/functions/notify-new-message/index.ts`:

Change the `from` field from:
```
"ValorWell <noreply@valorwell.com>"
```
to:
```
"ValorWell <noreply@valorwell.org>"
```

## Files Modified

| File | Change |
|---|---|
| `supabase/functions/notify-new-message/index.ts` | Update `from` address to `noreply@valorwell.org` |

No other files, database changes, or configuration changes needed. After deploying, the next client message will trigger a successful email delivery.

