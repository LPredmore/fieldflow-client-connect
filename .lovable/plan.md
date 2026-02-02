

# Implementation Plan: Fix "Completed Forms" Section to Display Actual Client Documents

## Problem Summary

The "Completed Forms" section on `/staff/clients/[clientId]` (Forms tab) shows "No completed form submissions yet" even when clients have completed documents. This happens because the UI queries only the `form_responses` table, which is empty, while actual client documents are stored in specialized tables.

### Database Reality

| Table | Purpose | Records for Client (Carson Pritchett) |
|-------|---------|--------------------------------------|
| `form_responses` | Dynamic form submissions (new system) | **0** |
| `client_history_forms` | Intake history questionnaire | **1** (submitted 2025-12-18) |
| `client_telehealth_consents` | Signed consent documents | **4** (treatment, HIPAA, financial, telehealth) |

### Consent Status Card Issue

The Consent Status card shows "0/0 Required" because:
- The hook queries `consent_templates` filtering `tenant_id = tenantId` AND `is_required = true`
- Tenant-specific templates exist but have `is_required = false`
- System defaults (`tenant_id = NULL`) have `is_required = true` but are excluded by the query

| consent_type | tenant_id | is_required | title |
|--------------|-----------|-------------|-------|
| financial_agreement | NULL (system) | **true** | Financial Agreement |
| hipaa_notice | NULL (system) | **true** | HIPAA Notice |
| telehealth_informed_consent | NULL (system) | **true** | Telehealth Informed Consent |
| treatment_consent | NULL (system) | **true** | Consent for Treatment |
| financial_agreement | tenant-uuid | **false** | Financial Agreement |
| telehealth_informed_consent | tenant-uuid | **false** | Telehealth Informed Consent |

---

## Technical Decision

**Extend `useClientDetail` to fetch from all three document sources and transform them into a unified display format. Additionally, fix `useClientConsentStatus` to use system defaults as the required consent baseline when tenant has no explicit required templates.**

### Why This Is the Right Approach

1. **Respects Existing Architecture**: Each document type has its own specialized table with domain-specific fields. This is correct database design - we should not try to migrate data into `form_responses`.

2. **Single Query Point**: Consolidating all document fetching in `useClientDetail` (which already handles multiple data sources) maintains the established pattern.

3. **Unified Display Model**: Creating a common `CompletedDocument` type allows the UI to render all documents consistently while preserving the ability to handle each type differently for viewing.

4. **System Defaults as Baseline**: The consent template architecture was designed with system defaults as blueprints. When a tenant hasn't customized consent requirements, the system defaults should be used for compliance tracking.

5. **No Database Changes**: Uses existing tables and relationships exactly as designed.

---

## Implementation Details

### Part 1: Fix the Completed Forms Section

#### 1.1 Create Unified Document Type

**File: `src/hooks/useClientDetail.tsx`**

Add a new type that can represent documents from any source:

```typescript
export interface CompletedDocument {
  id: string;
  source: 'form_response' | 'history_form' | 'consent';
  name: string;
  submittedAt: string;
  // Source-specific data for viewing
  sourceData: {
    type: 'form_response';
    data: FormResponseWithTemplate;
  } | {
    type: 'history_form';
    data: ClientHistoryForm;
  } | {
    type: 'consent';
    data: ClientTelehealthConsent;
  };
}
```

#### 1.2 Add Queries for Additional Document Sources

**File: `src/hooks/useClientDetail.tsx`**

Add queries for `client_history_forms` and `client_telehealth_consents`:

```text
New query for client_history_forms:
- Table: client_history_forms
- Select: id, client_id, submission_date, signature, created_at
- Filter: client_id = clientId, tenant_id = 'auto'
- Enabled when: activeTab === 'forms'

New query for client_telehealth_consents:
- Table: client_telehealth_consents
- Select: id, client_id, consent_template_key, signed_at, is_revoked
- Filter: client_id = clientId, is_revoked = false
- Enabled when: activeTab === 'forms'
```

#### 1.3 Transform into Unified Document List

**File: `src/hooks/useClientDetail.tsx`**

Create a `useMemo` that combines all sources into a single sorted list:

```text
const completedDocuments = useMemo(() => {
  const docs: CompletedDocument[] = [];
  
  // Add form_responses (dynamic forms)
  formResponses.forEach(response => {
    docs.push({
      id: response.id,
      source: 'form_response',
      name: response.form_template?.name || 'Form Submission',
      submittedAt: response.submitted_at,
      sourceData: { type: 'form_response', data: response }
    });
  });
  
  // Add client_history_forms (intake history)
  historyForms.forEach(form => {
    docs.push({
      id: form.id,
      source: 'history_form',
      name: 'Client History Intake Form',
      submittedAt: form.submission_date || form.created_at,
      sourceData: { type: 'history_form', data: form }
    });
  });
  
  // Add client_telehealth_consents (signed consents)
  consents.filter(c => !c.is_revoked).forEach(consent => {
    docs.push({
      id: consent.id,
      source: 'consent',
      name: formatConsentName(consent.consent_template_key),
      submittedAt: consent.signed_at,
      sourceData: { type: 'consent', data: consent }
    });
  });
  
  // Sort by date descending
  return docs.sort((a, b) => 
    new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}, [formResponses, historyForms, consents]);
```

#### 1.4 Update Return Value

**File: `src/hooks/useClientDetail.tsx`**

Export the new `completedDocuments` array and update loading state:

```text
return {
  ...existingReturns,
  completedDocuments,
  // Keep formResponses for backward compatibility
  formResponses: formResponses || [],
};
```

---

### Part 2: Update the UI Component

#### 2.1 Update ClientFormsTab Props

**File: `src/components/Clients/ClientDetail/ClientFormsTab.tsx`**

Accept `completedDocuments` instead of (or in addition to) `formResponses`:

```typescript
interface ClientFormsTabProps {
  loading: boolean;
  completedDocuments: CompletedDocument[];
  formAssignments: ClientFormAssignment[];
  // ... rest unchanged
}
```

#### 2.2 Update Completed Forms Table

**File: `src/components/Clients/ClientDetail/ClientFormsTab.tsx`**

Render documents with source indicator:

```text
{completedDocuments.map((doc) => (
  <TableRow key={doc.id}>
    <TableCell className="font-medium">
      <div className="flex items-center gap-2">
        {doc.name}
        <Badge variant="outline" className="text-xs">
          {doc.source === 'consent' ? 'Consent' : 
           doc.source === 'history_form' ? 'Intake' : 'Form'}
        </Badge>
      </div>
    </TableCell>
    <TableCell>
      {format(new Date(doc.submittedAt), 'MMM d, yyyy h:mm a')}
    </TableCell>
    <TableCell>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewDocument(doc)}
      >
        <Eye className="h-4 w-4" />
      </Button>
    </TableCell>
  </TableRow>
))}
```

#### 2.3 Handle Document Viewing

**File: `src/pages/ClientDetail.tsx`**

Add handler that routes to appropriate viewer based on document source:

```text
const handleViewDocument = (doc: CompletedDocument) => {
  switch (doc.sourceData.type) {
    case 'form_response':
      // Use existing form response viewer
      handleViewFormResponse(doc.sourceData.data);
      break;
    case 'history_form':
      // Open history form viewer (to be implemented or show in dialog)
      setViewingHistoryForm(doc.sourceData.data);
      break;
    case 'consent':
      // Show consent document (could be a simple dialog showing consent was signed)
      setViewingConsent(doc.sourceData.data);
      break;
  }
};
```

---

### Part 3: Fix Consent Status Card

#### 3.1 Update Consent Templates Query

**File: `src/hooks/useClientConsentStatus.tsx`**

Modify the query to fall back to system defaults when tenant has no required templates:

```text
Current logic (broken):
  Query consent_templates WHERE tenant_id = tenantId AND is_required = true
  Result: 0 templates (tenant templates exist but is_required = false)

New logic:
  1. Query tenant-specific required templates first
  2. If none found, fall back to system defaults (tenant_id IS NULL AND is_required = true)
  
This matches the documented design where system defaults serve as blueprints.
```

```typescript
// Step 1: Check for tenant-specific required templates
const { data: tenantTemplates } = await supabase
  .from('consent_templates')
  .select('consent_type, title, is_required, required_for')
  .eq('tenant_id', tenantId)
  .eq('is_active', true)
  .eq('is_required', true);

let consentsFromDb: RequiredConsent[];

if (tenantTemplates && tenantTemplates.length > 0) {
  // Tenant has explicit required templates - use those
  consentsFromDb = tenantTemplates.map(t => ({...}));
} else {
  // Fall back to system defaults
  const { data: systemDefaults } = await supabase
    .from('consent_templates')
    .select('consent_type, title, is_required, required_for')
    .is('tenant_id', null)
    .eq('is_active', true)
    .eq('is_required', true);
  
  consentsFromDb = (systemDefaults || []).map(t => ({...}));
}
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useClientDetail.tsx` | **Modify** | Add queries for history forms and consents; create unified document list |
| `src/components/Clients/ClientDetail/ClientFormsTab.tsx` | **Modify** | Display unified documents with source badges |
| `src/pages/ClientDetail.tsx` | **Modify** | Handle viewing for different document types |
| `src/hooks/useClientConsentStatus.tsx` | **Modify** | Fall back to system default templates for compliance |

---

## Data Flow After Implementation

```text
ClientDetail page loads → activeTab = 'forms'
         │
         ▼
useClientDetail fetches:
  ├── form_responses (0 records)
  ├── client_history_forms (1 record: Intake Form)
  └── client_telehealth_consents (4 records: signed consents)
         │
         ▼
useMemo combines into completedDocuments[]:
  [
    { name: "Telehealth Informed Consent", source: "consent", ... },
    { name: "Financial Agreement", source: "consent", ... },
    { name: "HIPAA Notice", source: "consent", ... },
    { name: "Consent for Treatment", source: "consent", ... },
    { name: "Client History Intake Form", source: "history_form", ... },
  ]
         │
         ▼
ClientFormsTab renders:
  ┌─────────────────────────────────────────────────────────────┐
  │ ✓ Completed Forms                                    [5]    │
  ├─────────────────────────────────────────────────────────────┤
  │ Telehealth Informed Consent  [Consent]  Jan 28, 2026  👁    │
  │ Financial Agreement          [Consent]  Jan 28, 2026  👁    │
  │ HIPAA Notice                 [Consent]  Jan 28, 2026  👁    │
  │ Consent for Treatment        [Consent]  Jan 23, 2026  👁    │
  │ Client History Intake Form   [Intake]   Dec 18, 2025  👁    │
  └─────────────────────────────────────────────────────────────┘
```

```text
useClientConsentStatus loads → tenant has no is_required=true templates
         │
         ▼
Falls back to system defaults (4 required consents)
         │
         ▼
Matches against client_telehealth_consents (4 signed)
         │
         ▼
ConsentStatusCard renders:
  ┌──────────────────────────────────────┐
  │ 🛡️ Consent Status        [4/4 Required] │
  ├──────────────────────────────────────┤
  │ ✓ Consent for Treatment  Signed Jan 23  │
  │ ✓ HIPAA Notice           Signed Jan 28  │
  │ ✓ Financial Agreement    Signed Jan 28  │
  │ ✓ Telehealth Consent     Signed Jan 28  │
  └──────────────────────────────────────┘
```

---

## What This Does NOT Change

- **Database schema**: No changes (immutable constraint respected)
- **`form_responses` table**: Still used for dynamic forms when they exist
- **ResponseDetailDialog**: Continues to work for form_response documents
- **Consent signature storage**: `client_telehealth_consents` remains the source of truth
- **History form storage**: `client_history_forms` remains the source of truth

---

## Testing Checklist

1. **Completed Forms Display**
   - [ ] Client with history form shows "Client History Intake Form" in list
   - [ ] Client with signed consents shows each consent as separate row
   - [ ] Client with form_responses shows those as well
   - [ ] Documents sorted by date (newest first)
   - [ ] Source badges display correctly (Consent, Intake, Form)

2. **Consent Status Card**
   - [ ] Shows "4/4 Required" for client with all consents signed
   - [ ] Each consent row shows ✓ with signed date
   - [ ] Badge shows green "4/4 Required" for compliant clients

3. **Document Viewing**
   - [ ] Clicking eye icon on form_response opens ResponseDetailDialog
   - [ ] Clicking eye icon on consent shows consent details
   - [ ] Clicking eye icon on history form shows intake form data

4. **Edge Cases**
   - [ ] Client with no documents shows "No completed form submissions yet"
   - [ ] Client with only consents but no history form shows only consents
   - [ ] Revoked consents are excluded from completed forms list

