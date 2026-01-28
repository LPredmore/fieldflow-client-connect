
# Restrict Settings, All Clients, and Forms Access to Admin/Account Owner Roles

## Overview

Modify the application so that only users with the `ADMIN` or `ACCOUNT_OWNER` staff roles (from `staff_role_assignments` table) can access three pages:
- **Settings** (`/staff/settings`)
- **All Clients** (`/staff/allclients`)
- **Forms** (`/staff/forms`)

## Current State Analysis

### Staff Roles in Database
The `staff_roles` table contains:
| Code | Name |
|------|------|
| `ACCOUNT_OWNER` | Account Owner |
| `ADMIN` | Admin |
| `BILLING` | Billing |
| `SUPERVISOR` | Clinical Supervisor |
| `CLINICIAN` | Clinician |
| `OFFICE` | Office Staff |
| `TELEHEALTH` | Telehealth |

### Current Access Control
- **Settings**: Uses `AppRouter allowedStates={['admin']}` - checks `user_roles.role = 'admin'`
- **All Clients**: Uses `AppRouter allowedStates={['admin']}` - same as above
- **Forms**: Uses `PermissionGuard requiredPermissions={['access_forms']}` - permission-based

### Problem
The current `isAdmin` flag comes from `user_roles` table (`role = 'admin'`), NOT from staff role assignments. We need to also check staff roles `ADMIN` and `ACCOUNT_OWNER` from `staff_role_assignments`.

## Implementation Approach

We will extend the existing permission/role checking system to include staff role-based access.

### Step 1: Add Staff Roles to Authentication Context

Modify `UnifiedRoleDetectionService.ts` to also fetch and store staff role codes in the user context:

```typescript
// Add to UserRoleContext interface:
staffRoleCodes?: string[];

// In fetchUserRoleData(), after fetching roleAssignments:
const staffRoleCodes = roleAssignments?.map((ra: any) => 
  // Need to also get the code from staff_roles
).filter(Boolean) || [];

// Include in roleContext:
staffRoleCodes,
```

Since the service already fetches `staff_role_assignments` to determine `is_clinical`, we'll extend it to also capture role codes.

### Step 2: Extend User Type with Staff Roles

Update `AuthenticationContext.tsx` to include staff role codes in the User type:

```typescript
// In StaffAttributes interface, add:
staffRoleCodes?: string[];
```

### Step 3: Add Helper Function for Staff Role Check

Create a utility function `hasStaffRole` in `permissionUtils.ts`:

```typescript
export const hasStaffRole = (
  staffRoleCodes: string[] | undefined, 
  requiredRoles: string[]
): boolean => {
  if (!staffRoleCodes || staffRoleCodes.length === 0) return false;
  return requiredRoles.some(role => 
    staffRoleCodes.includes(role.toUpperCase())
  );
};

export const isAdminOrAccountOwner = (staffRoleCodes: string[] | undefined): boolean => {
  return hasStaffRole(staffRoleCodes, ['ADMIN', 'ACCOUNT_OWNER']);
};
```

### Step 4: Add Permission Check to usePermissionChecks Hook

Extend `usePermissionChecks.tsx` to include staff role checks:

```typescript
// Import useAuth to get staff role codes
const { user } = useAuth();
const staffRoleCodes = user?.staffAttributes?.staffRoleCodes;

// Add to returned checks:
isAdminOrAccountOwner: isAdminOrAccountOwner(staffRoleCodes),
hasStaffRole: (roles: string[]) => hasStaffRole(staffRoleCodes, roles),
```

### Step 5: Update Navigation.tsx

Modify the navigation filtering to use the new role check instead of just `isAdmin`:

```typescript
// Add to imports:
import { isAdminOrAccountOwner } from '@/utils/permissionUtils';

// In NavigationContent:
const staffRoleCodes = user?.staffAttributes?.staffRoleCodes;
const canAccessAdminPages = isAdminOrAccountOwner(staffRoleCodes);

// Update filtering logic for requireAdmin items:
if ('requireAdmin' in item && item.requireAdmin && !canAccessAdminPages) {
  return null;
}

// Add new check for Forms:
if (item.name === 'Forms' && !canAccessAdminPages) {
  return null;
}
```

Also update navigation config to mark Forms as requiring admin access:

```typescript
// In navigation.ts, change Forms entry:
{ name: "Forms", href: STAFF_ROUTES.FORMS, icon: FileText, requireAdmin: true },
```

### Step 6: Update Route Protection in StaffPortalApp.tsx

Create a new guard component or modify existing guards to check staff roles:

```typescript
// For Forms route, replace PermissionGuard with role-based check:
<Route path="/forms" element={
  <StaffRoleGuard 
    requiredRoles={['ADMIN', 'ACCOUNT_OWNER']}
    fallbackMessage="You need Admin or Account Owner privileges to access Forms."
  >
    <Forms />
  </StaffRoleGuard>
} />
```

Or simpler: Reuse the existing pattern by modifying how `allowedStates` works, or check staff roles in a wrapper.

**Cleaner approach**: Since `isAdminOrAccountOwner` will be available in context, we can create a simple wrapper:

```typescript
const AdminOnlyRoute = ({ children, fallbackMessage }: { children: ReactNode, fallbackMessage: string }) => {
  const { user, isLoading } = useAuth();
  const staffRoleCodes = user?.staffAttributes?.staffRoleCodes;
  const canAccess = isAdminOrAccountOwner(staffRoleCodes);
  
  if (isLoading) {
    return <PageLoadingFallback />;
  }
  
  if (!canAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <p className="text-muted-foreground">{fallbackMessage}</p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
};
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/auth/UnifiedRoleDetectionService.ts` | Fetch and include `staffRoleCodes` in role context |
| `src/contexts/AuthenticationContext.tsx` | Add `staffRoleCodes` to `StaffAttributes` interface |
| `src/utils/permissionUtils.ts` | Add `hasStaffRole` and `isAdminOrAccountOwner` helpers |
| `src/hooks/permissions/usePermissionChecks.tsx` | Add `isAdminOrAccountOwner` and `hasStaffRole` to returned checks |
| `src/config/navigation.ts` | Change Forms to use `requireAdmin: true` |
| `src/components/Layout/Navigation.tsx` | Update filtering to use staff role check instead of `isAdmin` |
| `src/portals/StaffPortalApp.tsx` | Update Forms route to use staff role check; Settings and All Clients already use admin check but need to use staff role check |

## Sequence of Changes

1. **First**: Modify `UnifiedRoleDetectionService.ts` to fetch staff role codes alongside the existing `is_clinical` check (no new query - reuse existing data)

2. **Second**: Update `AuthenticationContext.tsx` interface to include `staffRoleCodes`

3. **Third**: Update `AuthenticationProvider.tsx` to pass `staffRoleCodes` to `staffAttributes`

4. **Fourth**: Add helper functions to `permissionUtils.ts`

5. **Fifth**: Update `usePermissionChecks.tsx` to expose new checks

6. **Sixth**: Update `navigation.ts` to mark Forms with `requireAdmin: true`

7. **Seventh**: Update `Navigation.tsx` to use new staff role check

8. **Eighth**: Update `StaffPortalApp.tsx` to use staff role checks for all three routes

## Technical Notes

- The `staff_role_assignments` query is already performed in `UnifiedRoleDetectionService` to determine `is_clinical` - we'll extract role codes from the same query
- No new database queries required
- Staff role codes will be cached along with other user data (1 hour TTL)
- The existing `isAdmin` flag (from `user_roles`) will still work for backward compatibility, but the new check will also include `ACCOUNT_OWNER` from staff roles
