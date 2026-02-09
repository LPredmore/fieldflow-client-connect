

# Fix Recurring Appointment Occurrence Generation

## What's broken

Two independent bugs prevent recurring appointments from generating individual occurrences:

1. **The edge function was never registered in `config.toml`**, so Lovable has never deployed the current code. The version running on Supabase is stale and incorrectly reports "Series is inactive" even when `is_active` is `true`.

2. **The edge function's insert payload is missing `updated_at`**, which is a `NOT NULL` column with no server-side default. Even after redeployment, every insert would fail silently (the error is caught and counted as "skipped").

Additionally, there is a minor inconsistency: after creating an appointment, the form resets `is_telehealth` to `false` instead of `true`, contradicting the new default.

## What changes

### 1. `supabase/config.toml` -- Register the edge function

Add:

```toml
[functions.generate-appointment-occurrences]
verify_jwt = false
```

This triggers Lovable's automatic deployment, syncing the repository code to Supabase. `verify_jwt = false` is correct because the function creates its own service-role client internally and is only called programmatically from authenticated frontend code.

### 2. `supabase/functions/generate-appointment-occurrences/index.ts` -- Add missing timestamps

Add `created_at` and `updated_at` to the `appointmentData` object (after `created_by_profile_id`), mirroring the single-appointment pattern in `useAppointmentCreation`:

```
created_at: new Date().toISOString(),
updated_at: new Date().toISOString(),
```

### 3. `src/components/Appointments/CreateAppointmentDialog.tsx` -- Fix telehealth reset

In the form reset block (line 136), change `is_telehealth: false` to `is_telehealth: true` so reopening the dialog after a submission still defaults to telehealth on.

## What does NOT change

- No database modifications
- No new dependencies
- No changes to timezone logic, series creation, or the RRule generation algorithm
- No changes to the calendar refresh architecture

## Risk assessment

- **Zero risk to single appointments**: the `useAppointmentCreation` hook is untouched.
- **Zero risk to existing data**: the edge function uses `upsert` with `ignoreDuplicates: true`, so rerunning it against existing series won't create duplicates.
- **Telehealth reset fix** is cosmetic UX -- no downstream impact.

