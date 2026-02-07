

# Implementation Plan: Staff Creation Diagnostic Logging

## Objective

Add comprehensive diagnostic logging to the staff creation flow so that when something fails, you can capture the exact state at every step and share it with me for analysis - even on the published site where I cannot directly access console logs.

---

## Technical Overview

The solution adds logging at three layers:

```text
┌──────────────────────────────────────────────────────────────┐
│  Browser (AddStaffDialog + useAddStaff)                      │
│  - Pre-call validation logging                               │
│  - Request/response capture                                  │
│  - Exportable diagnostics with "Copy Diagnostics" button     │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│  Edge Function (create-staff-account)                        │
│  - Step-by-step logging with unique diagnosticId             │
│  - Each step logged BEFORE and AFTER execution               │
│  - Full error context on failure                             │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│  Supabase Logs (Dashboard → Edge Functions → Logs)           │
│  - Filter by diagnosticId to find exact execution trace     │
└──────────────────────────────────────────────────────────────┘
```

---

## File Changes

### 1. `src/hooks/useAddStaff.ts`

**Purpose**: Capture complete request/response data with timestamps

**Changes**:
- Generate unique `diagnosticId` for each creation attempt
- Log all input data before calling edge function
- Capture full response (success or error)
- Store diagnostic trace in state for export
- Return diagnostics alongside result

**New Interface**:
```typescript
interface DiagnosticTrace {
  diagnosticId: string;
  timestamp: string;
  input: {
    email: string;
    firstName: string;
    lastName: string;
    specialty?: string;
    roles: string[];
    tenantId: string;
  };
  response?: {
    success: boolean;
    data?: any;
    error?: string;
    httpStatus?: number;
  };
  timingMs: number;
  browserInfo: {
    userAgent: string;
    url: string;
  };
}
```

---

### 2. `src/components/Settings/UserManagement/AddStaffDialog.tsx`

**Purpose**: Display diagnostic info and provide export capability

**Changes**:
- Show `diagnosticId` in error state
- Add "Copy Diagnostics" button when creation fails
- Display diagnostic summary in collapsible section
- Store last diagnostic trace for retrieval

**New UI Elements**:
- Error state shows: "Error creating staff. Diagnostic ID: `abc-123-xyz`"
- "Copy Diagnostics" button that copies full JSON trace to clipboard
- Expandable "View Details" section showing step-by-step trace

---

### 3. `supabase/functions/create-staff-account/index.ts`

**Purpose**: Log every step with the diagnosticId for correlation

**Changes**:
- Accept optional `diagnosticId` from client (or generate one)
- Log at START and END of each step with structured data
- Include diagnosticId in all log messages for filtering
- Return diagnosticId in response for correlation

**Logging Format**:
```
[DIAG:abc-123-xyz] STEP 1 START: Checking if user exists | email=test@example.com
[DIAG:abc-123-xyz] STEP 1 COMPLETE: User does not exist | duration=45ms
[DIAG:abc-123-xyz] STEP 2 START: Generating password
[DIAG:abc-123-xyz] STEP 2 COMPLETE: Password generated | length=12
... etc
```

**Error Logging**:
```
[DIAG:abc-123-xyz] STEP 5 FAILED: tenant_memberships insert
  error_code: 23505
  error_message: duplicate key value violates unique constraint
  input: { tenant_id: "...", profile_id: "..." }
```

---

## Diagnostic Workflow

When staff creation fails, you will:

1. **See the error in the dialog** with a Diagnostic ID displayed
2. **Click "Copy Diagnostics"** to copy the full JSON trace
3. **Paste the JSON into chat** so I can analyze:
   - Exact input data
   - Timing information
   - Browser context
   - Error messages
4. **Optionally**: Check Supabase Dashboard → Edge Functions → create-staff-account → Logs, filter by the Diagnostic ID to see server-side step execution

---

## Example Diagnostic Output

```json
{
  "diagnosticId": "staff-create-1707334567890-a1b2c3",
  "timestamp": "2026-02-07T15:36:07.890Z",
  "input": {
    "email": "newstaff@example.com",
    "firstName": "Test",
    "lastName": "User",
    "specialty": "Mental Health",
    "roles": ["CLINICIAN"],
    "tenantId": "00000000-0000-0000-0000-000000000001"
  },
  "response": {
    "success": false,
    "error": "FunctionsHttpError: Edge Function returned a non-2xx status code",
    "httpStatus": 500
  },
  "timingMs": 1234,
  "browserInfo": {
    "userAgent": "Mozilla/5.0...",
    "url": "https://ehr-staff.lovable.app/staff/settings"
  }
}
```

---

## Why This Approach

1. **Correlation**: The diagnosticId links browser logs, exported diagnostics, and Supabase edge function logs together

2. **Works on Published Site**: You can copy diagnostics to clipboard and paste them to me, even without console access

3. **Non-Invasive**: Logging only activates during staff creation, no performance impact on normal usage

4. **Step-by-Step Visibility**: Edge function logs each of the 9 steps, so we'll know exactly which one failed

5. **Captures Silent Failures**: If the edge function never gets called (JWT issue, network error), the browser-side diagnostics will show `response: null`

---

## Files Modified

| File | Type | Description |
|------|------|-------------|
| `src/hooks/useAddStaff.ts` | Edit | Add diagnostic trace capture and export |
| `src/components/Settings/UserManagement/AddStaffDialog.tsx` | Edit | Add diagnostic ID display and "Copy Diagnostics" button |
| `supabase/functions/create-staff-account/index.ts` | Edit | Add step-by-step logging with diagnosticId |

---

## Success Criteria

After implementation, when you attempt to add a staff member:
1. You see a Diagnostic ID in the success/error message
2. If it fails, you can click "Copy Diagnostics" and paste the JSON
3. The JSON shows exactly what was sent and what came back
4. Supabase logs show step-by-step execution with the same Diagnostic ID
5. Together, these will reveal exactly where and why the process failed

