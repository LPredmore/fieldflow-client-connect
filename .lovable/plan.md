

# Implementation Plan: Admin Multi-Staff Appointment Filter

## Problem Statement

Admins need the ability to view appointments for different clinicians within their organization on the Appointments page. Currently, the page only shows the logged-in user's own appointments.

---

## Current State Analysis

### Admin Detection
- `isAdmin` is already available from `useAuth()` in `Appointments.tsx` (line 130)
- Derived from `user_roles` table where `role = 'admin'`
- Also available via `user?.roleContext?.staffRoleCodes` containing `'ADMIN'` or `'ACCOUNT_OWNER'`

### Appointment Data Flow
- `useStaffAppointments` calls `get_staff_calendar_appointments` RPC with a single `p_staff_id`
- Currently hardcoded to the logged-in user's `staffData.id`
- The RPC cannot be modified (database is immutable)

### Existing Staff Selector Pattern
- `ContractorSelector` component demonstrates querying all tenant staff
- Uses `useSupabaseQuery` with `tenant_id` filter on the `staff` table
- Filters to 'Active' and 'New' status client-side

---

## Technical Decision

**Approach: Multi-RPC Merge with Optional Staff Filter**

Modify the system to:
1. Add a "Clinician" multi-select filter to `AppointmentFilters` (only visible to admins)
2. Modify `useStaffAppointments` to accept optional `staffIds` parameter
3. When `staffIds` is provided, call the RPC for each staff ID and merge results

**Why This Approach:**
- No database changes required (immutable schema constraint)
- Reuses existing, tested RPC function with timezone handling
- Parallel fetching minimizes latency
- Multi-select allows viewing any combination of clinicians
- Filter UI pattern matches existing client/service/status filters

**Alternative Considered (Rejected):**
- Direct `appointments` table query: Would bypass server-side timezone formatting, requiring significant client-side reimplementation of date handling

---

## Implementation Details

### New Hook: `useTenantStaff`

**File: `src/hooks/useTenantStaff.tsx`**

Purpose: Fetch all staff members for the current tenant (admin-only use case)

```
Query:
  SELECT id, prov_name_f, prov_name_l, prov_name_for_clients, prov_status
  FROM staff
  WHERE tenant_id = :tenantId
  
Filter (client-side): 
  prov_status IN ('Active', 'New')

Returns: Array of { id, name (display formatted) }
```

---

### Modify: `useStaffAppointments`

**File: `src/hooks/useStaffAppointments.tsx`**

Changes:
1. Add optional `staffIds?: string[]` to `UseStaffAppointmentsOptions`
2. If `staffIds` is provided and not empty:
   - Call `get_staff_calendar_appointments` for each staff ID in parallel
   - Merge results and deduplicate by appointment ID
   - Set timezone from first result (all staff assumed in same org)
3. If `staffIds` is empty or not provided, use logged-in user's staff ID (current behavior)

```text
interface UseStaffAppointmentsOptions {
  enabled?: boolean;
  range?: DateRange;
  staffIds?: string[];  // NEW: For admin multi-clinician view
}

fetchAppointments():
  if (staffIds && staffIds.length > 0) {
    // Parallel fetch for each staff
    const results = await Promise.all(
      staffIds.map(id => 
        supabase.rpc('get_staff_calendar_appointments', {
          p_staff_id: id,
          p_from_date: range.fromISO,
          p_to_date: range.toISO
        })
      )
    );
    // Merge and dedupe by appointment ID
  } else {
    // Current behavior: fetch for logged-in staff only
  }
```

---

### Modify: `AppointmentFilters`

**File: `src/components/Appointments/AppointmentFilters.tsx`**

Changes:
1. Add new prop: `isAdmin: boolean`
2. Add new prop: `tenantStaff: { id: string; name: string }[]`
3. Add new prop: `onStaffFilterChange: (staffIds: string[]) => void`
4. Add new state field: `staffIds: string[]` to `AppointmentFilterValues`
5. Render multi-select clinician filter only when `isAdmin === true`

```text
interface AppointmentFilterValues {
  status: string | null;
  clientId: string | null;
  serviceId: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  staffIds: string[];  // NEW: Multi-select staff filter
}
```

UI Addition (admin only):
```text
┌────────────────────────────────────────────────────────────┐
│ Clinician (Admin only)                                     │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ [Select clinicians...      ] [v]                      │  │
│ └──────────────────────────────────────────────────────┘  │
│ [Maya Butler] [x]  [Katie Weidenkeller] [x]               │
└────────────────────────────────────────────────────────────┘
```

---

### Modify: `Appointments.tsx`

**File: `src/pages/Appointments.tsx`**

Changes:
1. Import and use `useTenantStaff` hook
2. Update `DEFAULT_FILTERS` to include `staffIds: []`
3. Update `activeFilterCount` to count non-empty `staffIds`
4. Pass `staffIds` from filters to `useStaffAppointments` options
5. Pass `isAdmin`, `tenantStaff`, and filter handlers to `AppointmentFilters`

```text
// Add to DEFAULT_FILTERS
const DEFAULT_FILTERS = {
  ...existing,
  staffIds: [],  // Empty = show logged-in user's appointments
};

// Hook call with conditional staffIds
const { appointments, ... } = useStaffAppointments({
  staffIds: isAdmin ? filters.staffIds : undefined,
});

// Pass to AppointmentFilters
<AppointmentFilters
  ...existing
  isAdmin={isAdmin}
  tenantStaff={tenantStaff}
/>
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useTenantStaff.tsx` | Create | Fetch all staff for tenant |
| `src/hooks/useStaffAppointments.tsx` | Modify | Accept staffIds array, parallel fetch & merge |
| `src/components/Appointments/AppointmentFilters.tsx` | Modify | Add clinician multi-select (admin only) |
| `src/pages/Appointments.tsx` | Modify | Wire up admin staff filter |

---

## Data Flow Diagram

```text
Admin User Opens /staff/appointments
         │
         ▼
Appointments.tsx renders
         │
         ├─► useTenantStaff() → Fetches all org clinicians
         │                     (for filter dropdown)
         │
         ├─► isAdmin = true (from useAuth)
         │
         ▼
Admin selects clinicians in filter
  e.g., [Maya Butler, Katie Weidenkeller]
         │
         ▼
filters.staffIds = ['id-1', 'id-2']
         │
         ▼
useStaffAppointments({ staffIds: ['id-1', 'id-2'] })
         │
         ├─► Promise.all([
         │     rpc('get_staff_calendar_appointments', { p_staff_id: 'id-1' }),
         │     rpc('get_staff_calendar_appointments', { p_staff_id: 'id-2' })
         │   ])
         │
         ▼
Merge & dedupe results
         │
         ▼
Display combined appointment list
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Admin selects no clinicians | Show logged-in admin's own appointments (default behavior) |
| Admin selects themselves only | Single RPC call, no merging needed |
| Non-admin user | `staffIds` prop undefined, ignores multi-select entirely |
| Staff member has no appointments | RPC returns empty array, merged result just excludes them |
| Tenant has many staff (10+) | Multi-select handles scrolling; parallel RPCs are efficient |

---

## Testing Checklist

1. **Admin-Only Visibility**
   - [ ] Clinician multi-select appears only for admin users
   - [ ] Non-admins see standard filter UI without clinician selector

2. **Multi-Staff Selection**
   - [ ] Selecting 1 clinician shows only their appointments
   - [ ] Selecting multiple clinicians shows combined appointments
   - [ ] Clearing selection returns to logged-in user's appointments

3. **Filter Interactions**
   - [ ] Clinician filter works with status filter
   - [ ] Clinician filter works with client filter
   - [ ] Clinician filter works with date range filter
   - [ ] Filter badge count includes clinician selections

4. **Data Integrity**
   - [ ] No duplicate appointments when same appointment appears in multiple queries
   - [ ] Timezone formatting preserved for all staff members
   - [ ] Appointment details (client name, service, etc.) display correctly

5. **Performance**
   - [ ] Parallel fetches complete in reasonable time
   - [ ] UI remains responsive during multi-staff fetch

---

## Technical Notes

- No database changes required
- No new RPC functions needed
- Reuses existing `get_staff_calendar_appointments` with proven timezone handling
- Multi-select uses existing `cmdk` Command component pattern from the codebase
- Admin detection uses established `isAdmin` from auth context

