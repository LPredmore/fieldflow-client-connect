

# Server-Side Email Notification for Client Messages

## The Decision: Database Trigger + Edge Function (not client-side)

The original plan called the edge function from the browser's realtime subscription. That is the wrong architecture. Here is why, and what we will do instead.

### Why NOT trigger from the client (browser)

1. **Reliability**: The notification only fires if the staff member's browser happens to be open on the Messages page. If they are logged out, on a different page, or offline, no email is sent. This defeats the entire purpose of email notifications.
2. **Duplicate emails**: If the staff member has two tabs open, both tabs receive the realtime event and both call the edge function. Two emails for one message.
3. **Race conditions**: The browser could close or lose network before the `functions.invoke()` completes.

### Why a database trigger calling an Edge Function via `pg_net`

A PostgreSQL `AFTER INSERT` trigger on the `messages` table fires exactly once per insert, server-side, regardless of whether any browser is open. It uses `pg_net` (already available in Supabase) to make an async HTTP POST to the edge function. This is:

- **Guaranteed to fire**: Every client message triggers exactly one notification attempt, no matter what the staff member is doing.
- **No duplicates**: One insert = one trigger = one HTTP call.
- **No client code changes**: The `useMessagesRealtime` hook stays exactly as it is. Zero risk of breaking existing realtime behavior, the unread badge, or conversation loading.

### Why NOT a Supabase Database Webhook (Dashboard configuration)

Database webhooks configured through the Supabase dashboard are functionally similar but cannot be version-controlled or deployed through this codebase. A SQL-based trigger with `pg_net` lives in a migration file and deploys alongside the code.

## PHI Safety Decision

The email will NOT include any message content. It will say:

> "You have a new message from [Client Name]. Log in to view it."

No message body, no truncation, no preview. Email is not encrypted at rest and this is a healthcare application. The only PII in the email is the client's name, which is acceptable for a care relationship notification.

## Implementation

### 1. New Edge Function: `supabase/functions/notify-new-message/index.ts`

Receives `{ message_id }` from the trigger. Uses the service role key to:

- Fetch the message row, confirm `sender_type = 'client'`
- Join `staff.profile_id` to `profiles.email` to get the staff member's email
- Fetch client name from `clients` (preferred name, then first + last)
- Send email via Resend with no message content, just a link to `https://ehr-staff.lovable.app/messages`
- Return 200 on success, 500 on failure (logged in Edge Function logs)

### 2. Config: `supabase/config.toml`

Add:

```toml
[functions.notify-new-message]
verify_jwt = false
```

`verify_jwt = false` is required because the caller is `pg_net` from inside PostgreSQL, not a browser with a JWT.

### 3. Database Migration: Trigger + `pg_net` call

Create a trigger function and attach it to `public.messages`:

```text
AFTER INSERT trigger on public.messages
  -> only when NEW.sender_type = 'client'
  -> calls pg_net.http_post() to the notify-new-message edge function
  -> passes { "message_id": NEW.id } as the JSON body
  -> includes the service role key in the Authorization header
```

The trigger uses a `WHEN (NEW.sender_type = 'client')` clause so it does not fire for staff-sent messages at all (no wasted HTTP calls).

### 4. No changes to existing files

- `src/hooks/useMessages.tsx` -- unchanged
- `src/pages/Messages.tsx` -- unchanged
- No RLS policy changes
- No database column changes

## Files Changed

| File | Type | Description |
|---|---|---|
| `supabase/functions/notify-new-message/index.ts` | New | Edge function: looks up staff email and client name, sends notification via Resend |
| `supabase/config.toml` | Modified | Add `[functions.notify-new-message]` with `verify_jwt = false` |
| Database migration | New | Creates trigger function and `AFTER INSERT` trigger on `messages` table using `pg_net` |

## What Does NOT Change

- No existing application code modified (zero risk to current functionality)
- No database columns or tables added or modified
- No RLS policy changes
- No changes to the client portal or any other app consuming this database
- The existing realtime subscription, unread badge, and conversation list continue working identically

## Edge Cases Handled

| Scenario | Behavior |
|---|---|
| Staff has multiple tabs open | Irrelevant -- trigger is server-side, fires once |
| Staff is offline / logged out | Email still sends (that is the point) |
| Staff sends a message | Trigger does not fire (`WHEN` clause filters on `sender_type = 'client'`) |
| Resend API is down | Edge function returns 500, logged in Edge Function logs. Message is still saved. No user-facing error. |
| Client sends 5 messages in 10 seconds | 5 emails are sent. This is acceptable for a clinical messaging system where each message may be clinically significant. If volume becomes an issue later, a debounce can be added via a `last_notified_at` column, but that is a premature optimization for a system with low message volume. |

