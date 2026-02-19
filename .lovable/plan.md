

# Staff Availability Schedule + Manual Time Blocks (Revised)

## Revision from Previous Plan

One constraint has been reinforced and is now a hard architectural rule:

**The future `get_available_slots` RPC will be 100% PostgreSQL.** No JavaScript slot calculation, no date-fns-tz, no browser Intl. The function will:

1. Convert `staff_availability_schedules` TIME values from staff local timezone to UTC using `AT TIME ZONE`
2. Subtract `appointments` (already UTC)
3. Subtract `staff_calendar_blocks` (already UTC)
4. Return pre-formatted display strings in the requesting client's timezone using `TO_CHAR(... AT TIME ZONE client_tz)`

This matches the existing pattern established by `get_client_appointments_display` and `get_staff_calendar_appointments`. The client portal will receive ready-to-render strings and never perform timezone math.

This RPC is NOT built in this phase, but the data model below is designed specifically to make it straightforward in PostgreSQL.

---

## What Gets Built Now

### 1. Weekly Availability Schedule (Settings)

**New table: `staff_availability_schedules`**

```
id              UUID PRIMARY KEY
tenant_id       UUID NOT NULL -> tenants(id)
staff_id        UUID NOT NULL -> staff(id)
day_of_week     INTEGER NOT NULL (0=Sun, 6=Sat)
start_time      TIME NOT NULL (e.g., '09:00')
end_time        TIME NOT NULL (e.g., '17:00')
is_active       BOOLEAN NOT NULL DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
UNIQUE(staff_id, day_of_week, start_time)
```

Times are plain TIME in the clinician's local timezone (from `staff.prov_time_zone`). This is intentional: PostgreSQL can convert `'09:00'::TIME AT TIME ZONE prov_time_zone` to UTC trivially in the future RPC without any schema changes.

**RLS policies:**
- SELECT: staff can read their own rows (join through `staff.profile_id = auth.uid()`)
- INSERT/UPDATE/DELETE: staff can manage their own rows

**UI: `AvailabilitySettings.tsx`**
- 7-day grid (Monday-Sunday)
- Each day toggleable on/off
- Active days show start/end time pickers
- "Add slot" button per day for split schedules (e.g., 9-12 and 1-5)
- Save on change with toast confirmation
- Timezone label displayed from `staff.prov_time_zone` (informational only, no conversion)

**Location:** New "Availability" settings category -- NOT admin-only, every clinician manages their own schedule.

### 2. Manual Block Time (Calendar)

**No new table.** Inserts into `staff_calendar_blocks` with `source = 'manual'`.

Benefits of reusing the existing table:
- `check_staff_availability` already queries it -- manual blocks immediately prevent double-booking
- `get_staff_calendar_blocks` RPC already returns it with server-computed time components -- blocks render correctly on the calendar
- Future `get_available_slots` subtracts this table -- manual blocks automatically reduce available slots

**New RLS policies on `staff_calendar_blocks`:**
- INSERT: staff can insert where `staff_id` matches their record AND `source = 'manual'`
- UPDATE: staff can update where `staff_id` matches their record AND `source = 'manual'`
- DELETE: staff can delete where `staff_id` matches their record AND `source = 'manual'`

Google-synced blocks (`source != 'manual'`) remain protected from client-side mutation.

**UI: `BlockTimeDialog.tsx`**
- Date picker, start time, end time, optional label (default: "Blocked")
- Uses `convert_local_to_utc` RPC for both start and end before inserting (zero client-side timezone math)
- Refetches calendar blocks after insert

**Calendar interaction:**
- "Block Time" button added to `RBCCalendar` header (next to "Create Appointment")
- Clicking a manual block shows details + "Delete" button
- Google blocks remain read-only (no delete)
- Distinguished by `resource.source === 'manual'`

---

## Files

### New files
- `src/components/Settings/AvailabilitySettings.tsx` -- Weekly schedule editor
- `src/hooks/useStaffAvailability.tsx` -- CRUD for `staff_availability_schedules`
- `src/components/Calendar/BlockTimeDialog.tsx` -- Manual block creation dialog

### Modified files
- `src/pages/Settings.tsx` -- Add "Availability" category
- `src/components/Calendar/RBCCalendar.tsx` -- Add "Block Time" button, manual block click handling
- `src/hooks/useStaffCalendarBlocks.tsx` -- Add `createBlock` and `deleteBlock` mutations

### Database migrations
- Create `staff_availability_schedules` table with RLS and `set_updated_at` trigger
- Add INSERT/UPDATE/DELETE RLS policies to `staff_calendar_blocks` for `source = 'manual'` rows

---

## Execution Order

1. Database migration: `staff_availability_schedules` table + RLS + trigger
2. Database migration: manual block RLS policies on `staff_calendar_blocks`
3. `useStaffAvailability` hook
4. `AvailabilitySettings` component
5. Add to Settings page
6. Add `createBlock`/`deleteBlock` to `useStaffCalendarBlocks`
7. `BlockTimeDialog` component
8. Add "Block Time" button and manual block interaction to `RBCCalendar`

## What This Does NOT Change

- No existing database columns modified
- No changes to `check_staff_availability` function
- No changes to Google Calendar sync
- No changes to appointment CRUD or timezone handling
- No JavaScript timezone conversion introduced anywhere

