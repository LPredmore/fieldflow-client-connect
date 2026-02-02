
# Implementation Plan: Fix Client Statistics Cards

## Problem Summary

The client stats cards on `/staff/clients` and `/staff/allclients` display incorrect counts because the current logic in `useClients.tsx` uses:

| Stat | Current Logic | Correct Logic |
|------|---------------|---------------|
| **Active** | `pat_status === 'Active'` | `pat_status IN ('Scheduled', 'Early Sessions', 'Established')` |
| **New** | Clients without treatment plans | `pat_status === 'Unscheduled'` |
| **Total** | `clientList.length` | Correct (no change needed) |

### Database Reality

```text
Total clients: 585

Current "Active" count: 0 (no clients have pat_status = 'Active')
Correct "Active" count: 9 (Scheduled + Early Sessions + Established)

Current "New" count: Based on treatment plan absence (arbitrary)
Correct "New" count: 12 (Unscheduled)
```

---

## Technical Decision

**Modify `useClients.tsx` stats calculation to use the correct `pat_status` values directly, and remove the unnecessary `client_treatment_plans` query.**

### Why This Is the Right Approach

1. **Single Source of Truth**: The `pat_status` field already represents the client's workflow stage. The current treatment-plan-based logic was an incorrect workaround that doesn't align with actual business semantics.

2. **Eliminates Unnecessary Query**: The hook currently makes a second query to `client_treatment_plans` just to calculate "New" clients. This query is not needed when we use `pat_status` correctly, reducing database load and complexity.

3. **Consistent with Filter UI**: The `AllClients.tsx` page already defines status groups in `STATUS_GROUPS` (lines 29-70) that match the database enum. The stats should align with these filter categories.

4. **No Database Changes**: Uses existing `pat_status` column values. The database already has all 21 enum values (confirmed in `types.ts` lines 6162-6182).

5. **Schema File Cleanup**: The `src/schema/enums.ts` file has an outdated `pat_status_enum` that needs updating for consistency (documentation purposes only - doesn't affect runtime).

---

## Implementation Details

### 1. Modify `useClients.tsx`

**File: `src/hooks/useClients.tsx`**

**Changes:**
1. Remove the `client_treatment_plans` query (lines 80-88)
2. Remove `treatmentPlansLoading` from loading state (line 190)
3. Update stats calculation to use correct `pat_status` values

```text
BEFORE (lines 91-105):
  const stats = useMemo(() => {
    const clientList = clients || [];
    const clientsWithPlans = new Set(
      (treatmentPlans || []).map(tp => tp.client_id)
    );
    return {
      total: clientList.length,
      active: clientList.filter(c => c.pat_status === 'Active').length,
      new: clientList.filter(c => !clientsWithPlans.has(c.id)).length,
    };
  }, [clients, treatmentPlans]);

AFTER:
  const stats = useMemo(() => {
    const clientList = clients || [];
    
    // Active = clients in active treatment stages
    const ACTIVE_STATUSES = ['Scheduled', 'Early Sessions', 'Established'];
    
    // New = clients awaiting first appointment
    const NEW_STATUS = 'Unscheduled';
    
    return {
      total: clientList.length,
      active: clientList.filter(c => 
        ACTIVE_STATUSES.includes(c.pat_status || '')
      ).length,
      new: clientList.filter(c => 
        c.pat_status === NEW_STATUS
      ).length,
    };
  }, [clients]);
```

### 2. Update `src/schema/enums.ts`

**File: `src/schema/enums.ts`**

Update `pat_status_enum` to match the actual database enum values (for documentation accuracy).

```text
BEFORE (line 36):
  pat_status_enum: ['New', 'Active'] as const,

AFTER:
  pat_status_enum: [
    'Interested',
    'New',
    'Active',
    'Inactive',
    'Registered',
    'Waitlist',
    'Matching',
    'Unscheduled',
    'Scheduled',
    'Early Sessions',
    'Established',
    'Not the Right Time',
    'Found Somewhere Else',
    'Went Dark (Previously Seen)',
    'Blacklisted',
    'Unresponsive - Warm',
    'Unresponsive - Cold',
    'Manual Check',
    'No Insurance',
    'DNC',
  ] as const,
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useClients.tsx` | **Modify** | Fix stats calculation, remove unused treatment plans query |
| `src/schema/enums.ts` | **Modify** | Update `pat_status_enum` to match actual database values |

---

## Data Flow After Fix

```text
useClients() called
         │
         ▼
Query: clients table with staff filter
  (No longer queries client_treatment_plans)
         │
         ▼
Stats calculation:
  total: clientList.length
  active: filter where pat_status IN 
          ('Scheduled', 'Early Sessions', 'Established')
  new: filter where pat_status = 'Unscheduled'
         │
         ▼
ClientStatsCards displays correct counts:
  Total: 585 (or filtered count for clinician view)
  Active: 9
  New: 12
```

---

## What This Does NOT Change

- **`ClientStatsCards.tsx`**: No changes needed - it already correctly receives and displays the stats object
- **`AllClients.tsx` / `Clients.tsx`**: No changes needed - they already correctly pass stats to the component
- **Database schema**: No changes (immutable constraint respected)
- **Filter functionality**: The status filter dropdown already uses the correct status values

---

## Testing Checklist

1. **Stats Accuracy**
   - [ ] "Active Clients" shows 9 (matching Scheduled + Early Sessions + Established)
   - [ ] "New Clients" shows 12 (matching Unscheduled status)
   - [ ] "Total Clients" shows correct count (585 for all, filtered for clinician)

2. **Page Functionality**
   - [ ] `/staff/clients` shows stats filtered to logged-in clinician's assigned clients
   - [ ] `/staff/allclients` shows stats for all tenant clients

3. **Performance**
   - [ ] No additional queries to `client_treatment_plans` table
   - [ ] Page loads with single clients query

---

## Status Definitions Reference

For clarity, here's the business meaning of the status categories:

| Category | Statuses | Meaning |
|----------|----------|---------|
| **New (Needs Scheduling)** | `Unscheduled` | Client intake complete, awaiting first appointment |
| **Active (In Treatment)** | `Scheduled`, `Early Sessions`, `Established` | Client actively receiving care |
| **Intake Pipeline** | `Interested`, `New`, `Registered`, `Waitlist`, `Matching` | Pre-intake stages |
| **Inactive** | `Inactive`, `Not the Right Time`, `Found Somewhere Else`, etc. | No longer in active care |
