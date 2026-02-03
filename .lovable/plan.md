
# Implementation Plan: Simplify Date of Birth Picker

## Problem Summary

The Date of Birth picker on `/staff/profile` currently uses a complex `react-day-picker` Calendar with `captionLayout="dropdown-buttons"`. This creates a poor UX because:
- Year/month dropdowns render as cramped native HTML selects inside a calendar popup
- Requires scrolling through ~95 years (1930-2026) in a tiny dropdown
- Overly complex for a simple date entry

Meanwhile, the "Issued On" and "Expires On" fields in **LicenseManagement** use a simple `<Input type="date" />` which provides a clean, native browser date picker.

---

## Technical Decision

**Replace the Calendar/Popover-based DOB picker with a simple native date input (`<Input type="date" />`), matching the pattern already used in LicenseManagement.**

### Why This Is the Right Approach

1. **Consistency**: Uses the same pattern as the Licensing & Credentials date fields that the user explicitly prefers
2. **Simplicity**: Native date inputs are universally understood and require no complex state management
3. **Browser Optimization**: Modern browsers (Chrome, Edge, Safari, Firefox) all provide optimized date pickers with month/year navigation built in
4. **Less Code**: Removes ~20 lines of Popover/Calendar JSX, simplifying the component
5. **Mobile-Friendly**: Native date pickers work excellently on mobile devices

---

## Current Implementation (Lines 658-693)

```typescript
<div className="space-y-2">
  <Label>Date of Birth</Label>
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className={cn(...)}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {professionalInfo.prov_dob ? format(...) : <span>Select date of birth</span>}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        captionLayout="dropdown-buttons"
        fromYear={1930}
        toYear={new Date().getFullYear()}
        ...
      />
    </PopoverContent>
  </Popover>
</div>
```

---

## New Implementation

```typescript
<div className="space-y-2">
  <Label htmlFor="prov_dob">Date of Birth</Label>
  <Input
    id="prov_dob"
    type="date"
    value={professionalInfo.prov_dob}
    onChange={(e) => setProfessionalInfo(prev => ({ 
      ...prev, 
      prov_dob: e.target.value 
    }))}
    max={format(new Date(), 'yyyy-MM-dd')}
  />
</div>
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/Profile.tsx` | **Modify** | Replace Calendar picker with native date input |

---

## Visual Comparison

**Before (Calendar popup with cramped dropdowns):**
```
┌─────────────────────────────────────────────────┐
│ Date of Birth                                   │
│ ┌───────────────────────────────────────────┐  │
│ │ 📅  January 15, 1985                    ▼ │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│ (Opens complex calendar popup with              │
│  tiny year dropdown showing 1930-2026)         │
└─────────────────────────────────────────────────┘
```

**After (Native date input, same as license dates):**
```
┌─────────────────────────────────────────────────┐
│ Date of Birth                                   │
│ ┌───────────────────────────────────────────┐  │
│ │  1985-01-15                            📅 │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│ (Click opens browser's native date picker      │
│  with easy month/year navigation)              │
└─────────────────────────────────────────────────┘
```

---

## Changes in Detail

### Remove unused imports (if no longer needed elsewhere)

The `Calendar`, `Popover`, `PopoverTrigger`, `PopoverContent`, `cn`, `parseISO`, and `CalendarIcon` imports may no longer be needed for the DOB field. However, `CalendarIcon` is used in the import alias and other parts of the file, so we only need to verify if `Popover` components are used elsewhere.

After checking: The file uses `cn` elsewhere and may use other imports, so we'll leave imports as-is to avoid breaking other functionality.

### Replace DOB field (lines 658-693)

Replace the Popover/Calendar block with a simple Input.

---

## Data Format Compatibility

- Native date inputs use `yyyy-MM-dd` format
- The current `professionalInfo.prov_dob` is already stored as `yyyy-MM-dd` in the database
- The existing `prov_dob: date ? format(date, 'yyyy-MM-dd') : ''` logic already uses this format
- **No data transformation needed** - the native input value directly matches the database format

---

## What This Does NOT Change

- Database schema (prov_dob remains a date string)
- Form submission logic (already handles the correct format)
- Other date pickers in the app (only affects DOB field)
- LicenseManagement component (unchanged, serves as the pattern)

---

## Testing Checklist

1. **Date Selection**
   - [ ] Clicking the input opens browser's native date picker
   - [ ] Year/month navigation works smoothly in the native picker
   - [ ] Selecting a date populates the field correctly

2. **Data Persistence**
   - [ ] Existing DOB loads correctly when page opens
   - [ ] Saving updates the database with correct format
   - [ ] Clearing the field and saving stores null/empty

3. **Validation**
   - [ ] Cannot select future dates (max constraint)
   - [ ] Form submits correctly with or without DOB

4. **Consistency**
   - [ ] Visual style matches "Issued On" and "Expires On" fields in License section
