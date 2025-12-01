# Unified Routing System

This directory contains the unified routing guard system that enforces access control and routing decisions based on user authentication and roles.

## Components

### UnifiedRoutingGuard

The single routing decision component that replaces all competing routing logic in the application.

**Purpose:**
- Enforces access control based on user roles
- Performs redirects to appropriate portals
- Prevents redirect loops
- Handles routing errors gracefully

**Usage:**

```tsx
import { UnifiedRoutingGuard } from '@/components/routing';

function App() {
  return (
    <AuthenticationProvider>
      <BrowserRouter>
        <UnifiedRoutingGuard>
          <Routes>
            {/* Your routes here */}
          </Routes>
        </UnifiedRoutingGuard>
      </BrowserRouter>
    </AuthenticationProvider>
  );
}
```

**Routing Rules:**

1. **Unauthenticated Users** → `/auth`
   - Exception: Public routes (e.g., `/public-invoice/*`)

2. **Client Users** (`role='client'`) → `/client/dashboard`
   - Can access: `/client/*` routes
   - Cannot access: `/staff/*` routes

3. **Clinical Staff** (`role='staff'`, `is_clinician=true`) → `/staff/registration`
   - Can only access: `/staff/registration`
   - Cannot access: Other staff routes or client routes

4. **Non-Clinical Staff** (`role='staff'`, `is_clinician=false`) → `/staff/dashboard`
   - Can access: `/staff/*` routes (except `/staff/registration`)
   - Cannot access: `/client/*` routes

**Redirect Loop Prevention:**

The guard implements multiple layers of protection against redirect loops:

- **Cooldown Period**: 100ms minimum between redirects
- **Rate Limiting**: Maximum 3 redirects per 5-second window
- **Error Page**: Shows error page if limit exceeded with reset option

**Error Handling:**

The guard handles various error scenarios:

- **Authentication Errors**: Redirects to `/auth`
- **Role Detection Failures**: Shows error page with reset option
- **Redirect Loops**: Shows error page with recovery options
- **Session Expiration**: Redirects to `/auth`

### RoutingErrorPage

Displays user-friendly error messages for routing failures with recovery options.

**Features:**
- Clear error messaging
- Reset and retry functionality
- Technical details in development mode
- Multiple recovery options

### RoutingDebugPanel

Development-only component that displays current routing state for debugging.

**Features:**
- Shows current path and auth status
- Displays user role and attributes
- Shows expected route based on role
- Displays any errors
- Only renders in development mode

**Usage:**

```tsx
import { RoutingDebugPanel } from '@/components/routing';

function App() {
  return (
    <div>
      {/* Your app content */}
      <RoutingDebugPanel />
    </div>
  );
}
```

## Requirements Satisfied

- **3.1**: Single routing decision component
- **3.2**: Routing logic for all user types
- **3.3**: Redirect loop prevention
- **3.4**: Error handling for routing failures
- **3.5**: Redirect rate limiting
- **3.6**: Redirect cooldown period
- **3.7**: Error page with clear messaging
- **3.8**: Cross-portal access prevention (client → staff)
- **3.9**: Cross-portal access prevention (staff → client)
- **7.6**: Logging of routing decisions

## Implementation Details

### Redirect Tracking

The guard maintains a history of redirects with timestamps to detect and prevent loops:

```typescript
interface RedirectHistoryEntry {
  path: string;
  timestamp: number;
}
```

### Routing Decision Logic

The `determineRoute()` function implements the core routing logic:

1. Check if user is authenticated
2. Check if current path is public
3. Determine user role (client vs staff)
4. For staff, check clinician status
5. Apply appropriate routing rules
6. Return redirect decision

### Performance Considerations

- Minimal re-renders using refs for redirect tracking
- Efficient history cleanup (removes old entries)
- Fast path matching using string operations
- No unnecessary state updates

## Testing

To test the routing guard:

1. **Test as Client User**:
   - Login as client
   - Verify redirect to `/client/dashboard`
   - Try accessing `/staff/*` routes
   - Verify redirect back to `/client/dashboard`

2. **Test as Clinical Staff**:
   - Login as clinical staff (`is_clinician=true`)
   - Verify redirect to `/staff/registration`
   - Try accessing other staff routes
   - Verify redirect back to `/staff/registration`

3. **Test as Non-Clinical Staff**:
   - Login as non-clinical staff (`is_clinician=false`)
   - Verify redirect to `/staff/dashboard`
   - Try accessing `/client/*` routes
   - Verify redirect back to `/staff/dashboard`

4. **Test Redirect Loop Prevention**:
   - Trigger multiple rapid redirects
   - Verify error page appears after limit
   - Test reset functionality

5. **Test Error Handling**:
   - Simulate role detection failure
   - Verify error page displays
   - Test recovery options

## Debugging

Enable debug logging by checking the browser console:

```
[UnifiedRoutingGuard] Determining route
[UnifiedRoutingGuard] Routing decision
[UnifiedRoutingGuard] Executing redirect
[UnifiedRoutingGuard] Redirect recorded
```

In development mode, the RoutingErrorPage shows technical details for debugging.
