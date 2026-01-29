

# Fix PHQ-9 and PCL-5 Assessment Date Auto-Population

## Problem Summary

The `assessment_date` field in PHQ-9 (and PCL-5) tables is NULL when assessments are created, causing dates to display as "1970" in the UI (because `new Date(null)` returns the Unix epoch).

## Root Cause Analysis

| Table | `assessment_date` column | `administered_at` column | Current behavior |
|-------|-------------------------|--------------------------|------------------|
| `client_phq9_assessments` | YES, nullable, **NO default** | YES, `DEFAULT now()` | `assessment_date` stays NULL |
| `client_gad7_assessments` | **NO** | YES, `DEFAULT now()` | Works correctly |
| `client_pcl5_assessments` | YES, nullable, **NO default** | YES, `DEFAULT now()` | Same problem potential |

The `administered_at` field auto-populates via `DEFAULT now()`, but `assessment_date` has no default and no trigger to derive its value.

## Technical Decision: Database Trigger

**Decision**: Create a database trigger that auto-populates `assessment_date` from the date portion of `administered_at` on INSERT.

**Why this is the right approach**:

1. **Single Source of Truth**: The database enforces the rule regardless of how data is inserted (app, bulk import, direct SQL, future APIs)
2. **No Code Changes Required in Multiple Insert Points**: Any code path that inserts PHQ-9/PCL-5 records automatically benefits
3. **Existing Pattern**: The codebase already uses `set_updated_at` trigger for similar auto-population
4. **Data Integrity**: Impossible to have NULL `assessment_date` after this fix
5. **Backward Compatibility**: Existing NULL records can be fixed with a one-time UPDATE

**Why NOT application-level fixes**:

- Would require finding and modifying every insertion point (forms, imports, future integrations)
- Code duplication and risk of future omissions
- Doesn't protect against direct database inserts

## Implementation Plan

### Step 1: Create Database Trigger Function

Create a trigger function that extracts the date from `administered_at` and sets `assessment_date`:

```sql
CREATE OR REPLACE FUNCTION set_assessment_date_from_administered_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only set assessment_date if it's NULL
  IF NEW.assessment_date IS NULL THEN
    NEW.assessment_date := (NEW.administered_at AT TIME ZONE 'UTC')::date;
  END IF;
  RETURN NEW;
END;
$$;
```

Key design choices:
- Uses `AT TIME ZONE 'UTC'` to extract the date in UTC (consistent with how `administered_at` is stored)
- Only sets if NULL, allowing explicit override when needed (e.g., backdated assessments)
- Returns NEW for BEFORE trigger pattern

### Step 2: Attach Trigger to PHQ-9 Table

```sql
CREATE TRIGGER set_phq9_assessment_date
BEFORE INSERT ON client_phq9_assessments
FOR EACH ROW
EXECUTE FUNCTION set_assessment_date_from_administered_at();
```

### Step 3: Attach Trigger to PCL-5 Table

```sql
CREATE TRIGGER set_pcl5_assessment_date
BEFORE INSERT ON client_pcl5_assessments
FOR EACH ROW
EXECUTE FUNCTION set_assessment_date_from_administered_at();
```

### Step 4: Fix Existing NULL Records

One-time data correction for records already in the database:

```sql
-- Fix PHQ-9 records with NULL assessment_date
UPDATE client_phq9_assessments
SET assessment_date = (administered_at AT TIME ZONE 'UTC')::date
WHERE assessment_date IS NULL;

-- Fix PCL-5 records with NULL assessment_date
UPDATE client_pcl5_assessments
SET assessment_date = (administered_at AT TIME ZONE 'UTC')::date
WHERE assessment_date IS NULL;
```

### Step 5: Update TypeScript Interface (Defensive)

Update `useClientDetail.tsx` to mark `assessment_date` as nullable (matching database reality):

```typescript
export interface PHQ9Assessment {
  // ...
  assessment_date: string | null;  // Was incorrectly typed as required string
  // ...
}
```

### Step 6: Add Display Fallback in UI (Belt-and-Suspenders)

Even though the trigger will prevent future NULLs, add a defensive fallback in `ClientAssessmentsTab.tsx` for robustness:

```typescript
// Line 63: Chart data transformation
const phq9ChartData = useMemo(() =>
  phq9Assessments.map(a => ({
    date: a.assessment_date || a.administered_at,  // Fallback
    score: a.total_score,
  })),
  [phq9Assessments]
);

// Line 207: Table display
{format(new Date(assessment.assessment_date || assessment.administered_at), 'MMM d, yyyy')}
```

## Files to Modify

| File | Changes |
|------|---------|
| Database (via migration) | Create trigger function, attach to PHQ-9 and PCL-5 tables |
| Database (one-time) | UPDATE existing NULL records |
| `src/hooks/useClientDetail.tsx` | Fix `assessment_date` type to `string \| null` |
| `src/components/Clients/ClientDetail/ClientAssessmentsTab.tsx` | Add fallback logic for chart data and table display |

## Verification After Implementation

1. Create a new PHQ-9 assessment in the app
2. Query the database to confirm `assessment_date` is auto-populated
3. Verify the Assessments tab displays the correct date (not 1970)
4. Confirm Carson Pritchett's 3 previously-broken records now show correct dates

## Data Impact

Current affected records (will be fixed):
- **3 PHQ-9 records** with NULL `assessment_date`
- Potentially PCL-5 records (same issue could occur)

After fix: All existing and future records will have valid `assessment_date` values.

