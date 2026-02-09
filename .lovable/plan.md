

# Email Notification for New Client Messages

## Summary

When a client sends a message, the staff member receives an email notification via the Resend API. This is implemented with a new edge function and triggered from the staff portal's existing realtime subscription.

## How It Works

1. A client sends a message (inserted into the `messages` table with `sender_type = 'client'`)
2. The staff portal's existing realtime subscription (`useMessagesRealtime`) already detects the INSERT
3. A new hook adds a second realtime channel that, on detecting a client message, calls the new `notify-new-message` edge function
4. The edge function looks up the staff member's email and the client's name, then sends a notification email via Resend

## New Edge Function: `notify-new-message`

- Receives `{ message_id }` in the request body
- Uses the service role key to query:
  - The message row (to get `staff_id`, `client_id`, `body`, `sender_type`)
  - The staff member's email (via `staff -> profile_id -> profiles.email`)
  - The client's name (from `clients`)
- Sends an email via Resend with subject like "New message from [Client Name]"
- The email body includes a brief preview of the message and a link to the messages page
- Only sends if `sender_type = 'client'` (safety check)
- Uses `verify_jwt = false` but validates an internal check (the message must exist and be from a client)

## Application Code Changes

| File | Change |
|---|---|
| `supabase/functions/notify-new-message/index.ts` | New edge function that sends the notification email |
| `supabase/config.toml` | Add `[functions.notify-new-message]` with `verify_jwt = false` |
| `src/hooks/useMessages.tsx` | In `useMessagesRealtime`, when a new client message arrives, call the edge function |

## Important Details

- The email is sent from `onboarding@resend.dev` (matching existing edge functions) -- you can update this to a verified domain later
- The edge function truncates the message body in the email to avoid exposing too much PHI in email (first 100 characters + ellipsis)
- If the staff member is currently viewing the conversation (message gets marked as read), the email still sends -- this is intentional since the email may arrive after they navigate away
- No database changes required
- The existing `RESEND_API_KEY` secret is already configured

## What Does NOT Change

- No database tables or columns modified
- No RLS policy changes
- The existing realtime subscription and unread badge continue to work as before
- No changes to the client portal

