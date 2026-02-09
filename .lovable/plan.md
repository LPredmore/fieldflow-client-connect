

# Fix Appointment Creation: Add Timestamps

## Problem

Single appointment creation fails because the `created_at` and `updated_at` fields are NOT NULL but aren't included in the insert payload. The database has no default for these columns on INSERT.

## Fix

Add `created_at` and `updated_at` (both set to `new Date().toISOString()`) to the insert payload in `useAppointmentCreation.tsx`.

## Technical Details

| File | Change |
|---|---|
| `src/hooks/useAppointmentCreation.tsx` | Add `created_at: new Date().toISOString()` and `updated_at: new Date().toISOString()` to the `appointmentData` object (around line 104) |

One file, two lines added. No database changes.

