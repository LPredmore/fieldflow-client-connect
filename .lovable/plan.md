

# Consent Templates: Default Templates as Blueprints Only

## Summary

Change the consent system so that system-level templates (where `tenant_id IS NULL`) serve purely as starting-point blueprints. They are never directly sent to clients. A tenant must customize (copy) a default template and mark it active + required before it appears in the client portal.

## Current Problem

The database currently has this state:

| consent_type | tenant_id | is_active | is_required | Role |
|---|---|---|---|---|
| financial_agreement | NULL | true | true | System default |
| financial_agreement | tenant | true | **false** | Customized copy |
| telehealth_informed_consent | NULL | true | true | System default |
| telehealth_informed_consent | tenant | true | **false** | Customized copy |

The compliance hook (`useClientConsentStatus`) looks for tenant templates where `is_active = true AND is_required = true`. It finds none (because the customized copies have `is_required = false`), so it falls back to system defaults -- showing the generic versions instead of the customized ones.

## Architectural Change

**Remove the fallback entirely.** If a tenant has no customized required templates, the system shows nothing -- not system defaults. System defaults exist only as copyable blueprints visible to staff in the Form Library.

This means:
- Clients only ever see tenant-owned templates
- A tenant must explicitly customize and activate templates
- The "Required" toggle on tenant templates controls what clients must sign
- System defaults are read-only reference material in the staff UI

## Technical Changes

### 1. `useClientConsentStatus.tsx` -- Remove system default fallback

Remove lines 94-113 (the entire "fall back to system defaults" block). The hook will only query for tenant-specific templates where `is_active = true AND is_required = true`. If a tenant hasn't set any up, `consentStatuses` returns empty and `isFullyCompliant` returns `true` (vacuously -- no requirements means compliant).

### 2. `FormLibrary.tsx` -- Rename "System Defaults" to "Default Templates"

- Change the section heading from "System Defaults" to "Default Templates"
- Update the description text from "Templates you can customize for your practice" to "Starting-point templates. Customize a copy to make it available for your clients."
- The "Customize" button and "View" button remain the same

### 3. `ConsentEditor.tsx` -- Update system default messaging

- Change the card title from "View System Template" to "View Default Template"
- Change the description from "This is a system default template. Click 'Customize' to create your own version." to "This is a default template. Customize a copy to use it with your clients."

### 4. `useConsentTemplatesData.tsx` -- `customizeSystemDefault` sets `is_required: true`

When a tenant clicks "Customize" on a default template, the copy should be created with `is_required: true` (inheriting the default's intent) instead of the current `is_required: false`. The template is still created as `is_active: false` (draft), so it won't go live until the tenant publishes it. This prevents the common mistake of customizing a template but forgetting to toggle "Required."

### 5. Fix existing data

The two customized tenant templates that are currently `is_active: true` but `is_required: false` need to be updated to `is_required: true` so they start appearing for clients immediately. This will be done via a targeted SQL update scoped to the existing tenant.

## What This Does NOT Change

- The `consent_templates` table schema (no columns added/removed)
- How signatures are recorded in `client_telehealth_consents`
- The ConsentStatusCard or ClientFormsTab components
- Any RLS policies

## File Summary

| File | Change |
|---|---|
| `src/hooks/useClientConsentStatus.tsx` | Remove system default fallback (lines 94-113) |
| `src/components/Forms/FormLibrary/FormLibrary.tsx` | Rename "System Defaults" heading and description |
| `src/components/Forms/ConsentEditor/ConsentEditor.tsx` | Update system default label text |
| `src/hooks/forms/useConsentTemplatesData.tsx` | Set `is_required: true` in `customizeSystemDefault` |
| SQL migration | Update existing tenant templates to `is_required = true` |
