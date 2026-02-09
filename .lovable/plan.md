

# Messaging System Implementation Plan

## The Hard Truth First

Before the technical plan, here are the facts that drive the decisions:

1. **Only 56 of 593 clients have `primary_staff_id` set.** A messaging system that routes solely on `primary_staff_id` would be broken for 90% of your client base on day one. This must be addressed as a data prerequisite, not an afterthought.

2. **The client portal does not exist in this codebase yet.** The `portals/README.md` references it, but `StaffPortalApp.tsx` is the only portal implemented. The messaging UI for clients will eventually live in a separate client portal app that queries the same Supabase backend. This plan designs the database and RLS layer to support both portals, but only builds the staff-side UI now.

3. **HIPAA compliance is non-negotiable.** Messages between clinicians and clients are PHI. This means encryption at rest (Supabase handles this), strict RLS, audit-ready timestamps, and absolutely no message content in notifications outside the app. You need a BAA with Supabase (Pro plan).

---

## Architectural Decision: Single `messages` Table with Thread-per-Relationship

**Why not a separate `conversations` table?**
A conversations table adds a join, a lifecycle to manage, and complexity for what is fundamentally a 1:1 relationship (one client to one staff member). The conversation IS the client-staff relationship. Adding a conversations table is premature abstraction that increases the surface area for bugs and RLS policy mistakes.

**The model:** One `messages` table. Each message has a `client_id` and `staff_id`. The "thread" is the unique pair `(client_id, staff_id)`. The staff-side UI groups messages by client. The client-side UI groups messages by staff member (which for most clients will be exactly one thread).

**Why `staff_id` and not just `primary_staff_id`?**
Because `primary_staff_id` is only populated for 10% of clients. And because a client may legitimately message a different staff member (e.g., an admin handling scheduling). The message explicitly records who the conversation is with.

---

## Database Schema

### New Table: `messages`

```text
messages
-----------------------------------------
id              uuid        PK, default gen_random_uuid()
tenant_id       uuid        NOT NULL, FK -> tenants(id)
client_id       uuid        NOT NULL, FK -> clients(id)
staff_id        uuid        NOT NULL, FK -> staff(id)
sender_type     text        NOT NULL, CHECK IN ('client', 'staff')
sender_id       uuid        NOT NULL (profile_id of the sender)
body            text        NOT NULL
read_at         timestamptz NULL (set when recipient reads it)
created_at      timestamptz NOT NULL, default now()
```

No `updated_at` -- messages are immutable once sent. No edit, no delete. This is a clinical communication record.

### Indexes

- `(client_id, staff_id, created_at DESC)` -- thread listing, most recent first
- `(staff_id, read_at)` -- unread count for staff dashboard
- `(client_id, read_at)` -- unread count for client portal
- `(tenant_id)` -- tenant scoping

### RLS Policies

Four policies, all using direct `auth.uid()` to avoid circular dependencies:

1. **Staff can read messages for their tenant's clients:**
   `SELECT` where `tenant_id IN (SELECT tenant_id FROM tenant_memberships WHERE profile_id = auth.uid())`

2. **Clients can read their own messages:**
   `SELECT` where `client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())`

3. **Staff can send messages (INSERT):**
   `INSERT` where `sender_type = 'staff'` AND `sender_id = auth.uid()` AND tenant membership check

4. **Clients can send messages (INSERT):**
   `INSERT` where `sender_type = 'client'` AND `sender_id = auth.uid()` AND `client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())`

5. **Mark as read (UPDATE):**
   Only allow updating `read_at` (not body), scoped to messages where the current user is the recipient.

---

## Data Prerequisite: `primary_staff_id` Backfill

Before messaging is useful, most clients need a `primary_staff_id`. Two approaches (not mutually exclusive):

1. **Manual assignment via the All Clients view** -- already possible through the existing client edit form. This is the immediate path.
2. **Auto-derive from appointments** -- a one-time SQL backfill that sets `primary_staff_id` to the staff member with the most appointments for each client. This gets the 14 clients with appointments covered automatically.

The messaging UI should not block on this. If a client has no `primary_staff_id`, they simply don't have a default thread -- but staff can still initiate a message to any client.

---

## Staff Portal Implementation

### New Route: `/staff/messages`

Added to `StaffPortalApp.tsx` as a standard route (not admin-only -- all clinicians need this).

### Components

1. **MessagesPage** (`src/pages/Messages.tsx`)
   - Left panel: conversation list (clients who have threads with this staff member)
   - Right panel: message thread for selected client
   - Unread badge count
   - "New Message" button that opens a client selector

2. **ConversationList** (`src/components/Messages/ConversationList.tsx`)
   - Lists unique clients with most recent message preview
   - Unread indicator per conversation
   - Sorted by most recent message

3. **MessageThread** (`src/components/Messages/MessageThread.tsx`)
   - Chronological message display
   - Auto-scroll to bottom
   - Text input with send button
   - Marks messages as read when viewed

4. **NewMessageDialog** (`src/components/Messages/NewMessageDialog.tsx`)
   - Uses existing `ClientSelector` component
   - Creates first message in thread

### Hooks

- `useConversations(staffId)` -- fetches distinct client threads with last message
- `useMessages(clientId, staffId)` -- fetches message thread
- `useSendMessage()` -- mutation to insert a message
- `useMarkAsRead()` -- mutation to update read_at
- `useUnreadCount(staffId)` -- for nav badge

### Real-time

Subscribe to Supabase Realtime on the `messages` table filtered by `staff_id` matching the current staff member's ID. This gives instant message delivery without polling.

---

## Client Portal Readiness

The database layer (table, RLS, indexes) is designed to work for both portals. When the client portal is built, it will need:

- A `useClientMessages(clientId)` hook that queries messages where `client_id` matches
- A simple thread view (clients typically have one staff member)
- The same Realtime subscription pattern, filtered by `client_id`

No database changes will be needed when the client portal adds messaging.

---

## Navigation Integration

Add "Messages" to the staff navigation between "Calendar" and "Profile". Include an unread count badge using the `useUnreadCount` hook.

---

## What This Plan Does NOT Include (and Why)

- **File attachments** -- Adds storage complexity and PHI risk. Add later if needed.
- **Email/SMS notifications** -- Sending PHI content outside the app violates HIPAA. A future version could send "You have a new message" (no content) via the existing email infrastructure, but that is a separate feature.
- **Message editing or deletion** -- Clinical communications should be immutable for audit purposes.
- **Group messaging** -- Not clinically appropriate for a therapy EHR. 1:1 only.
- **Typing indicators** -- Unnecessary complexity for v1.

---

## Implementation Sequence

1. Database migration: create `messages` table, indexes, RLS policies
2. Create hooks: `useConversations`, `useMessages`, `useSendMessage`, `useMarkAsRead`, `useUnreadCount`
3. Build `MessageThread` component (the core UI)
4. Build `ConversationList` component
5. Build `MessagesPage` composing both
6. Build `NewMessageDialog` with client selector
7. Add route to `StaffPortalApp.tsx`
8. Add navigation entry with unread badge
9. Wire up Supabase Realtime subscription
10. Test end-to-end with real staff account

---

## Risk Assessment

| Risk | Level | Mitigation |
|---|---|---|
| Breaking existing tables | None | Purely additive -- no existing tables modified |
| RLS circular dependency | Low | All policies use direct `auth.uid()` or tenant_memberships (no self-referencing) |
| Performance at scale | Low | Indexed queries, pagination on message threads |
| Client portal compatibility | None | Database layer is portal-agnostic by design |
| HIPAA exposure | Low | In-app only, no PHI in notifications, immutable messages, RLS enforced |

