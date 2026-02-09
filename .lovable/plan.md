

# Fix Today's Appointments Status Filter

## Problem

The `todaysAppointments` memo in `useStaffAppointments.tsx` only filters by date, not by status. This causes cancelled appointments to appear in "Today's Appointments" on the dashboard.

## Change

**File: `src/hooks/useStaffAppointments.tsx`** (line ~350)

Add a status filter to the `todaysAppointments` memo so it only includes appointments with status `'scheduled'` or `'documented'`, matching the pattern already used by `upcomingAppointments` and `undocumentedAppointments` in the same file.

The filter changes from:

```typescript
return apptDate === today;
```

to:

```typescript
return apptDate === today && (appt.status === 'scheduled' || appt.status === 'documented');
```

One line, one file. No other changes needed.

