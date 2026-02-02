

# Implementation Plan: Fix Appointments Page Data Fetching

## Problem Summary

The `/staff/appointments` page is showing only 12 of 171 total appointments (7%) due to two compounding issues:

| Issue | Root Cause | Impact |
|-------|------------|--------|
| **Date Range Restriction** | `useStaffAppointments` uses 7-day lookback / 90-day forward | 159 historical appointments excluded |
| **Inactive Staff Exclusion** | `useTenantStaff` filters for `prov_status IN ('Active', 'New')` | Adam Smith's 102 appointments invisible to admin filter |
| **Filter UI Overflow** | `PopoverContent` has no `max-height` or scroll area | Filter panel extends below viewport |

---

## Database Reality

```text
Total appointments: 171
├── Before default range (>7 days ago): 159 (93%)
├── In default range: 12 (7%)
└── After default range: 0

Staff with appointments:
├── Adam Smith (INACTIVE): 102 appointments ← Cannot be filtered by admin
├── Melissa Colton (Active): 31 appointments
├── Katie Weidenkeller (Active): 18 appointments
├── Jennifer Russell Baker (Active): 12 appointments
└── Lucas Predmore (Active): 8 appointments
```

---

## Technical Decision

**Create a new `useAllAppointments` hook for the Appointments page that directly queries the `public.appointments` table without calendar-specific restrictions.**

### Why This Is the Right Approach

1. **Separation of Concerns**: The calendar needs a tight date window for performance and UX. The Appointments list page needs to show all historical and future appointments for administrative/clinical purposes. These are fundamentally different use cases that should not share the same data-fetching logic.

2. **No Database Changes Required**: The immutable schema constraint is maintained. We're using the existing `appointments` table with standard Supabase queries.

3. **Preserves Calendar Integrity**: `useStaffAppointments` continues to power the Dashboard and Calendar with its optimized date range and timezone handling. The new hook serves only the Appointments list page.

4. **Pagination-Ready**: A direct table query naturally supports pagination (LIMIT/OFFSET or cursor-based), which will be essential as appointment data grows.

5. **Simpler Code**: The Appointments page doesn't need fake-local Date objects for react-big-calendar positioning. It just needs raw data with proper joins.

### Alternative Considered (Rejected)

**Modifying `useStaffAppointments` to accept unbounded date ranges**: This would bloat a calendar-optimized hook with list-view concerns, couple unrelated features, and require managing two completely different data shapes in one hook.

---

## Implementation Details

### 1. Create New Hook: `useAllAppointments`

**File: `src/hooks/useAllAppointments.tsx`**

Purpose: Fetch all appointments from `public.appointments` with client/service/staff joins for the Appointments list page.

```text
Key Features:
- Direct query to appointments table (no RPC)
- Joins: clients, services, staff
- Filters by tenant_id (RLS)
- Optional staff_id filter for admin multi-select
- No hardcoded date range (uses filter date range if provided)
- All appointment statuses included by default
- Simple date string formatting (no fake-local Dates needed)

Query Shape:
  SELECT 
    a.*,
    c.pat_name_f, c.pat_name_l, c.pat_name_preferred,
    s.name as service_name,
    st.prov_name_f, st.prov_name_l, st.prov_name_for_clients
  FROM appointments a
  LEFT JOIN clients c ON a.client_id = c.id
  LEFT JOIN services s ON a.service_id = s.id
  LEFT JOIN staff st ON a.staff_id = st.id
  WHERE a.tenant_id = :tenantId
    AND (:staffIds IS NULL OR a.staff_id = ANY(:staffIds))
  ORDER BY a.start_at DESC

Interface:
  interface AllAppointment {
    id: string;
    tenant_id: string;
    client_id: string;
    staff_id: string;
    service_id: string;
    series_id: string | null;
    start_at: string;
    end_at: string;
    status: string;
    is_telehealth: boolean;
    location_name: string | null;
    // Joined display fields
    client_name: string;
    client_legal_name: string;
    service_name: string;
    clinician_name: string;
    // Formatted for display
    display_date: string;
    display_time: string;
  }
```

### 2. Update `useTenantStaff`

**File: `src/hooks/useTenantStaff.tsx`**

Change: Remove the status filter OR add a new option to include inactive staff.

```text
Current (problematic):
  .in('prov_status', ['Active', 'New'])

Option A - Include all staff:
  // Remove the filter entirely for admin use cases

Option B - Add parameter (chosen):
  export function useTenantStaff(options?: { includeInactive?: boolean }) {
    const statusFilter = options?.includeInactive 
      ? undefined 
      : ['Active', 'New'];
    
    // Apply statusFilter conditionally
  }
```

The Appointments page will call `useTenantStaff({ includeInactive: true })` to show all clinicians who have ever had appointments, regardless of current status.

### 3. Update `AppointmentFilters` PopoverContent

**File: `src/pages/Appointments.tsx`**

Change: Add `max-height` and `overflow-y-auto` to the PopoverContent.

```text
Current:
  <PopoverContent className="w-80" align="end">

Fixed:
  <PopoverContent className="w-80 max-h-[80vh] overflow-y-auto" align="end">
```

### 4. Update `Appointments.tsx` to Use New Hook

**File: `src/pages/Appointments.tsx`**

Changes:
- Import and use `useAllAppointments` instead of `useStaffAppointments`
- Pass `{ includeInactive: true }` to `useTenantStaff`
- Remove series mixing (optional - keep if series display is desired)
- Simplify date/time display (use appointment's start_at directly formatted)

```text
// Before
import { useStaffAppointments } from '@/hooks/useStaffAppointments';

const { appointments, ... } = useStaffAppointments({
  staffIds: isAdmin && filters.staffIds.length > 0 ? filters.staffIds : undefined,
});

// After
import { useAllAppointments } from '@/hooks/useAllAppointments';

const { appointments, ... } = useAllAppointments({
  staffIds: isAdmin ? (filters.staffIds.length > 0 ? filters.staffIds : undefined) : undefined,
  dateFrom: filters.dateFrom?.toISOString(),
  dateTo: filters.dateTo?.toISOString(),
});
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useAllAppointments.tsx` | **Create** | New hook for list view, directly queries appointments table |
| `src/hooks/useTenantStaff.tsx` | **Modify** | Add `includeInactive` option to show all clinicians |
| `src/pages/Appointments.tsx` | **Modify** | Use new hook, fix PopoverContent overflow |
| `src/components/Appointments/AppointmentFilters.tsx` | No change | Already correctly structured |

---

## Data Flow After Fix

```text
Admin visits /staff/appointments
         │
         ▼
useTenantStaff({ includeInactive: true })
  → Returns ALL 9 staff members (including Adam Smith)
         │
         ▼
useAllAppointments({
  staffIds: filters.staffIds (if any selected),
  dateFrom: filters.dateFrom,
  dateTo: filters.dateTo
})
         │
         ▼
Direct query to appointments table
  → No RPC date restrictions
  → Joins client/service/staff
  → Returns 171 appointments (or filtered subset)
         │
         ▼
Client-side filtering for status/client/service
         │
         ▼
Display in table with all data visible
```

---

## Date Display Formatting

Since we're not using the RPC's timezone formatting, the new hook will format dates client-side. For the Appointments list (administrative view), browser-local formatting is acceptable:

```typescript
// Simple formatting in useAllAppointments
const display_date = new Date(row.start_at).toLocaleDateString('en-US', {
  weekday: 'short',
  month: 'short', 
  day: 'numeric',
  year: 'numeric'
});

const display_time = new Date(row.start_at).toLocaleTimeString('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});
```

For clinicians viewing their own appointments, this shows times in their browser's timezone. This is reasonable for a list view (unlike the calendar where precise staff-timezone positioning is critical).

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Admin selects no clinicians | Show all appointments for tenant |
| Non-admin user | Filter by their own staff_id automatically |
| Inactive staff with appointments | Visible in filter and results |
| Large dataset (1000+ appointments) | Future: add pagination (not in this scope) |
| Date filter spans years | Supported - no artificial restrictions |

---

## Testing Checklist

1. **Data Visibility**
   - [ ] All 171 appointments visible when no filters applied (admin)
   - [ ] Adam Smith's 102 appointments accessible via clinician filter
   - [ ] Historical appointments (before 7 days ago) visible
   - [ ] All status types (scheduled, documented, cancelled, late_cancel/noshow) displayed

2. **Admin Multi-Clinician Filter**
   - [ ] All 9 staff members appear in clinician dropdown (including Inactive)
   - [ ] Selecting inactive clinician shows their historical appointments
   - [ ] Multi-select works correctly

3. **Filter UI**
   - [ ] Filter popover scrolls when content exceeds viewport
   - [ ] All filter options accessible on smaller screens

4. **Non-Admin Experience**
   - [ ] Non-admin sees only their own appointments
   - [ ] Clinician filter is hidden for non-admins

---

## What This Does NOT Change

- **Dashboard (`Index.tsx`)**: Continues using `useStaffAppointments` with its calendar-optimized date range
- **Calendar (`RBCCalendar`)**: Continues using `useStaffAppointments` with fake-local Date objects
- **Database schema**: No changes (immutable constraint respected)
- **RPC functions**: No changes needed

---

## Technical Notes

- The new hook uses standard Supabase `.from().select()` pattern with explicit joins
- RLS policies on `appointments` table will automatically filter by tenant
- Date filtering happens both in the query (if provided) and client-side (for real-time filter changes)
- Status is typed as `string` (not enum) for flexibility with filter comparisons

