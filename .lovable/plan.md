

# Complete Bidirectional Google Calendar Sync

## What Exists Today

- **Outbound sync (create only):** `useAppointmentCreation.tsx` fires a call to the `google-calendar-sync-appointment` Edge Function after inserting an appointment. That Edge Function already handles `create`, `update`, and `delete` actions with full token refresh, encryption, and sync logging.
- **No outbound sync on edit/delete:** `useRecurringAppointmentActions.tsx` (7 mutation methods), `useStaffAppointments.tsx` (update/delete), `useAppointmentSeries.tsx` (deleteSeries hard-deletes appointments), and `RBCCalendar.tsx` (handleUpdateAppointment) all modify appointments without calling the sync function.
- **No inbound sync:** `google-calendar-get-availability` can fetch FreeBusy data on demand, but nothing stores those blocks or watches for changes.
- **No storage for external blocks:** The `appointments` table has NOT NULL constraints on `client_id`, `service_id`, and `created_by_profile_id`, so external busy blocks cannot be stored there.

## Architecture Decisions

### Decision 1: Google Push Notifications (webhooks), not polling

Google Calendar supports `watch` channels that POST to your endpoint within seconds of any change. This is the right choice over pg_cron polling because:

- The self-scheduling system needs sub-5-second accuracy to prevent double bookings. Polling at any interval creates a window where a client books a slot that was just blocked externally.
- Push notifications use zero API quota when nothing changes. Polling burns quota on every tick regardless.
- Google explicitly recommends push notifications for sync use cases.

The tradeoff is channel renewal (channels expire every 7 days). A daily pg_cron job handles this automatically.

### Decision 2: Dedicated `staff_calendar_blocks` table

External busy blocks cannot go in `appointments` because `client_id`, `service_id`, and `created_by_profile_id` are all NOT NULL, and modifying those constraints is forbidden.

A separate table stores only `staff_id`, `start_at`, `end_at`, `source`, and `external_event_id`. The self-scheduler queries availability with a simple union:

```text
Slot is unavailable IF:
  appointments WHERE staff_id = X AND status = 'scheduled' AND time overlaps
  OR
  staff_calendar_blocks WHERE staff_id = X AND time overlaps
```

No sentinel data, no nullable hacks, no ambiguity.

### Decision 3: Use Google Events API (not FreeBusy) for inbound sync

The existing `google-calendar-get-availability` uses the FreeBusy API, which only returns busy intervals with no event IDs. This means you cannot detect when an event is deleted or moved -- you would have to diff entire time ranges on every poll.

The Events API returns individual events with stable IDs. When Google sends a push notification saying "something changed," we call `Events.list` with `updatedMin` to get only changed events, then upsert/delete in `staff_calendar_blocks` by `external_event_id`. This is precise, efficient, and handles deletions correctly.

The existing `GOOGLE_SCOPES` secret already includes `calendar.events`, so no scope change is needed.

---

## Implementation Plan

### Phase 1: Database -- Two New Tables

**Table: `staff_calendar_blocks`**

| Column | Type | Constraint |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| tenant_id | uuid | FK tenants, NOT NULL |
| staff_id | uuid | FK staff, NOT NULL |
| start_at | timestamptz | NOT NULL |
| end_at | timestamptz | NOT NULL |
| source | text | NOT NULL, default 'google' |
| external_event_id | text | nullable |
| summary | text | default 'Busy' (never stores real event title) |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

- Unique constraint: `(staff_id, source, external_event_id)` for dedup
- Index on `(staff_id, start_at, end_at)` for fast range queries
- RLS: staff can SELECT their own blocks; service role writes via Edge Functions

**Table: `calendar_watch_channels`**

| Column | Type | Constraint |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| tenant_id | uuid | FK tenants, NOT NULL |
| staff_id | uuid | FK staff, NOT NULL |
| channel_id | text | NOT NULL (Google-assigned) |
| resource_id | text | NOT NULL (Google-assigned) |
| calendar_id | text | NOT NULL |
| expiration | timestamptz | NOT NULL |
| created_at | timestamptz | default now() |

- RLS: service role only (Edge Functions manage these)

### Phase 2: Outbound Sync -- Wire All Mutation Paths

Create a shared utility function `syncAppointmentToGoogle(appointmentId, action)` that fire-and-forget calls the existing `google-calendar-sync-appointment` Edge Function. Then add it to every code path that modifies appointments:

**`useRecurringAppointmentActions.tsx`** (6 methods):
- `editSingleOccurrence` -- sync with `action: 'update'`
- `editThisAndFuture` -- sync each updated appointment with `action: 'update'`
- `updateAppointment` -- sync with `action: 'update'`
- `deleteSingleOccurrence` -- sync with `action: 'delete'`
- `deleteThisAndFuture` -- sync each cancelled appointment with `action: 'delete'`
- `deleteEntireSeries` -- sync each cancelled appointment with `action: 'delete'`

**`useStaffAppointments.tsx`** (2 methods):
- `updateAppointment` -- sync with `action: 'update'`
- `deleteAppointment` -- sync with `action: 'delete'`

**`useAppointmentSeries.tsx`** (1 method):
- `deleteSeries` -- hard-deletes appointments. Before deleting, fetch the appointment IDs and sync each with `action: 'delete'`.

**`RBCCalendar.tsx`** (1 method):
- `handleUpdateAppointment` -- sync with `action: 'update'`

All sync calls are fire-and-forget (non-blocking). If sync fails, the EHR appointment is still correctly saved. The `calendar_sync_log` table tracks failures for potential retry.

No changes to the `google-calendar-sync-appointment` Edge Function are needed -- it already supports create, update, and delete.

### Phase 3: Inbound Sync -- Google Push Notifications

**New Edge Function: `google-calendar-webhook`**
- `verify_jwt = false` (Google sends raw POST, no JWT)
- Validates incoming `X-Goog-Channel-ID` against `calendar_watch_channels` table
- Calls Google Events API `events.list` with `updatedMin = last_sync_at` to get only changed events
- For each event:
  - If `status === 'cancelled'`: delete from `staff_calendar_blocks`
  - If confirmed/tentative: upsert into `staff_calendar_blocks` with `start_at`, `end_at`, `external_event_id`
  - Summary is always stored as 'Busy' (privacy constraint)
- Updates `last_sync_at` on `staff_calendar_connections`
- Returns 200 immediately (Google requires fast response)

**New Edge Function: `google-calendar-watch-start`**
- Called after staff selects a calendar (from `useCalendarConnection.selectCalendar`)
- Creates a Google `watch` channel pointing to the webhook URL
- Stores channel details in `calendar_watch_channels`
- Performs an initial full sync: calls Events.list for the next 90 days and bulk-inserts into `staff_calendar_blocks`

**Config updates (`supabase/config.toml`):**
```toml
[functions.google-calendar-webhook]
verify_jwt = false

[functions.google-calendar-watch-start]
verify_jwt = false
```

### Phase 4: Channel Renewal via pg_cron

Google watch channels expire after a maximum of 7 days. A daily pg_cron job:

1. Queries `calendar_watch_channels` for channels expiring within 48 hours
2. For each, calls `google-calendar-watch-start` to create a new channel
3. Deletes the old channel record

This is a SQL `SELECT net.http_post(...)` call, no new Edge Function needed.

### Phase 5: Disconnect Cleanup

Update `useCalendarConnection.disconnect` to also:
1. Call a new method in the webhook Edge Function (or a small cleanup function) to stop the Google watch channel
2. Delete all `staff_calendar_blocks` for the disconnecting staff member
3. Delete the `calendar_watch_channels` record

This prevents orphaned blocks from appearing on the calendar after disconnection.

### Phase 6: Calendar UI -- Display External Blocks

**New hook: `useStaffCalendarBlocks`**
- Queries `staff_calendar_blocks` for the current staff member's date range
- Returns blocks as background events with "fake local" Dates (same pattern as `useStaffAppointments`)

**Update `RBCCalendar.tsx`:**
- Merge external blocks into the events array as non-clickable, grey/hatched "Busy" background events
- These blocks have no detail view -- clicking does nothing
- Use react-big-calendar's `backgroundEvents` prop to visually distinguish them from appointments

### Phase 7: Self-Scheduling Foundation

When the self-scheduler is built, availability is determined by a single database function:

```sql
-- Returns TRUE if the slot is available
CREATE FUNCTION check_staff_availability(
  p_staff_id uuid, p_start timestamptz, p_end timestamptz
) RETURNS boolean AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM appointments
    WHERE staff_id = p_staff_id AND status = 'scheduled'
      AND start_at < p_end AND end_at > p_start
  )
  AND NOT EXISTS (
    SELECT 1 FROM staff_calendar_blocks
    WHERE staff_id = p_staff_id
      AND start_at < p_end AND end_at > p_start
  );
$$ LANGUAGE sql STABLE;
```

Both tables use the same `(staff_id, start_at, end_at)` index pattern, making this query fast and simple.

---

## Execution Order

| Step | What | Dependencies |
|---|---|---|
| 1 | Create `staff_calendar_blocks` and `calendar_watch_channels` tables (migration) | None |
| 2 | Add outbound sync calls to all 10 mutation code paths (frontend) | None (Edge Function already exists) |
| 3 | Build `google-calendar-webhook` Edge Function | Step 1 |
| 4 | Build `google-calendar-watch-start` Edge Function | Steps 1, 3 |
| 5 | Update `useCalendarConnection.selectCalendar` to trigger watch setup | Step 4 |
| 6 | Update `useCalendarConnection.disconnect` to clean up watches and blocks | Steps 1, 4 |
| 7 | Set up pg_cron for channel renewal | Step 4 |
| 8 | Build `useStaffCalendarBlocks` hook and integrate into `RBCCalendar` | Step 1 |
| 9 | Create `check_staff_availability` database function | Step 1 |

Steps 1 and 2 are independent and can ship immediately. Steps 3-6 form the inbound sync pipeline. Steps 7-9 are polish and self-scheduling prep.

## Risk Mitigation

- **Failure isolation:** If the webhook goes down, EHR appointments work normally. Blocks become stale but never corrupt data. Recovery is automatic on next notification.
- **Rate limiting:** Batch operations (deleteEntireSeries, editThisAndFuture) sync each appointment individually. The Edge Function is already idempotent via sync log dedup, so duplicate calls are harmless.
- **Privacy:** External events are stored as time ranges with summary always set to 'Busy'. No titles, descriptions, or attendees are ever stored.
- **Database immutability:** No existing tables are modified. Two new additive tables only.
- **Token expiry:** All Edge Functions already handle token refresh. If refresh fails, connection status is set to `needs_reconnect` and the UI prompts the clinician.

