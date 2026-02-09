

# Fix Treatment Plan Refresh After Save

## Problem

When a treatment plan is created or updated via `TreatmentPlanDialog`, the Clinical tab on the client detail page does not refresh to show the new/updated plan. This happens because `TreatmentPlanDialog` and `useClientDetail` each instantiate their own separate `useSupabaseQuery` for the `client_treatment_plans` table. When the dialog saves and calls its internal `refetch()`, only the dialog's local data updates -- the parent page's data is untouched.

## Technical Decision

Add an `onSaved` callback prop to `TreatmentPlanDialog`. When the dialog successfully creates or updates a plan, it calls `onSaved()` before closing. `useClientDetail` will expose a `refetchClinical()` function, and `ClientDetail.tsx` will wire it into the dialog's `onSaved` prop.

This is the correct approach because:

- It follows the existing callback pattern already used throughout this codebase (e.g., `onDocumentClick`, `onCancelAssignment`).
- It keeps `TreatmentPlanDialog` as a self-contained component with no knowledge of its parent's data layer.
- It avoids global state or shared query keys, which would couple unrelated components.
- `useSupabaseQuery` already returns a `refetch` function on every instance, so no changes to the data layer are needed.

## Changes

### 1. `src/hooks/useClientDetail.tsx`

- Destructure `refetch` from the treatment plans `useSupabaseQuery` call (line ~308).
- Expose it from the hook's return object as `refetchTreatmentPlans`.

### 2. `src/components/Clinical/TreatmentPlanDialog.tsx`

- Add an optional `onSaved?: () => void` prop to `TreatmentPlanDialogProps`.
- In `onSubmit`, call `onSaved?.()` after a successful create or update, right before `onOpenChange(false)`.

### 3. `src/pages/ClientDetail.tsx`

- Destructure `refetchTreatmentPlans` from `useClientDetail`.
- Pass `onSaved={refetchTreatmentPlans}` to the `TreatmentPlanDialog` component.

## What Does NOT Change

- No database changes.
- No changes to `useTreatmentPlans.tsx` (the dialog's internal hook).
- No changes to `useSupabaseQuery` or the data layer.
- No changes to `ClientClinicalTab` -- it already reactively renders from `currentTreatmentPlan` passed as a prop.

## Sequence

```text
User clicks "Save" in TreatmentPlanDialog
  -> onSubmit runs createPlan/updatePlan (dialog's own hook)
  -> onSaved() fires (new callback)
     -> ClientDetail calls refetchTreatmentPlans()
        -> useClientDetail's useSupabaseQuery re-fetches client_treatment_plans
        -> currentTreatmentPlan updates
        -> ClientClinicalTab re-renders with new data
  -> onOpenChange(false) closes the dialog
```

