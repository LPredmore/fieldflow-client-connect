
# Implementation Plan: Add Date of Birth and Highest Degree Fields to Staff Profile

## Overview

Add two new fields to the `/staff/profile` page:
1. **`prov_dob`** ("Date of Birth") - positioned to the right of the Time Zone field
2. **`prov_degree`** ("Highest Degree") - positioned at the top of the Licensing & Credentials section

Both fields are already present in the database (`prov_dob` as `date`, `prov_degree` as `text`).

---

## Current State Analysis

### Database Schema
Verified columns exist in `staff` table:
- `prov_dob`: `date`, nullable
- `prov_degree`: `text`, nullable

### TypeScript Types
The Supabase generated types (`src/integrations/supabase/types.ts`) do **NOT** include these columns yet. They were added after the last type generation.

### Affected Files
| File | Current State | Changes Needed |
|------|--------------|----------------|
| `src/integrations/supabase/types.ts` | Missing `prov_dob`, `prov_degree` | Will auto-regenerate |
| `src/hooks/useStaffData.tsx` | `StaffMember` interface missing new fields | Add fields to interface |
| `src/pages/Profile.tsx` | No DOB or degree fields | Add to form state, UI, and submission |
| `src/schema/tables/staff-provider.ts` | Missing new columns | Add column definitions |

---

## Technical Decisions

### Date Picker Pattern: Popover + Calendar with pointer-events-auto

**Decision**: Use the established Popover + Calendar pattern from `TreatmentPlanDialog.tsx` and `FieldRenderer.tsx`, but add `pointer-events-auto` class to the Calendar component per Shadcn best practices.

**Rationale**:
1. **Consistency**: The codebase already uses this pattern in `TreatmentPlanDialog.tsx` (lines 428-454) and `DynamicForm/FieldRenderer.tsx` (lines 113-139)
2. **UX for Birth Dates**: The Calendar component with `captionLayout="dropdown-buttons"` allows users to quickly jump between months/years - critical for selecting dates decades in the past
3. **Accessibility**: The Popover + Calendar combo provides proper ARIA labeling and keyboard navigation
4. **Interactivity Fix**: Adding `pointer-events-auto` to the Calendar className ensures the calendar remains interactive inside popovers (per Shadcn documentation)

### State Management: Extend `professionalInfo` State Object

**Decision**: Add `prov_dob` to the existing `professionalInfo` state object since it will be saved with the Professional Information form.

**Rationale**:
1. **Form Cohesion**: DOB is being placed in the Professional Information section (next to Time Zone), so it should submit with that form
2. **Single Update Call**: All Professional Information fields update in a single `updateStaffInfo()` call
3. **Existing Pattern**: Follows how other fields are grouped by form section

### Credentials State Extension

**Decision**: Add `prov_degree` to the existing `credentials` state object since it belongs in the Licensing & Credentials section.

**Rationale**:
1. **Form Cohesion**: Degree is in the Licensing & Credentials section, so it should submit with credentials form
2. **Single Update Call**: Degree updates with NPI and Taxonomy in one operation
3. **Logical Grouping**: Highest degree is a professional credential

### Date Storage Format

**Decision**: Store dates as ISO strings (`YYYY-MM-DD`) and parse them back to Date objects for the Calendar.

**Rationale**:
1. **Database Compatibility**: The `prov_dob` column is type `date`, which expects `YYYY-MM-DD` format
2. **Existing Pattern**: `staff_licenses.issue_date` and `staff_licenses.expiration_date` follow this pattern
3. **date-fns Integration**: Using `format(date, 'yyyy-MM-dd')` for storage and `parseISO()` for retrieval

---

## Implementation Steps

### Step 1: Update Schema Definition
Update `src/schema/tables/staff-provider.ts` to include the new columns:

```typescript
// In staff columns object, add:
prov_dob: { type: 'date', nullable: true },
prov_degree: { type: 'text', nullable: true },
```

### Step 2: Update useStaffData Hook Interfaces
Update `src/hooks/useStaffData.tsx`:

1. Add to `StaffMember` interface:
```typescript
prov_dob?: string | null;
prov_degree?: string | null;
```

2. Add to `StaffUpdateData` interface:
```typescript
prov_dob?: string | null;
prov_degree?: string | null;
```

### Step 3: Update Profile.tsx

#### 3a. Add Imports
```typescript
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
```

#### 3b. Extend `professionalInfo` State
Add `prov_dob` to the state initialization:
```typescript
const [professionalInfo, setProfessionalInfo] = useState({
  // ... existing fields
  prov_time_zone: '',
  prov_dob: '', // New field
});
```

#### 3c. Extend `credentials` State
Add `prov_degree` to the state initialization:
```typescript
const [credentials, setCredentials] = useState({
  prov_npi: '',
  prov_taxonomy: '',
  prov_degree: '', // New field
});
```

#### 3d. Update useEffect for Professional Info Sync
```typescript
useEffect(() => {
  if (staff && profile) {
    setProfessionalInfo({
      // ... existing fields
      prov_time_zone: staff.prov_time_zone || '',
      prov_dob: staff.prov_dob || '', // Sync DOB
    });
  }
}, [staff, profile]);
```

#### 3e. Update useEffect for Credentials Sync
```typescript
useEffect(() => {
  if (staff) {
    setCredentials({
      prov_npi: staff.prov_npi || '',
      prov_taxonomy: staff.prov_taxonomy || '',
      prov_degree: staff.prov_degree || '', // Sync degree
    });
  }
}, [staff]);
```

#### 3f. Update Professional Info Submit Handler
Add `prov_dob` to the staff update call:
```typescript
const staffResult = await updateStaffInfo({
  // ... existing fields
  prov_time_zone: professionalInfo.prov_time_zone || undefined,
  prov_dob: professionalInfo.prov_dob || null, // Submit DOB
});
```

#### 3g. Update Credentials Submit Handler
Add `prov_degree` to the credentials update call:
```typescript
const result = await updateStaffInfo({
  prov_npi: credentials.prov_npi,
  prov_taxonomy: credentials.prov_taxonomy,
  prov_degree: credentials.prov_degree || null, // Submit degree
});
```

#### 3h. Add Date of Birth Field to Professional Information Section

Replace the current Time Zone field (lines 628-645) with a 2-column grid containing Time Zone and Date of Birth:

```tsx
<div className="grid gap-4 md:grid-cols-2">
  {/* Time Zone - existing field */}
  <div className="space-y-2">
    <Label htmlFor="prov_time_zone">Time Zone</Label>
    <Select
      value={professionalInfo.prov_time_zone}
      onValueChange={(value) => setProfessionalInfo(prev => ({ ...prev, prov_time_zone: value }))}
    >
      <SelectTrigger id="prov_time_zone">
        <SelectValue placeholder="Select your time zone" />
      </SelectTrigger>
      <SelectContent>
        {DB_ENUMS.time_zones.map(tz => (
          <SelectItem key={tz} value={tz}>
            {TIMEZONE_LABELS[tz] || tz}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {/* Date of Birth - new field */}
  <div className="space-y-2">
    <Label>Date of Birth</Label>
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !professionalInfo.prov_dob && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {professionalInfo.prov_dob ? (
            format(parseISO(professionalInfo.prov_dob), 'PPP')
          ) : (
            <span>Select date of birth</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={professionalInfo.prov_dob ? parseISO(professionalInfo.prov_dob) : undefined}
          onSelect={(date) => setProfessionalInfo(prev => ({ 
            ...prev, 
            prov_dob: date ? format(date, 'yyyy-MM-dd') : '' 
          }))}
          disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
          captionLayout="dropdown-buttons"
          fromYear={1930}
          toYear={new Date().getFullYear()}
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  </div>
</div>
```

**Key Calendar Props for DOB Selection**:
- `captionLayout="dropdown-buttons"`: Enables month/year dropdowns for quick navigation
- `fromYear={1930}`: Allows selecting dates going back to 1930
- `toYear={new Date().getFullYear()}`: Prevents future dates
- `disabled`: Validates date range (no future dates, reasonable minimum)
- `className="p-3 pointer-events-auto"`: Ensures interactivity in popover

#### 3i. Add Highest Degree Field to Licensing & Credentials Section

Add the degree field right after the CardDescription, before the LicenseManagement component (line 674):

```tsx
<CardContent className="space-y-6">
  {/* Highest Degree - new field */}
  <div className="space-y-2">
    <Label htmlFor="prov_degree">Highest Degree</Label>
    <Input
      id="prov_degree"
      value={credentials.prov_degree}
      onChange={(e) => setCredentials(prev => ({ ...prev, prov_degree: e.target.value }))}
      placeholder="e.g., Ph.D., Psy.D., M.S., M.A."
    />
    <p className="text-sm text-muted-foreground">
      Your highest earned academic degree (e.g., Ph.D., Psy.D., M.S.W., M.A.)
    </p>
  </div>

  {/* License Management - existing */}
  <LicenseManagement 
    staffId={staff.id} 
    specialty={staff.prov_field}
  />
  
  {/* Rest of credentials form... */}
</CardContent>
```

---

## Layout Summary

### Before (Professional Information Section)
```text
[Time Zone dropdown - full width]
```

### After (Professional Information Section)
```text
[Time Zone dropdown] [Date of Birth picker]
     (50% width)         (50% width)
```

### Before (Licensing & Credentials Section)
```text
Card Description: "Manage your professional licenses and credentials"
LicenseManagement component
NPI Number | Taxonomy Code
```

### After (Licensing & Credentials Section)
```text
Card Description: "Manage your professional licenses and credentials"
[Highest Degree input - full width]
LicenseManagement component
NPI Number | Taxonomy Code
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/schema/tables/staff-provider.ts` | Add `prov_dob` and `prov_degree` column definitions |
| `src/hooks/useStaffData.tsx` | Add fields to `StaffMember` and `StaffUpdateData` interfaces |
| `src/pages/Profile.tsx` | Add imports, state fields, sync effects, submit handlers, and UI components |

---

## Type Regeneration Note

After deployment, the Supabase types file (`src/integrations/supabase/types.ts`) will automatically regenerate to include:
```typescript
prov_dob: string | null
prov_degree: string | null
```

The TypeScript interfaces in `useStaffData.tsx` will align with these generated types.

---

## Data Flow Summary

```text
Database (prov_dob, prov_degree)
    ↓
useStaffData hook fetches staff record
    ↓
useEffect syncs to local state
    ↓
UI displays current values (Date picker / Input)
    ↓
User edits
    ↓
Form submit calls updateStaffInfo()
    ↓
Database updated
    ↓
refetchStaff() refreshes UI
```
