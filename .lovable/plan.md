

# Add "Accept International Clients" Toggle

A simple, low-risk addition: one new database column and a UI toggle on the profile page.

---

## What Changes

### 1. Database Migration (Additive Only)

Add a single column to the existing `staff` table:

```
ALTER TABLE public.staff
ADD COLUMN intl boolean NOT NULL DEFAULT false;
```

- Defaults to `false` (off) for all existing staff
- No impact on any existing queries -- they simply ignore columns they don't select
- No foreign keys, no constraints beyond the default

### 2. Profile Page UI

On the "Client Facing Information" section of the Profile page, the current layout has a 2-column grid with "Minimum Client Age" and "Accepting New Clients". 

Updated layout becomes a **3-column grid** on medium+ screens:

| Minimum Client Age | Accepting New Clients | Accept International Clients |
|---|---|---|
| Number input | Toggle (Yes/No) | Toggle (Yes/No, defaults OFF) |

The new toggle:
- Label: "Accept International Clients"
- Subtitle shows "Yes" or "No"
- Defaults to OFF (false)
- No profile-completion dependency (unlike "Accepting New Clients", this toggle has no gating logic)
- Saves alongside the existing client info fields

### 3. Code Changes

**Files modified:**

- **`src/pages/Profile.tsx`**
  - Add `intl` to the `clientInfo` state (default `false`)
  - Load from staff data on mount
  - Include in the save/update payload
  - Add the Switch toggle UI in the grid (change grid to `md:grid-cols-3`)

- **`src/hooks/useStaffData.tsx`**
  - Add `intl?: boolean | null` to the `StaffMember` interface
  - Add `intl?: boolean` to the `StaffUpdateData` interface

- **`src/hooks/useStaffProfile.tsx`**
  - Add `intl?: boolean | null` to the `StaffProfile` interface

- **`src/components/Settings/UserManagement/ProfessionalSettings.tsx`**
  - Optionally add the toggle here too for admin management of staff

- **`src/schema/tables/staff-provider.ts`**
  - Add `intl` to the schema definition for documentation consistency

---

## Safety

- **One additive column** with a default value -- zero risk to existing queries
- **No existing columns modified**
- **No existing logic changed** -- the toggle is independent of the "Accepting New Clients" validation system
- **Fully reversible** -- drop the column and remove the UI code to undo

