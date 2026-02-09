

# Remove RoleIndicator Component

## What's Being Removed

The "Contractor View / Limited Access" and "Admin View / Full Access" badge that appears in the top-right of the Dashboard and Appointments pages.

## Changes

| File | Change |
|---|---|
| `src/pages/Index.tsx` | Remove `RoleIndicator` import and usage (lines 4, 132) |
| `src/pages/Appointments.tsx` | Remove `RoleIndicator` import and usage (lines 3, 211) |
| `src/components/Layout/RoleIndicator.tsx` | Delete the file entirely |

No database, permission, or routing changes. This is purely cosmetic cleanup.

