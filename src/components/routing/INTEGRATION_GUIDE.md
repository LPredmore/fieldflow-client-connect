# UnifiedRoutingGuard Integration Guide

This guide explains how to integrate the UnifiedRoutingGuard into the application (Task 5.2).

## Overview

The UnifiedRoutingGuard is now complete and ready for integration. It provides:
- Single routing decision point
- Access control enforcement
- Redirect loop prevention
- Error handling with recovery

## Integration Steps

### Step 1: Wrap Routes with UnifiedRoutingGuard

In `src/App.tsx`, wrap the `<Routes>` component with `<UnifiedRoutingGuard>`:

```tsx
import { UnifiedRoutingGuard } from '@/components/routing';

// Inside the BrowserRouter
<BrowserRouter>
  <NavigationManager />
  <UnifiedRoutingGuard>
    <Routes>
      {/* All your routes */}
    </Routes>
  </UnifiedRoutingGuard>
</BrowserRouter>
```

### Step 2: Update AuthProvider

Replace the old `AuthProvider` from `@/hooks/useAuth` with the new `AuthenticationProvider`:

```tsx
// Old import (remove)
import { AuthProvider } from "@/hooks/useAuth";

// New import (add)
import { AuthenticationProvider } from "@/providers/AuthenticationProvider";

// In the component tree
<AuthenticationProvider>
  <PermissionProvider>
    {/* rest of the app */}
  </PermissionProvider>
</AuthenticationProvider>
```

### Step 3: Remove Hardcoded Root Redirect

The UnifiedRoutingGuard will handle routing, so remove the hardcoded redirect:

```tsx
// Remove this line:
<Route path="/" element={<Navigate to="/staff/dashboard" replace />} />

// Replace with a simple route that lets the guard handle it:
<Route path="/" element={<div />} />
```

Or simply remove it entirely - the guard will redirect appropriately.

### Step 4: Verify Public Routes

Ensure public routes are accessible without authentication:

```tsx
{/* These should remain as-is */}
<Route path="/auth" element={<Auth />} />
<Route path="/public-invoice/:token" element={
  <Suspense fallback={<PageLoadingFallback />}>
    <PublicInvoice />
  </Suspense>
} />
```

The guard recognizes these as public routes and won't redirect.

## Expected Behavior After Integration

### For Unauthenticated Users
- Accessing any protected route → Redirected to `/auth`
- Accessing public routes → Allowed

### For Client Users
- After login → Redirected to `/client/dashboard`
- Accessing `/client/*` → Allowed
- Accessing `/staff/*` → Redirected to `/client/dashboard`

### For Clinical Staff
- After login → Redirected to `/staff/registration`
- Accessing `/staff/registration` → Allowed
- Accessing other routes → Redirected to `/staff/registration`

### For Non-Clinical Staff
- After login → Redirected to `/staff/dashboard`
- Accessing `/staff/*` (except registration) → Allowed
- Accessing `/client/*` → Redirected to `/staff/dashboard`

## Testing Checklist

After integration, test the following scenarios:

- [ ] Login as client user → redirects to `/client/dashboard`
- [ ] Login as clinical staff → redirects to `/staff/registration`
- [ ] Login as non-clinical staff → redirects to `/staff/dashboard`
- [ ] Try accessing wrong portal → redirected back
- [ ] Refresh page while logged in → stays on correct page
- [ ] Logout → redirected to `/auth`
- [ ] No redirect loops in console
- [ ] No duplicate queries in network tab

## Troubleshooting

### Redirect Loops
If you see redirect loops:
1. Check browser console for `[UnifiedRoutingGuard]` logs
2. Verify user role data is correct
3. Check if there are competing routing components
4. The guard will show an error page after 3 redirects

### Not Redirecting
If redirects aren't happening:
1. Verify `AuthenticationProvider` is wrapping the app
2. Check that user data is loading correctly
3. Look for `[UnifiedRoutingGuard] Routing decision` logs
4. Verify the guard is wrapping the Routes component

### Wrong Portal
If users are sent to the wrong portal:
1. Check user role in console logs
2. Verify `is_clinician` flag for staff users
3. Check the `determineRoute()` logic in UnifiedRoutingGuard.tsx

## Next Steps

After integration (Task 5):
1. Task 6: Audit and remove competing authentication logic
2. Task 7: Add monitoring and debugging tools
3. Task 8: Testing and validation
4. Task 9: Documentation and cleanup

## Support

For issues or questions:
- Check the README.md in this directory
- Review the design document at `.kiro/specs/unified-auth-routing-rebuild/design.md`
- Check console logs for debugging information
