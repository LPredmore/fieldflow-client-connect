
# Implementation Plan: Appointment Billing Fields for Insurance Claims

## Problem Statement

When therapists document sessions through the `SessionNoteDialog`, the following billing fields in the `appointments` table are NOT being populated:
- `location_name` / `location_id` - required for CMS-1500 Box 32
- `from_date_1` / `thru_date_1` - required for CMS-1500 Box 24A (service dates)
- `proc_code_1` - required for CMS-1500 Box 24D (CPT code)
- `narrative_1` - required for claim attachments
- `units_1` / `charge_1` - required for CMS-1500 Box 24G/24F

Currently, `useSessionNote.tsx` only sets `status: 'documented'`. The 157 documented appointments with billing data were populated by an external system.

---

## Current State Analysis

### Data Verification
```
Status      | Count | Has Location | Has Proc Code | Has Charge
------------|-------|--------------|---------------|------------
scheduled   |     6 |           1  |            0  |          0
documented  |   158 |         157  |          157  |        157
cancelled   |     1 |           0  |            0  |          1
```

**Key Finding:** Only 1 of 6 scheduled appointments has location data. New appointments are NOT getting location set at creation time.

### Existing Infrastructure
1. **Default Location Exists:** `practice_locations` has `is_default=true` entry for tenant
2. **CPT Codes Enabled:** 7 codes available in `tenant_cpt_codes` with custom rates
3. **Cancellation Logic:** `Index.tsx` already sets `charge_1` and `narrative_1` for late cancellations

---

## Technical Decision

**Approach: Two-Phase Population**

1. **Phase 1 (Appointment Creation):** Set `location_id` and `location_name` when the appointment is first created
2. **Phase 2 (Session Documentation):** Set billing fields (`from_date_1`, `thru_date_1`, `proc_code_1`, `narrative_1`, `units_1`, `charge_1`) when the session note is saved

**Rationale:**
- Location is known at creation time (default practice location)
- Billing fields require clinical input (CPT code, narrative) only available at documentation time
- Separating concerns prevents incomplete billing data if documentation is abandoned
- Matches the natural workflow: schedule → conduct session → document → bill

**Location Strategy:** Since the database schema is immutable and `staff` table cannot be modified to add a location assignment, ALL appointments will use the tenant's default location from `practice_locations.is_default = true`.

---

## Implementation Details

### Phase 1: Location at Appointment Creation

**File: `src/hooks/useDefaultLocation.tsx`** (New)
```text
Purpose: Hook to fetch tenant's default practice location
Query:
  SELECT id, name 
  FROM practice_locations 
  WHERE tenant_id = :tenantId AND is_default = true 
  LIMIT 1
Returns: { id: string, name: string } | null
```

**File: `src/hooks/useAppointmentCreation.tsx`** (Modify)
```text
Changes:
1. Import and call useDefaultLocation hook
2. Set location fields in appointmentData:
   - location_id: defaultLocation?.id || null
   - location_name: For telehealth → 'Telehealth', else → defaultLocation?.name
```

**File: `supabase/functions/generate-appointment-occurrences/index.ts`** (Modify)
```text
Changes:
1. Query default location for the series' tenant_id
2. Include location_id and location_name in appointmentData object
3. Handle telehealth flag for location_name
```

### Phase 2: Billing Fields at Documentation

**File: `src/hooks/useEnabledCptCodes.tsx`** (New)
```text
Purpose: Fetch enabled CPT codes for tenant with joined code/description
Query:
  SELECT tc.id, tc.cpt_code_id, tc.custom_rate, c.code, c.description
  FROM tenant_cpt_codes tc
  JOIN cpt_codes c ON tc.cpt_code_id = c.id
  WHERE tc.tenant_id = :tenantId AND tc.is_enabled = true
  ORDER BY c.code

Returns: Array of {
  id: string           // tenant_cpt_codes.id  
  cpt_code_id: string  // FK to cpt_codes
  code: string         // "90834"
  description: string  // "Psychotherapy, 45 minutes..."
  custom_rate: number  // Whole dollars (e.g., 150)
}
```

**File: `src/components/Clinical/SessionNote/BillingSection.tsx`** (New)
```text
Purpose: CPT Code selector and Units input
Props:
  - form: react-hook-form instance
  - enabledCptCodes: from useEnabledCptCodes
  - loading: boolean
  
Layout:
┌────────────────────────────────────────────────────────────┐
│ Billing                                                    │
├────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ ┌──────────┐ │
│ │ CPT Code (searchable dropdown)           │ │ Units    │ │
│ │ e.g., "90834 - Psychotherapy, 45 min"    │ │    1     │ │
│ └──────────────────────────────────────────┘ └──────────┘ │
│                                                            │
│ Charge: $150.00                                           │
└────────────────────────────────────────────────────────────┘

Behavior:
- CPT dropdown uses cmdk Combobox for searchability
- Units defaults to 1, minimum 1
- Charge auto-calculates: units × selectedCode.custom_rate
- Displays "(Rate not set)" if custom_rate is null
```

**File: `src/components/Clinical/SessionNoteDialog.tsx`** (Modify)
```text
Schema Changes (add to sessionNoteSchema):
  cpt_code_id: z.string().min(1, 'CPT Code is required'),
  units: z.number().min(1, 'At least 1 unit required').default(1),

New State:
  const [selectedCptCode, setSelectedCptCode] = useState<EnabledCptCode | null>(null);

UI Changes:
  1. Import useEnabledCptCodes hook
  2. Add BillingSection component after PlanSection, before submit button
  3. Pass form, cptCodes, loading to BillingSection

Submit Changes:
  1. Extract cpt_code_id, units from form data
  2. Calculate chargeAmount = units × selectedCptCode.custom_rate
  3. Pass billingData to createSessionNote
```

**File: `src/hooks/useSessionNote.tsx`** (Modify)
```text
Interface Changes:
  Add to createSessionNote parameters:
  billingData: {
    procCode: string;      // The CPT code string (e.g., "90834")
    units: number;         // Number of units
    chargeAmount: number;  // Pre-calculated total charge
  }

Function Changes:
  1. Fetch appointment start_at/end_at to extract dates
  2. Update appointments table with ALL billing fields:
     {
       status: 'documented',
       from_date_1: extractDateOnly(appointment.start_at),
       thru_date_1: extractDateOnly(appointment.end_at),
       proc_code_1: billingData.procCode,
       narrative_1: formData.client_sessionnarrative,
       units_1: billingData.units,
       charge_1: billingData.chargeAmount
     }

Date Extraction Helper:
  function extractDateOnly(isoString: string): string {
    return isoString.split('T')[0]; // Returns "2026-02-02"
  }
```

---

## Data Flow Summary

```text
APPOINTMENT CREATION FLOW:
User clicks "New Appointment"
       │
       ▼
useAppointmentCreation
       │
       ├─► Query practice_locations (is_default=true)
       │
       ▼
INSERT INTO appointments (
  ...,
  location_id: default_location.id,
  location_name: is_telehealth ? 'Telehealth' : default_location.name
)


SESSION DOCUMENTATION FLOW:
User opens "Document Session"
       │
       ▼
SessionNoteDialog renders
       │
       ├─► useEnabledCptCodes() → fetches 7 CPT codes
       │
       ▼
User fills form + selects CPT code + enters units
       │
       ├─► BillingSection calculates: 1 × $150 = $150.00
       │
       ▼
User clicks "Save Session Note"
       │
       ▼
useSessionNote.createSessionNote()
       │
       ├─► INSERT appointment_clinical_notes (clinical data)
       │
       ├─► UPDATE appointments SET
       │     status = 'documented',
       │     from_date_1 = '2026-02-02',
       │     thru_date_1 = '2026-02-02',
       │     proc_code_1 = '90834',
       │     narrative_1 = '...session narrative text...',
       │     units_1 = 1,
       │     charge_1 = 150.00
       │
       ▼
Appointment ready for claims submission
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useDefaultLocation.tsx` | Create | Query tenant's default practice location |
| `src/hooks/useEnabledCptCodes.tsx` | Create | Query enabled CPT codes with descriptions |
| `src/hooks/useAppointmentCreation.tsx` | Modify | Add location_id/location_name at creation |
| `src/hooks/useAppointmentSeries.tsx` | Modify | Pass location to edge function |
| `supabase/functions/generate-appointment-occurrences/index.ts` | Modify | Add location to generated appointments |
| `src/components/Clinical/SessionNote/BillingSection.tsx` | Create | CPT/Units UI component |
| `src/components/Clinical/SessionNoteDialog.tsx` | Modify | Add billing schema + BillingSection |
| `src/hooks/useSessionNote.tsx` | Modify | Update appointments with billing fields |

---

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| No default location exists | Log warning, set location fields to null (doesn't block save) |
| No enabled CPT codes | Show inline message "No CPT codes available. Please enable codes in Settings → Clinical." with button to navigate |
| CPT code has null custom_rate | Calculate charge as 0, show "(Rate not set)" warning |
| Units = 0 or negative | Zod validation prevents (minimum: 1) |
| Telehealth appointment | Set location_name = "Telehealth" but still capture location_id for billing entity |
| Appointment already documented | Existing view-only mode prevents re-submission |

---

## Testing Checklist

1. **Appointment Creation**
   - [ ] Create single appointment → verify location_id and location_name populated
   - [ ] Create telehealth appointment → verify location_name = "Telehealth"
   - [ ] Create recurring series → verify all generated appointments have location fields

2. **Session Documentation**
   - [ ] Open SessionNoteDialog → verify CPT dropdown shows 7 enabled codes
   - [ ] Select CPT code → verify charge calculates correctly
   - [ ] Change units to 2 → verify charge doubles
   - [ ] Save session note → verify appointment record has all 6 billing fields
   - [ ] Verify narrative_1 matches client_sessionnarrative

3. **Edge Cases**
   - [ ] Tenant with no enabled CPT codes → verify error message displays
   - [ ] CPT code with null custom_rate → verify "(Rate not set)" warning
   - [ ] Query documented appointment → confirm all fields ready for CMS-1500

4. **Regression Testing**
   - [ ] Existing documented appointments still display correctly
   - [ ] Cancellation flow (Index.tsx) still works for charge_1/narrative_1
   - [ ] Appointment view shows location correctly

---

## Dependencies

- No database schema changes required
- No new external dependencies
- Uses existing `cmdk` library for searchable dropdown
- Uses existing `zod` for form validation

---

## Rollback Strategy

If issues are discovered after deployment:
1. BillingSection can be hidden via feature flag (add `showBilling` prop)
2. Billing fields remain nullable, so partial data won't break claims
3. useSessionNote can revert to original behavior (status-only update) without data loss
