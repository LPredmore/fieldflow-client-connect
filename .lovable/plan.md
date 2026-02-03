
# Implementation Plan: Clinical Specialty Management Fix

## Problem Summary

Staff members created with clinical roles (Clinician, Supervisor) cannot access specialty-dependent features because the `prov_field` (specialty) is not being reliably captured and there is no UI to set or correct it afterward.

### Root Cause Analysis

1. **Add Staff Form Schema Issue**: The `AddStaffDialog.tsx` marks specialty as optional (`z.string().optional()`), even when clinical roles are selected
2. **Conditional Display Without Enforcement**: The specialty dropdown appears when clinical roles are selected, but the form can still submit without a selection
3. **No Profile-Level Fix**: The Profile page reads `prov_field` but provides no way to edit it, creating a dead-end
4. **Cascading Feature Blocks**: Missing specialty blocks:
   - Treatment Approaches selection (filtered by specialty)
   - License Types dropdown (filtered by specialty)
   - Any future specialty-dependent features

### Affected Code Paths

```text
AddStaffDialog.tsx (creation)
        │
        ▼
create-staff-account/index.ts (edge function)
        │
        ▼ specialty=undefined → prov_field=NULL
        │
staff table (prov_field=NULL)
        │
        ▼
Profile.tsx reads staff.prov_field
        │
        ├─► useTreatmentApproachOptions (disabled)
        └─► LicenseManagement (unfiltered)
        
No way to fix after creation!
```

---

## Technical Decision

**Fix this with a two-pronged approach:**

1. **Make specialty required for clinical roles in AddStaffDialog** - Enforce via Zod's `refine()` method
2. **Add specialty selector to Profile page** - Allow staff to set/update their specialty directly

### Why This Is The Right Approach

**Option A (Rejected): Just make it required at creation**
- Doesn't fix existing broken accounts
- Users still have no recoverability path

**Option B (Rejected): Just add it to Profile page**
- Allows continued creation of broken accounts
- Admin burden increases

**Option C (Chosen): Both - defensive at creation + self-service fix**
- Prevents new broken accounts via schema validation
- Enables existing accounts to self-fix
- Reduces support burden
- Follows principle of "make invalid states impossible to represent"

---

## Implementation Details

### Part 1: Enforce Specialty at Creation

**File: `src/components/Settings/UserManagement/AddStaffDialog.tsx`**

Modify the Zod schema to conditionally require specialty when clinical roles are selected:

```typescript
const addStaffSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  specialty: z.string().optional(),
  roles: z.array(z.string()).min(1, "At least one role must be selected"),
}).refine((data) => {
  const hasClinicalRole = data.roles.some(role => 
    CLINICAL_ROLES.includes(role)
  );
  // If clinical role selected, specialty must be provided
  if (hasClinicalRole && !data.specialty) {
    return false;
  }
  return true;
}, {
  message: "Specialty is required for clinical roles",
  path: ["specialty"],
});
```

### Part 2: Add Specialty to Profile Page

**File: `src/pages/Profile.tsx`**

Add specialty selection field to the Professional Information card, right below the name fields.

```typescript
// In professionalInfo state, add:
prov_field: '',

// Sync from staff data:
prov_field: staff.prov_field || '',

// In handleProfessionalInfoSubmit:
prov_field: professionalInfo.prov_field || undefined,

// In JSX (after name fields grid):
<div className="space-y-2">
  <Label htmlFor="prov_field">Specialty</Label>
  <Select
    value={professionalInfo.prov_field}
    onValueChange={(value) => setProfessionalInfo(prev => ({ 
      ...prev, 
      prov_field: value 
    }))}
  >
    <SelectTrigger id="prov_field">
      <SelectValue placeholder="Select your specialty" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="Mental Health">Mental Health</SelectItem>
      <SelectItem value="Speech Therapy">Speech Therapy</SelectItem>
      <SelectItem value="Occupational Therapy">Occupational Therapy</SelectItem>
    </SelectContent>
  </Select>
  <p className="text-sm text-muted-foreground">
    Your clinical specialty determines available license types and treatment approaches
  </p>
</div>
```

**File: `src/hooks/useStaffData.tsx`**

Add `prov_field` to the `StaffUpdateData` interface to allow updates:

```typescript
interface StaffUpdateData {
  // ... existing fields ...
  prov_field?: string;  // Add this
}
```

### Part 3: Fix Existing Data

The user asked specifically about `info+dummy@valorwell.org`. Once the Profile page UI is in place, this user (and any others with NULL specialty) can set their specialty themselves. No manual database fix required.

---

## Database Compatibility

The `specialty_enum` in the database already supports all three values:
- `Mental Health`
- `Speech Therapy`  
- `Occupational Therapy`

The Profile page will use these exact strings to ensure enum compatibility.

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/Settings/UserManagement/AddStaffDialog.tsx` | **Modify** | Add `.refine()` validation for specialty when clinical roles selected |
| `src/pages/Profile.tsx` | **Modify** | Add specialty selector to Professional Information section |
| `src/hooks/useStaffData.tsx` | **Modify** | Add `prov_field` to `StaffUpdateData` interface |

---

## Testing Checklist

### Add Staff Dialog
- [ ] Creating a Clinician without selecting specialty shows validation error
- [ ] Creating a Supervisor without selecting specialty shows validation error  
- [ ] Creating Office/Billing/Admin staff works without specialty
- [ ] Creating Clinician WITH specialty selected works correctly
- [ ] Specialty saves to database correctly (verify `prov_field` is set)

### Profile Page
- [ ] Specialty dropdown appears in Professional Information section
- [ ] Existing specialty value loads correctly
- [ ] Changing specialty and saving updates the database
- [ ] After updating specialty, Treatment Approaches section becomes active
- [ ] License Types dropdown now filters by the new specialty

### End-to-End Fix for Existing User
- [ ] Login as `info+dummy@valorwell.org`
- [ ] Navigate to Profile page
- [ ] Select "Mental Health" as specialty
- [ ] Save changes
- [ ] Scroll to Client Facing Information
- [ ] Verify Treatment Approaches multiselect is now available
- [ ] Verify license types are filtered to Mental Health options
