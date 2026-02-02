
# Fix Login Issues for `info+dummy@valorwell.org`

## Problem Summary

You've created a staff account using the "Add Staff" dialog, but something went wrong during the creation process. The auth user exists in Supabase Auth, but the supporting records in the application database are missing or incomplete.

**Evidence from Console Logs:**
```
{"level":"error","category":"role_detection","message":"Tenant membership not found","userId":"990c998a-3cc7-4445-99eb-b2d03a4e7f9b"}
```

This means:
1. The user CAN authenticate (password works at Supabase level)
2. The app then tries to load their profile/tenant data and fails
3. Without tenant membership, the app can't determine their role and blocks access

**Additionally:** The password reset link redirects to `/reset-password`, but this route doesn't exist in the app (causing a 404).

---

## Technical Root Cause

The `create-staff-account` edge function creates records in this order:
1. `auth.users` (auth user)
2. `profiles` (application profile)
3. `tenant_memberships` (tenant association)
4. `user_roles` (role assignment)
5. `staff` (staff record)
6. `staff_role_assignments` (staff roles)

If any step fails, the function attempts rollback, but if it partially failed or timed out, you can end up with an orphaned auth user.

---

## Implementation Plan

### Part 1: Fix Missing Password Reset Route

**Problem:** Password reset emails redirect to `/reset-password` which doesn't exist.

**Solution:** Add a route that either:
- Handles the reset flow directly, OR
- Redirects to `/auth` where the reset token can be processed

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/reset-password` route that redirects to `/auth` with the hash parameters preserved |
| `src/pages/Auth.tsx` | Add logic to detect password reset token in URL and show password update form |

### Part 2: Repair the Orphaned User Data

Since the auth user exists but supporting records are missing, we need to insert the missing records manually.

**Records to Create:**

1. **tenant_memberships** - Associate user with ValorWell tenant
2. **user_roles** - Assign 'staff' role
3. **staff** - Create staff record with status 'Invited'
4. **staff_role_assignments** - Assign selected staff roles

**User ID:** `990c998a-3cc7-4445-99eb-b2d03a4e7f9b`
**Tenant ID:** `00000000-0000-0000-0000-000000000001` (ValorWell default)

### Part 3: Prevent Future Orphans (Optional Enhancement)

Add better error handling to the edge function to ensure atomic operations, or add a "Repair User" utility for admins.

---

## Detailed Changes

### Step 1: Add Reset Password Route

In `src/App.tsx`, add a route that handles the `/reset-password` path:

```typescript
// Add route for password reset redirect
<Route path="/reset-password" element={<Navigate to="/auth" replace />} />
```

The reset token is passed via URL hash (`#access_token=...`), which is preserved during navigation. The Auth page already handles `SIGNED_IN` events from token-based auth.

### Step 2: Enhance Auth Page for Password Reset Flow

In `src/pages/Auth.tsx`, detect when user arrives with a recovery token and show a "Set New Password" form instead of login.

### Step 3: Insert Missing Database Records

Execute SQL to repair the orphaned user (via Supabase SQL Editor):

```sql
-- 1. Ensure profile exists (upsert to handle if trigger created partial record)
INSERT INTO profiles (id, email, is_active, email_verified)
VALUES (
  '990c998a-3cc7-4445-99eb-b2d03a4e7f9b',
  'info+dummy@valorwell.org',
  true,
  true
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create tenant membership
INSERT INTO tenant_memberships (tenant_id, profile_id, tenant_role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '990c998a-3cc7-4445-99eb-b2d03a4e7f9b',
  'member'
)
ON CONFLICT (tenant_id, profile_id) DO NOTHING;

-- 3. Create user role
INSERT INTO user_roles (user_id, role)
VALUES (
  '990c998a-3cc7-4445-99eb-b2d03a4e7f9b',
  'staff'
)
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Create staff record
INSERT INTO staff (tenant_id, profile_id, prov_name_f, prov_name_l, prov_status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '990c998a-3cc7-4445-99eb-b2d03a4e7f9b',
  'Dummy',
  'User',
  'Invited'
)
ON CONFLICT (profile_id, tenant_id) DO NOTHING;
```

---

## Files to Modify

| File | Changes |
|------|--------|
| `src/App.tsx` | Add `/reset-password` route |
| `src/pages/Auth.tsx` | Handle password recovery token detection and new password form |
| Database (SQL) | Insert missing records for user `990c998a-3cc7-4445-99eb-b2d03a4e7f9b` |

---

## Verification Steps

After implementation:

1. Run the SQL repair script in Supabase SQL Editor
2. Try logging in with `info+dummy@valorwell.org` and the password shown during creation
3. If password unknown, use "Forgot Password" - the reset link should now work
4. Verify user lands on `/staff/registration` (since `prov_status = 'Invited'`)

---

## Optional: Future Prevention

Consider adding a "Repair Orphaned Users" admin tool that:
1. Finds auth users without matching tenant_memberships
2. Allows admins to complete the missing records
3. Prevents this manual SQL intervention in the future
