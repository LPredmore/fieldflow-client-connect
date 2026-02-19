
# Fix: Appointment Details — Show Preferred First Name + Legal Last Name

## What Is Currently Happening

The Client Information card in `AppointmentView` displays `appointment.client_name`, which maps to the `client_name` field from the `get_staff_calendar_appointments` RPC. That field contains the client's **preferred name only** — it is intentionally designed that way for calendar display (compact, familiar).

The RPC already returns a second field, `client_legal_name`, which contains **First (legal) + Last name**, built from `pat_name_f` and `pat_name_l`. This field is used in session notes (`ClientInfoSection.tsx`) for clinical documentation. It is already present on every appointment object in memory — the `AppointmentView` component simply does not reference it.

## What Needs to Change

The user wants to see the client's **preferred first name + last name** in the Appointment Details view. This is a hybrid: not the purely preferred name (`client_name`), and not the purely legal name (`client_legal_name`). It is `pat_name_preferred` (or `pat_name_f` if no preferred) + `pat_name_l`.

The RPC does not expose `pat_name_preferred` and `pat_name_l` as separate columns — it pre-computes `client_name` (preferred only) and `client_legal_name` (legal first + last). So the cleanest correct approach, without modifying the database or RPC, is:

**Display `client_legal_name` as the primary name**, and if `client_name` (preferred) differs from the legal first name, show it as a secondary line labeled "Preferred Name."

This is exactly the right clinical UX: the legal name is shown prominently for identification purposes, and the preferred name is shown beneath it so clinicians know what to call the client. This matches how clinical documentation works throughout the rest of the system.

## Files Changed

Only **one file** changes: `src/components/Appointments/AppointmentView.tsx`

### Change 1: Add `client_legal_name` to the `AppointmentData` interface

```typescript
// Joined data
client_name?: string;           // Preferred name
client_legal_name?: string;     // First (legal) + Last name
client_email?: string;
client_phone?: string;
```

### Change 2: Update the Client Information card rendering

Replace the single name line:

```tsx
<p className="font-medium">{appointment.client_name || 'Unknown Client'}</p>
```

With:

```tsx
<p className="font-medium">
  {appointment.client_legal_name || appointment.client_name || 'Unknown Client'}
</p>
{appointment.client_name && 
 appointment.client_legal_name && 
 appointment.client_name !== appointment.client_legal_name && (
  <p className="text-sm text-muted-foreground">
    Preferred: {appointment.client_name}
  </p>
)}
```

This means:
- If the client has a legal name available (which all appointments from `useStaffAppointments` will), it shows that.
- If the preferred name differs from the legal name, it shows a secondary "Preferred:" line.
- If no legal name is available (e.g. edge case from a different data source), it falls back to `client_name`, then `'Unknown Client'`.

## Why This Is the Right Decision

The alternative — modifying the RPC to return `pat_name_preferred` and `pat_name_l` separately and concatenating them on the client — would require a database function change and would break the constraint that the code must always adapt to the database, not the other way around.

Using `client_legal_name` (already returned by the RPC, already in the appointment object, already used in session notes for the same purpose) is the correct approach. It is consistent with how the rest of the clinical system uses names, requires zero database changes, and requires zero changes to any hook or data-fetching layer.

The "Preferred:" secondary label is standard clinical practice and matches the intent of having both name fields in the system in the first place.
