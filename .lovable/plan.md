

# Google Calendar Sync -- Backend Infrastructure (No UI)

Build all the server-side plumbing so that when Google OAuth approval comes through, the system is ready to go. No frontend changes in this phase.

---

## What Gets Built

### 1. Two New Database Tables

**`staff_calendar_connections`** -- stores each clinician's Google OAuth connection

| Column | Purpose |
|---|---|
| id (uuid, PK) | Row identifier |
| tenant_id (uuid, FK tenants) | Multi-tenant isolation |
| staff_id (uuid, FK staff) | Which clinician owns this connection |
| provider (text, default 'google') | Future-proofs for other providers |
| access_token_encrypted (text) | Encrypted OAuth access token |
| refresh_token_encrypted (text) | Encrypted OAuth refresh token |
| token_expires_at (timestamptz) | When the access token expires |
| selected_calendar_id (text) | Which Google calendar they picked (e.g. "primary") |
| connection_status (text) | 'connected', 'needs_reconnect', 'disconnected' |
| last_sync_at (timestamptz) | Last successful sync timestamp |
| last_error (text) | Last error message if any |
| created_at / updated_at (timestamptz) | Timestamps |

RLS: staff can only read/update their own row (matched via profile_id through the staff table).

**`calendar_sync_log`** -- maps each EHR appointment to its Google Calendar event

| Column | Purpose |
|---|---|
| id (uuid, PK) | Row identifier |
| tenant_id (uuid, FK tenants) | Multi-tenant isolation |
| appointment_id (uuid, FK appointments) | The EHR appointment |
| staff_id (uuid, FK staff) | The clinician whose calendar has the event |
| google_event_id (text) | The Google Calendar event ID (for update/delete) |
| google_calendar_id (text) | Which calendar the event lives on |
| sync_status (text) | 'synced', 'pending', 'failed' |
| sync_direction (text) | 'outbound' (EHR to Google) |
| last_synced_at (timestamptz) | When last successfully synced |
| error_message (text) | Last error if failed |
| retry_count (integer, default 0) | For retry tracking |
| created_at / updated_at (timestamptz) | Timestamps |

Unique constraint on (appointment_id, staff_id) to prevent duplicate event mappings.

**Important**: No existing tables are modified. These are purely additive.

---

### 2. Five New Edge Functions

All functions are server-side only. OAuth tokens never touch the browser.

#### a) `google-calendar-auth-start`
- Generates the Google OAuth URL with correct scopes and state parameter
- State includes staff_id + HMAC signature (using OAUTH_STATE_SIGNING_SECRET)
- Returns the URL for the frontend to redirect to
- Scopes: `https://www.googleapis.com/auth/calendar.freebusy` + `https://www.googleapis.com/auth/calendar.events`

#### b) `google-calendar-auth-callback`
- Receives the OAuth callback code from Google
- Validates the state parameter (HMAC check)
- Exchanges the code for access + refresh tokens
- Encrypts tokens using TOKEN_ENCRYPTION_KEY
- Stores them in `staff_calendar_connections`
- Sets connection_status = 'connected'
- Redirects back to the app

#### c) `google-calendar-list-calendars`
- Authenticated endpoint (requires JWT)
- Reads the clinician's stored tokens, refreshes if expired
- Calls Google Calendar API to list the clinician's calendars
- Returns a simple list of { id, summary, primary } for calendar selection

#### d) `google-calendar-get-availability`
- Inputs: staff_id, date range
- Reads the clinician's stored tokens
- Calls Google Calendar FreeBusy API for the selected calendar
- Returns only busy intervals (start/end pairs) -- no event details
- These intervals will later be merged with EHR appointments to compute open slots

#### e) `google-calendar-sync-appointment`
- Inputs: appointment_id, action ('create' | 'update' | 'delete')
- Looks up the appointment and the clinician's calendar connection
- On **create**: Creates a Google Calendar event titled "ValorWell" with start/end time only, stores the returned event ID in `calendar_sync_log`
- On **update**: Uses the stored google_event_id to update the existing event (no duplicate)
- On **delete/cancel**: Uses the stored google_event_id to delete/cancel the event
- Handles token refresh automatically
- If auth fails (revoked token), marks connection as 'needs_reconnect'

---

### 3. Config Updates

**`supabase/config.toml`** -- add all five new functions:
- `google-calendar-auth-start`: verify_jwt = false (pre-auth)
- `google-calendar-auth-callback`: verify_jwt = false (OAuth redirect)
- `google-calendar-list-calendars`: verify_jwt = true
- `google-calendar-get-availability`: verify_jwt = false (will validate internally, may be called from patient-facing context)
- `google-calendar-sync-appointment`: verify_jwt = true

---

### 4. Secrets Already Configured

Based on your screenshot, all required secrets are already in place:
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REDIRECT_URI
- GOOGLE_SCOPES
- OAUTH_STATE_SIGNING_SECRET
- TOKEN_ENCRYPTION_KEY
- GOOGLE_OAUTH_PROMPT
- GOOGLE_OAUTH_ACCESS_TYPE

No additional secrets needed.

---

## What Does NOT Get Built (Yet)

- No frontend UI (connect button, calendar selection, sync status panel)
- No "Personal" block overlay on the calendar view
- No patient self-scheduling integration
- No automatic triggers (appointment changes won't auto-push to Google yet -- the edge function exists but nothing calls it automatically)

---

## Safety Guarantees

- **Zero changes to existing tables**: appointments, staff, and all other tables remain untouched
- **Zero changes to existing edge functions**: appointment creation/update hooks are not modified
- **Zero changes to existing frontend code**: no React components are touched
- **Fully reversible**: if anything goes wrong, delete the two new tables and the five edge functions -- the rest of the app is unaffected
- **Isolated failure**: if Google API is down or tokens expire, the only impact is the sync features stop working; all core EHR functionality continues normally

