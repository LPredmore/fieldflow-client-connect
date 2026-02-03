

# Implementation Plan: Profile Completion Validation & Status Activation

## Overview

This plan implements a comprehensive profile completion validation system that:
1. Prevents staff from enabling "Accepting New Clients" until all required fields are complete
2. Automatically sets staff status to "Active" when they enable the toggle
3. Warns users when removing required data would disable their "Accepting New Clients" status
4. Provides clear feedback on which fields are missing

---

## Technical Architecture

### Key Design Decisions

**Why client-side validation with server-side status update:**
- Profile fields are spread across multiple save sections (Personal, Credentials, Client-Facing)
- Real-time validation gives immediate feedback without server round-trips
- Status change (`prov_status` = 'Active') is a privileged operation that should only happen when the toggle is actually turned on and saved

**Why NOT a database trigger:**
- Triggers can't easily validate across tables (staff + staff_licenses)
- Client-side validation provides better UX with immediate feedback
- The toggle action is the deliberate user intent we want to capture

**Required Fields (per your specifications):**

| Section | Field | Database Column | Required |
|---------|-------|-----------------|----------|
| Personal Information | First Name | `prov_name_f` | Yes |
| Personal Information | Last Name | `prov_name_l` | Yes |
| Personal Information | Phone | `prov_phone` | Yes |
| Personal Information | Address Line 1 | `prov_addr_1` | Yes |
| Personal Information | City | `prov_city` | Yes |
| Personal Information | State | `prov_state` | Yes |
| Personal Information | ZIP | `prov_zip` | Yes |
| Personal Information | Time Zone | `prov_time_zone` | Yes |
| Licensing & Credentials | Specialty | `prov_field` | Yes |
| Licensing & Credentials | Highest Degree | `prov_degree` | Yes |
| Licensing & Credentials | Taxonomy Code | `prov_taxonomy` | Yes |
| Licensing & Credentials | At Least 1 License | `staff_licenses` table | Yes |
| Client Facing | Profile Image | `prov_image_url` | Yes |
| Client Facing | Display Name | `prov_name_for_clients` | Yes |
| Client Facing | Bio | `prov_bio` | Yes |
| Client Facing | Min Client Age | `prov_min_client_age` | Yes (has default) |

**NOT Required:** NPI Number, Treatment Approaches

---

## Implementation Details

### Part 1: Create Profile Completion Hook

**New File: `src/hooks/useProfileCompletion.ts`**

This hook centralizes all profile completeness logic and returns:
- `isProfileComplete`: boolean
- `missingFields`: array of human-readable field names
- `canAcceptClients`: boolean (same as isProfileComplete)

```text
Hook Structure:
├── Takes: staff object, licenses array
├── Validates all required fields
├── Returns completion status and missing field list
└── Memoized for performance
```

The hook will check:
1. All Personal Information fields have values
2. Specialty, Degree, and Taxonomy are set
3. At least one license exists in `staff_licenses`
4. Profile image URL exists
5. Display name and bio are filled

### Part 2: Modify Profile Page

**File: `src/pages/Profile.tsx`**

Changes:
1. Import and use `useStaffLicenses` to get license count
2. Import and use the new `useProfileCompletion` hook
3. Replace the simple Switch with a validation-aware component

**Toggle Behavior:**

When profile is INCOMPLETE and user clicks toggle:
- Show an Alert/Dialog listing all missing fields
- Do NOT enable the toggle
- Provide guidance on which sections to complete

When profile is COMPLETE and user clicks toggle ON:
- Enable the toggle
- On save, also update `prov_status` to 'Active'

**Save Warning Behavior:**

When saving ANY section (Personal, Credentials, or Client-Facing):
- Check if any required field is being removed/cleared
- If `prov_accepting_new_clients` is currently `true` and a required field would become empty:
  - Show confirmation dialog warning that saving will disable their availability
  - If confirmed, save the data AND set `prov_accepting_new_clients` to `false`

### Part 3: Update useStaffData Hook

**File: `src/hooks/useStaffData.tsx`**

Add `prov_status` to `StaffUpdateData` interface:

```typescript
interface StaffUpdateData {
  // ... existing fields ...
  prov_status?: 'New' | 'Active' | 'Inactive';
}
```

This allows the Profile page to update status when the toggle is enabled.

### Part 4: Create Missing Fields Alert Component

**New File: `src/components/Profile/MissingFieldsAlert.tsx`**

A reusable component that:
- Displays as an AlertDialog when user tries to enable the toggle
- Lists all missing fields grouped by section
- Provides clear call-to-action

---

## User Experience Flow

### Scenario 1: Incomplete Profile - Toggle Attempt

```text
User clicks "Accepting New Clients" toggle
         │
         ▼
useProfileCompletion checks fields
         │
         ▼ isProfileComplete = false
         │
Show AlertDialog:
┌─────────────────────────────────────────────┐
│ Complete Your Profile First                 │
├─────────────────────────────────────────────┤
│ Before you can accept new clients, please   │
│ complete the following:                     │
│                                             │
│ Personal Information:                       │
│   • Phone Number                            │
│   • Address                                 │
│                                             │
│ Licensing & Credentials:                    │
│   • Specialty                               │
│   • At least one license                    │
│                                             │
│ Client Facing Information:                  │
│   • Profile Image                           │
│   • Professional Bio                        │
│                                             │
│                              [Got It]       │
└─────────────────────────────────────────────┘
         │
Toggle remains OFF
```

### Scenario 2: Complete Profile - Toggle Enabled

```text
User clicks "Accepting New Clients" toggle
         │
         ▼
useProfileCompletion checks fields
         │
         ▼ isProfileComplete = true
         │
Toggle switches to ON
         │
User clicks "Update Client Information"
         │
         ▼
handleClientInfoSubmit:
  - prov_accepting_new_clients = true
  - prov_status = 'Active'  ← Auto-set
         │
         ▼
Staff is now Active and visible to clients
```

### Scenario 3: Removing Required Data

```text
User is Active and Accepting New Clients
         │
User clears "Professional Bio" field
         │
User clicks "Update Client Information"
         │
         ▼
Validation detects required field removal
         │
Show AlertDialog:
┌─────────────────────────────────────────────┐
│ This Will Disable Your Availability         │
├─────────────────────────────────────────────┤
│ Saving without a Professional Bio will      │
│ automatically turn off "Accepting New       │
│ Clients" because your profile will be       │
│ incomplete.                                 │
│                                             │
│ You won't be able to turn it back on until  │
│ you complete all required fields.           │
│                                             │
│             [Cancel]  [Save Anyway]         │
└─────────────────────────────────────────────┘
         │
If "Save Anyway":
  - Save data
  - Set prov_accepting_new_clients = false
  - Toast: "Profile saved. Accepting New Clients disabled."
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useProfileCompletion.ts` | **Create** | Centralized profile validation logic |
| `src/components/Profile/MissingFieldsAlert.tsx` | **Create** | Alert dialog showing missing fields |
| `src/components/Profile/IncompleteFieldWarningDialog.tsx` | **Create** | Warning dialog for removing required data |
| `src/pages/Profile.tsx` | **Modify** | Integrate validation, dialogs, and status update |
| `src/hooks/useStaffData.tsx` | **Modify** | Add `prov_status` to updatable fields |

---

## Technical Considerations

### Data Consistency

- The "Accepting New Clients" toggle lives in the Client-Facing section
- Required fields span ALL THREE sections (Personal, Credentials, Client-Facing)
- Validation must happen at toggle-click time, not just at save time
- Status update to 'Active' only happens when the toggle is turned ON and saved

### License Check

Licenses are stored in `staff_licenses` table, not the `staff` table. The Profile page must:
1. Fetch licenses using `useStaffLicenses({ staffId: staff.id })`
2. Check `licenses.length >= 1` as part of completion validation

### Edge Cases Handled

1. **User with no staff record**: Profile page already conditionally renders staff sections
2. **Licenses loading state**: Disable toggle while licenses are loading
3. **Multiple section saves**: Each save validates independently and warns appropriately
4. **Status already Active**: Toggle ON just saves normally, no status change needed (already Active)

---

## Testing Checklist

### Profile Completion Validation
- [ ] Toggle disabled when First Name empty
- [ ] Toggle disabled when no licenses exist
- [ ] Toggle disabled when no profile image
- [ ] Toggle enabled when ALL required fields present
- [ ] NPI can be empty and still pass validation
- [ ] Treatment Approaches can be empty and still pass validation

### Status Activation
- [ ] Turning toggle ON and saving sets `prov_status` = 'Active'
- [ ] Status change persists in database
- [ ] User appears in contractor lists after activation

### Required Field Removal Warning
- [ ] Clearing bio shows warning dialog
- [ ] Confirming save disables `prov_accepting_new_clients`
- [ ] Toast notifies user of the change
- [ ] Canceling keeps data and toggle unchanged

### Alert Dialog
- [ ] Lists all missing fields correctly
- [ ] Groups fields by section
- [ ] Dismisses on "Got It" click
- [ ] Does not enable toggle

