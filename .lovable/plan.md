

# Make Treatment Plan Optional for Session Notes

## The Problem

The system currently blocks clinicians from documenting a session note unless the client has an active treatment plan. This is enforced purely in the frontend -- the database allows all treatment plan fields to be null. In clinical practice, there are legitimate scenarios where a session note must be written without a treatment plan (e.g., intake sessions, crisis interventions, initial evaluations).

## The Right Technical Decision

**Make the treatment plan an optional enhancement, not a gate.** When a plan exists, snapshot it into the note as it does today. When it does not exist, skip the snapshot and let the clinician complete the rest of the note normally.

This is the correct decision because:
- The database already supports it (all treatment plan columns are nullable)
- A session note is fundamentally a record of what happened in a session -- the MSE, risk assessment, narrative, and billing are the core. Treatment objectives are supplementary context.
- Blocking documentation creates compliance risk: undocumented sessions are worse than sessions documented without a plan reference.

## What Changes (6 files, no database changes)

### 1. `SessionDocumentationDialog.tsx` -- Remove the gate

The `session_options` phase currently branches on `activePlan`: if present, show "Complete Session Note"; if absent, show a warning and disable the button. 

**Change**: Always show the "Complete Session Note" button. When no plan exists, show an informational note (not a blocking warning) that says treatment plan data will not be included. Remove the disabled state from the button.

### 2. `Index.tsx` -- Remove the render guard

Line 225 currently requires all three conditions to render `SessionNoteDialog`:
```
{selectedAppointment && activePlan && staffId && (
```

**Change**: Remove `activePlan` from this condition. Pass `activePlan` as `activePlan | null` instead of requiring it.

### 3. `SessionNoteDialog.tsx` -- Make `activePlan` optional

- Change the prop type from `activePlan: TreatmentPlan` to `activePlan: TreatmentPlan | null`
- Conditionally render `TreatmentObjectivesSection` only when `activePlan` is not null
- Conditionally render plan metadata in `PlanSection` only when `activePlan` is not null
- When calling `createSessionNote`, pass `activePlan` as potentially null

### 4. `useSessionNote.tsx` -- Accept null plan

- Change the `activePlan` parameter type from `TreatmentPlan` to `TreatmentPlan | null`
- When `activePlan` is null, set all `client_treatmentplan_*`, `client_problem`, `client_treatmentgoal`, `client_*objective`, and `client_intervention*` fields to null in the insert
- Everything else (MSE, risk assessment, narrative, billing, appointment status update) works exactly as before

### 5. `TreatmentObjectivesSection.tsx` -- No structural change needed

This component already receives `activePlan` as a required prop and is only rendered by `SessionNoteDialog`. Since we will conditionally render it (step 3), no changes are needed to this component itself.

### 6. `PlanSection.tsx` -- Make `activePlan` optional

- Change prop type to `activePlan: TreatmentPlan | null`
- When null, hide the "Next Treatment Plan Update" read-only field (or show "N/A")
- The private notes portion of this component remains unchanged

## What Does NOT Change

- **No database changes** -- all treatment plan columns are already nullable
- **No changes to the view/print dialogs** -- `SessionNoteViewDialog` and `SessionNotePrintView` already use conditional rendering (`{note.client_primaryobjective && ...}`), so notes without plan data will simply omit those sections gracefully
- **No changes to `useTreatmentPlans`** -- the hook continues to return `activePlan` which may be null
- **No changes to the treatment plan feature itself** -- creating, editing, and versioning plans works exactly as before
- **AI Assist** -- continues to work because it depends on `selectedInterventions` and `client_sessionnarrative`, not on the plan's existence. When no plan is present, the interventions section is hidden, so AI Assist simply won't have interventions to select (clinicians use the manual narrative path)

## Downstream Safety

- **Saved notes without plan data**: Already handled. The view dialog, print view, and batch print all use conditional rendering on every treatment plan field. A note with null plan fields will render without those sections -- no crashes, no blank sections.
- **Billing**: Completely independent of treatment plans. CPT codes, charges, and date fields are derived from the appointment and the billing section, not the plan.
- **Future notes for the same client**: When a plan is later created, subsequent session notes will snapshot it normally. Earlier notes remain unchanged with null plan fields.

