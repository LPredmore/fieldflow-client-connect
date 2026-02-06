

## Implementation Plan: Searchable, Scrollable Client Dropdown

### Problem Summary

The "Create New Appointment" dialog uses a basic `Select` component for client selection that:
- Has no search functionality
- Cannot scroll (CSS viewport height is locked to trigger height)
- Forces users to manually scan a potentially long list

### The Right Technical Decision

**Replace the raw `Select` in `CreateAppointmentDialog.tsx` with the existing `ClientSelector` component.**

This is the correct approach because:

1. **Reuse over duplication**: `ClientSelector` already exists and is used successfully in `AppointmentForm.tsx`. Creating a new component or modifying the base `Select` component would violate DRY principles.

2. **`ClientSelector` uses the correct architecture**: It's built on `cmdk` (Command) + Popover, which is the industry-standard pattern for searchable dropdowns (used by VS Code, Linear, Notion, etc.). This provides:
   - Built-in fuzzy search via `CommandInput`
   - Keyboard navigation
   - Accessible ARIA patterns

3. **One bug to fix first**: The current `ClientSelector` is missing a `CommandList` wrapper around its items. The `CommandList` component provides `max-h-[300px] overflow-y-auto` which enables scrolling. Without it, the list height is unconstrained inside the popover.

### Implementation Steps

**Step 1: Fix the `ClientSelector` scrolling bug**

File: `src/components/Clients/ClientSelector.tsx`

Current structure (broken):
```
<Command>
  <CommandInput />
  <CommandEmpty />
  <CommandGroup>
    {items...}
  </CommandGroup>
</Command>
```

Correct structure:
```
<Command>
  <CommandInput />
  <CommandList>          <-- ADD THIS WRAPPER
    <CommandEmpty />
    <CommandGroup>
      {items...}
    </CommandGroup>
  </CommandList>         <-- CLOSE HERE
</Command>
```

The `CommandList` component (line 57-66 of command.tsx) provides the scrolling container with `max-h-[300px] overflow-y-auto`.

**Step 2: Replace Select with ClientSelector in CreateAppointmentDialog**

File: `src/components/Appointments/CreateAppointmentDialog.tsx`

Changes required:
1. Import `ClientSelector` from `@/components/Clients/ClientSelector`
2. Replace the client `Select` block (lines 198-220) with:
```tsx
<div>
  <Label htmlFor="client">Client *</Label>
  <ClientSelector
    value={formData.client_id}
    onValueChange={(clientId) => 
      setFormData(prev => ({ ...prev, client_id: clientId }))
    }
  />
  {(!clients || clients.length === 0) && (
    <p className="text-sm text-muted-foreground mt-1">
      No clients assigned to you. Please add clients first.
    </p>
  )}
</div>
```
3. Remove the now-unused `useClients` import and `clients` variable (since `ClientSelector` manages its own data fetching internally)
4. Remove the `getClientDisplayName` import (no longer needed in this file)

### Why Not Other Approaches?

| Alternative | Why Not |
|-------------|---------|
| Fix the `Select` component globally | Would change behavior for all dropdowns in the app, including ones where search isn't needed (duration, status). Adds complexity to simple use cases. |
| Create a new `SearchableClientSelect` | Duplicates existing `ClientSelector` functionality. More code to maintain. |
| Add inline scroll CSS to `SelectContent` | Fixes scrolling but doesn't add search. Users with 20+ clients still can't find people quickly. |

### Files Changed

| File | Change |
|------|--------|
| `src/components/Clients/ClientSelector.tsx` | Add `CommandList` wrapper for scrolling |
| `src/components/Appointments/CreateAppointmentDialog.tsx` | Replace `Select` with `ClientSelector`, remove unused imports |

### Technical Notes

- The `ClientSelector` callback provides both `clientId` and `clientName`, but `CreateAppointmentDialog` only needs `clientId`. The second parameter can be ignored.
- `ClientSelector` internally calls `useClients()` with default filtering (clinician's assigned clients only), which matches the current behavior.
- No database or API changes required.

