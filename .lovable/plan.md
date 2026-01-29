

# Make System Defaults Template-Only, Enable "Required" Toggle for Your Templates

## Problem Summary

Currently, the consent template system has a design flaw:

1. **System Defaults** have `is_required = true` in the database
2. When you click "Customize" on a System Default, it creates a tenant copy with `is_required = false`
3. The compliance check in `useClientConsentStatus.tsx` queries for templates where `is_required = true`
4. Since both System Defaults AND tenant templates are queried, and tenant templates have `is_required = false`, the **System Defaults still get assigned to clients** instead of the customized versions

**Current Database State:**
| Template | Tenant | is_required | Result |
|----------|--------|-------------|--------|
| Financial Agreement (System) | NULL | true | Gets assigned to clients |
| Financial Agreement (Custom) | ValorWell | false | Ignored |

## Desired Behavior

1. **System Defaults** are read-only blueprints - they should NEVER be assigned to clients
2. **Your Templates** (tenant-specific) are the only templates that can be marked as "Required"
3. When a user customizes a System Default, the UI should show a "Required" toggle
4. Only "Required" + "Active" tenant templates get assigned to new clients

## Technical Decision: Exclude System Defaults from Compliance Queries

**The Right Approach:**

1. **Modify the compliance query** to ONLY look at tenant-specific templates (`tenant_id IS NOT NULL`)
2. **Add a "Required" toggle** in the ConsentEditor for tenant templates
3. **Update the updateTemplate function** to persist `is_required` changes

**Why this is the correct design:**

- **Clear separation of concerns**: System defaults are blueprints; tenant templates are live documents
- **Tenant autonomy**: Each practice decides which consents are required for THEIR clients
- **No data migration needed**: System defaults stay as-is; they simply stop affecting assignments
- **Existing data model works**: `is_required` column already exists on the table

**Why NOT modify system defaults:**

- System defaults are shared across all tenants - changing them affects everyone
- Removing `is_required` from system defaults would break the UI badge display in the template library
- The current schema is correct; only the query logic needs adjustment

## Implementation Plan

### Step 1: Update Compliance Query Logic

**File:** `src/hooks/useClientConsentStatus.tsx`

Change the query from:
```typescript
// Current (queries both system defaults AND tenant templates)
.or(`tenant_id.is.null${tenantId ? `,tenant_id.eq.${tenantId}` : ''}`)
```

To:
```typescript
// New (queries ONLY tenant templates)
.eq('tenant_id', tenantId)
```

This single change means:
- System Defaults with `is_required = true` are **ignored** for compliance
- Only the tenant's own templates with `is_required = true` are used
- If a tenant hasn't created any "Required" templates, no consents will be required

### Step 2: Add "Required" Toggle to ConsentEditor

**File:** `src/components/Forms/ConsentEditor/ConsentEditor.tsx`

Add a new state variable and UI control:

```typescript
// New state (after isActive state)
const [isRequired, setIsRequired] = useState(template?.is_required || false);
```

Add a Switch component in the form settings area (for tenant templates only):

```text
[Toggle] Mark as Required
  └─ When enabled, this consent will be automatically required for all new clients
```

Update `handleSave` to include `is_required` in the save payload:

```typescript
await onSave({
  title,
  consent_type: consentType,
  content,
  is_active: publish ? true : isActive,
  is_required: isRequired,  // NEW
  version: (template?.version || 0) + 1,
});
```

### Step 3: Update the updateTemplate Function

**File:** `src/hooks/forms/useConsentTemplatesData.tsx`

The current `updateTemplate` function does NOT include `is_required` in the update payload. Add it:

```typescript
const { data: updated, error: updateError } = await supabase
  .from('consent_templates')
  .update({
    title: data.title,
    content: data.content,
    is_active: data.is_active,
    is_required: data.is_required,  // NEW
    version: data.version,
  })
  .eq('id', id)
  .select()
  .single();
```

### Step 4: Update createTemplate to Support is_required

**File:** `src/hooks/forms/useConsentTemplatesData.tsx`

Ensure new tenant templates can be created with `is_required`:

```typescript
.insert({
  tenant_id: tenantId,
  consent_type: data.consent_type || 'custom',
  title: data.title || 'Untitled Consent Form',
  content: data.content || { sections: [] },
  version: 1,
  is_active: data.is_active ?? false,
  is_required: data.is_required ?? false,  // NEW
  created_by_profile_id: user.id,
})
```

### Step 5: Update UI Labels in FormLibrary

**File:** `src/components/Forms/FormLibrary/FormLibrary.tsx`

Update the System Defaults section description to clarify they are templates only:

```text
System Defaults - "Templates you can customize for your practice"
```

Keep the "Required" badge on System Defaults for informational purposes (shows what's typically required industry-wide), but add a tooltip or note explaining it doesn't affect assignments.

## Data Flow After Implementation

```text
                                    ┌─────────────────────────┐
                                    │   consent_templates     │
                                    └─────────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                                                   │
          ┌─────────▼─────────┐                            ┌────────────▼────────────┐
          │  System Defaults   │                            │    Your Templates       │
          │  (tenant_id=NULL)  │                            │  (tenant_id=TENANT_ID)  │
          └───────────────────┘                            └─────────────────────────┘
                    │                                                   │
                    │                                       ┌───────────┴───────────┐
                    ▼                                       │                       │
         ┌──────────────────┐                    is_required=true        is_required=false
         │   IGNORED FOR    │                         │                       │
         │   ASSIGNMENTS    │                         ▼                       ▼
         └──────────────────┘               ┌──────────────────┐    ┌──────────────────┐
                                            │  Assigned to     │    │    Not assigned  │
                                            │  new clients     │    │    to clients    │
                                            └──────────────────┘    └──────────────────┘
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useClientConsentStatus.tsx` | Remove system defaults from compliance query (line 74) |
| `src/components/Forms/ConsentEditor/ConsentEditor.tsx` | Add `is_required` state, add toggle UI, include in save payload |
| `src/hooks/forms/useConsentTemplatesData.tsx` | Add `is_required` to both `createTemplate` and `updateTemplate` |
| `src/components/Forms/FormLibrary/FormLibrary.tsx` | Update System Defaults description text |

## Verification Steps

After implementation:

1. Go to Forms > Consent Templates
2. Click "Customize" on a System Default (e.g., Financial Agreement)
3. In the editor, verify you see a "Mark as Required" toggle
4. Enable the toggle and save/publish
5. Go to a client's Overview tab and check Consent Status
6. Verify the client sees YOUR template, not the System Default

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Tenant has no custom templates | No consents required (empty compliance list) |
| Tenant customizes but doesn't mark required | Template exists but not assigned |
| Multiple templates of same consent_type | Both can be required (query returns all matching) |
| Tenant deletes their custom template | No consents of that type required |

## No Database Migration Needed

The `is_required` column already exists on `consent_templates` with `DEFAULT false`. No schema changes required.

