
# Client Filtering Implementation Plan

## Executive Summary

Add filtering capabilities to the `/staff/allclients` page to allow administrators to narrow down client lists by assigned staff member and client status. This will use the existing component patterns in the codebase and perform client-side filtering on already-fetched data.

---

## Technical Decision: Client-Side Filtering

**Decision:** Implement client-side filtering on the already-fetched client data, rather than modifying the `useClients` hook or adding server-side filtering.

**Rationale:**

1. **Data is already loaded**: The `useClients` hook with `allTenantClients: true` already fetches all clients for the tenant. Adding filters would not reduce the initial data load.

2. **Simplicity**: Client-side filtering with `useMemo` is the pattern already established in both `Clients.tsx` and `AllClients.tsx` for search filtering. Extending this pattern keeps the code consistent.

3. **Performance is adequate**: For the expected client counts (hundreds, not thousands), client-side filtering is instant. If dataset size grows significantly, server-side filtering can be added later as an optimization.

4. **Staff list is small**: The staff dropdown options will be derived from a separate query (matching the pattern in `ContractorSelector.tsx`), which is a small dataset.

5. **Avoids hook complexity**: The `useClients` hook is already complex with multiple queries (clients + treatment plans). Adding filter parameters would increase complexity and create more re-render scenarios.

---

## Database Schema Reference

The `pat_status` field uses the `pat_status_enum` with these values:

| Status Category | Values |
|-----------------|--------|
| **Intake Pipeline** | Interested, New, Registered, Waitlist, Matching |
| **Active Treatment** | Unscheduled, Scheduled, Early Sessions, Established, Active |
| **Inactive/Churned** | Inactive, Not the Right Time, Found Somewhere Else, Went Dark (Previously Seen) |
| **Blocked/Problem** | Unresponsive - Warm, Unresponsive - Cold, Manual Check, No Insurance, DNC, Blacklisted |

These will be grouped in the dropdown for usability.

---

## Implementation Details

### 1. New State Variables

Add two filter state variables to `AllClients.tsx`:

```typescript
const [statusFilter, setStatusFilter] = useState<string>("all");
const [staffFilter, setStaffFilter] = useState<string>("all");
```

### 2. Fetch Staff for Dropdown

Add a query to fetch staff members for the filter dropdown. This follows the same pattern as `ContractorSelector.tsx`:

```typescript
const { data: staffList } = useSupabaseQuery<{
  id: string;
  prov_name_f: string | null;
  prov_name_l: string | null;
}>({
  table: 'staff',
  select: 'id, prov_name_f, prov_name_l',
  filters: { tenant_id: 'auto' },
  enabled: !!tenantId,
  orderBy: { column: 'prov_name_l', ascending: true }
});
```

### 3. Status Options Constant

Define status options with logical grouping using `SelectGroup` and `SelectLabel`:

```typescript
const STATUS_GROUPS = [
  {
    label: "Intake Pipeline",
    options: [
      { value: "Interested", label: "Interested" },
      { value: "New", label: "New" },
      { value: "Registered", label: "Registered" },
      { value: "Waitlist", label: "Waitlist" },
      { value: "Matching", label: "Matching" },
    ]
  },
  {
    label: "Active Treatment",
    options: [
      { value: "Active", label: "Active" },
      { value: "Unscheduled", label: "Unscheduled" },
      { value: "Scheduled", label: "Scheduled" },
      { value: "Early Sessions", label: "Early Sessions" },
      { value: "Established", label: "Established" },
    ]
  },
  {
    label: "Inactive",
    options: [
      { value: "Inactive", label: "Inactive" },
      { value: "Not the Right Time", label: "Not the Right Time" },
      { value: "Found Somewhere Else", label: "Found Somewhere Else" },
      { value: "Went Dark (Previously Seen)", label: "Went Dark" },
    ]
  },
  {
    label: "Needs Attention",
    options: [
      { value: "Unresponsive - Warm", label: "Unresponsive (Warm)" },
      { value: "Unresponsive - Cold", label: "Unresponsive (Cold)" },
      { value: "Manual Check", label: "Manual Check" },
      { value: "No Insurance", label: "No Insurance" },
      { value: "DNC", label: "Do Not Contact" },
      { value: "Blacklisted", label: "Blacklisted" },
    ]
  }
];
```

### 4. Extended Filtering Logic

Update the `filteredClients` useMemo to include filter conditions:

```typescript
const filteredClients = useMemo(() => {
  let filtered = clients;

  // Status filter
  if (statusFilter !== "all") {
    filtered = filtered?.filter(client => client.pat_status === statusFilter);
  }

  // Staff filter
  if (staffFilter === "unassigned") {
    filtered = filtered?.filter(client => !client.primary_staff_id);
  } else if (staffFilter !== "all") {
    filtered = filtered?.filter(client => client.primary_staff_id === staffFilter);
  }

  // Existing search filter
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    filtered = filtered?.filter(client =>
      getClientDisplayName(client).toLowerCase().includes(searchLower) ||
      client.email?.toLowerCase().includes(searchLower) ||
      client.phone?.toLowerCase().includes(searchLower) ||
      client.assigned_staff_name?.toLowerCase().includes(searchLower)
    );
  }

  return filtered;
}, [clients, searchTerm, statusFilter, staffFilter]);
```

### 5. Filter UI Components

Add filter dropdowns below the search bar:

```text
Layout:
┌─────────────────────────────────────────────────────────────┐
│ [🔍 Search clients or assigned staff...                   ] │
│ [Status: All ▼]  [Assigned Staff: All ▼]  [✕ Clear]        │
└─────────────────────────────────────────────────────────────┘
```

The "Clear Filters" button only appears when filters are active.

### 6. Updated Empty State

The empty state message will account for active filters:

```typescript
<p className="mt-2 text-sm text-muted-foreground">
  {(searchTerm || statusFilter !== "all" || staffFilter !== "all")
    ? "Try adjusting your search or filters"
    : "No clients exist in this organization yet"}
</p>
```

### 7. Active Filter Count Badge (Optional Enhancement)

Show a badge on the filter area indicating how many filters are active, making it clear when results are filtered.

---

## New Imports Required

```typescript
import { 
  Select, 
  SelectContent, 
  SelectGroup,
  SelectItem, 
  SelectLabel,
  SelectSeparator,
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { X, Filter } from "lucide-react";
import { useSupabaseQuery } from "@/hooks/data/useSupabaseQuery";
```

---

## File Changes Summary

| File | Type | Description |
|------|------|-------------|
| `src/pages/AllClients.tsx` | Modify | Add filter state, staff query, filter logic, and filter UI |

This is a single-file change that extends the existing filtering pattern already in use.

---

## Why Not Other Approaches

| Alternative | Why Not |
|-------------|---------|
| **Server-side filtering** | Overkill for current data volumes; adds complexity to hook and requires backend changes |
| **URL query parameters** | Nice for shareability but adds routing complexity; can be added later if needed |
| **Separate filter component** | Over-engineering for two dropdowns; would require prop drilling or context |
| **Modify useClients hook** | Hook is shared with clinician view; adding admin-only filter params complicates it |

---

## Testing Checklist

After implementation:

1. Verify "All" shows complete client list
2. Test each status filter shows only clients with that status
3. Test "Unassigned" filter shows clients with null `primary_staff_id`
4. Test specific staff filter shows only their assigned clients
5. Verify search works in combination with filters (AND logic)
6. Confirm "Clear Filters" resets both dropdowns
7. Check empty state message updates appropriately
8. Verify filters persist when switching pages and coming back (or reset as expected)

---

## Future Enhancements (Not in This PR)

- URL-based filter persistence for shareability
- Additional filters: state/location, date range, insurance status
- Saved filter presets
- Export filtered results to CSV
