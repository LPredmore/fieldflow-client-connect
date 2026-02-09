

# Fix Treatment Plan Dialog Population and Add "Create New Plan" Button

## Problem

Two issues:

1. **Fields don't populate when editing**: `ClientDetail.tsx` opens `TreatmentPlanDialog` without passing the `existingPlan` prop. The dialog already accepts this prop and has logic to populate form fields from it, but it's never wired up.
2. **No way to create a new versioned plan**: Once a plan exists, the only button says "View/Edit." The versioning system (`plan_version`, `supersedes_plan_id`) exists in the database and hook, but there's no UI to trigger it.

## Technical Decision

Solve both with a single state variable pattern: replace the boolean `isTreatmentPlanOpen` with a mode enum that tells the dialog whether it's editing the existing plan or creating a new one.

This is the right approach because:

- It avoids adding a second dialog instance or a second boolean state.
- The dialog already handles both create and edit paths based on whether `existingPlan` is provided.
- It keeps `ClientClinicalTab` as a pure presentational component -- it fires callbacks, the parent decides what to do.

## Changes

### 1. `src/pages/ClientDetail.tsx`

- Replace `const [isTreatmentPlanOpen, setIsTreatmentPlanOpen] = useState(false)` with `const [treatmentPlanMode, setTreatmentPlanMode] = useState<'closed' | 'edit' | 'create'>('closed')`.
- Update `handleViewTreatmentPlan` to set mode to `'edit'`.
- Add `handleCreateNewTreatmentPlan` that sets mode to `'create'`.
- Pass `existingPlan={treatmentPlanMode === 'edit' ? currentTreatmentPlan : null}` to `TreatmentPlanDialog`.
- Pass `open={treatmentPlanMode !== 'closed'}` and `onOpenChange` that resets to `'closed'`.
- Pass `onCreateNewPlan={handleCreateNewTreatmentPlan}` to `ClientClinicalTab`.

### 2. `src/components/Clients/ClientDetail/ClientClinicalTab.tsx`

- Add `onCreateNewPlan?: () => void` to props.
- When a treatment plan exists, render two buttons in the card header:
  - "View/Edit" (existing behavior, calls `onViewTreatmentPlan`)
  - "New Plan" (calls `onCreateNewPlan`), shown only when `currentTreatmentPlan` exists and `onCreateNewPlan` is provided.

### 3. No changes to `TreatmentPlanDialog.tsx`

The dialog already handles both paths correctly:
- When `existingPlan` is provided: it populates form fields and calls `updatePlan`.
- When `existingPlan` is null/undefined: it shows empty fields and calls `createPlan` (which handles deactivating the old plan and incrementing the version).

## Technical Details

### State mapping in `ClientDetail.tsx`

```text
treatmentPlanMode === 'closed'  -->  dialog not rendered (open=false)
treatmentPlanMode === 'edit'    -->  dialog open, existingPlan = currentTreatmentPlan
treatmentPlanMode === 'create'  -->  dialog open, existingPlan = null (empty form, new version)
```

### Button layout in `ClientClinicalTab.tsx` card header

```text
When no plan exists:    [Create]
When plan exists:       [View/Edit]  [New Plan]
```

## What Does NOT Change

- No database changes.
- No changes to `TreatmentPlanDialog.tsx` (it already handles both modes).
- No changes to `useTreatmentPlans.tsx` (versioning logic already works).
- No changes to `useClientDetail.tsx`.
- The `onSaved` callback wiring from the previous fix remains intact.

