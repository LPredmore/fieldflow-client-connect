

# Delete Duplicate Scheduled Appointments

## Summary
Remove two duplicate `scheduled` appointments that overlap with the newly imported `documented` versions from the old EHR system.

## Appointments to Delete

| Client | Date | Appointment ID | Status (to remove) |
|---|---|---|---|
| Julia Koesters | 2026-02-04 | `bf651875-9df9-492f-9737-26bb23fb73f5` | scheduled |
| Dylan Quintana | 2026-02-06 | `ff360fc0-ccee-4190-894f-aa9ee19ac1ea` | scheduled |

The `documented` versions we imported will be kept.

## Technical Details

Since appointments in this system are soft-deleted (marked as `cancelled` rather than physically removed), we will use a `DELETE` statement to fully remove these duplicates. These were auto-generated scheduled placeholders, not real clinical records, so a hard delete is appropriate to avoid clutter.

SQL to execute:

```sql
DELETE FROM appointments
WHERE id IN (
  'bf651875-9df9-492f-9737-26bb23fb73f5',
  'ff360fc0-ccee-4190-894f-aa9ee19ac1ea'
);
```

If you prefer soft-delete (marking as cancelled) instead of hard delete, the alternative would be:

```sql
UPDATE appointments
SET status = 'cancelled', updated_at = NOW()
WHERE id IN (
  'bf651875-9df9-492f-9737-26bb23fb73f5',
  'ff360fc0-ccee-4190-894f-aa9ee19ac1ea'
);
```

Both options will be available -- recommend hard delete since these are redundant placeholders with no clinical notes attached.

