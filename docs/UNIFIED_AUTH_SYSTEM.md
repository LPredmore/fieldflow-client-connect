# Unified Authentication System - Developer Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [Using AuthenticationProvider](#using-authenticationprovider)
5. [Accessing User Data](#accessing-user-data)
6. [Error Handling](#error-handling)
7. [Common Scenarios](#common-scenarios)
8. [Troubleshooting](#troubleshooting)
9. [API Reference](#api-reference)

## Overview

The Unified Authentication System provides a single, coordinated authentication flow that eliminates competing logic and prevents request stampedes. It replaces all previous authentication implementations with a centralized, reliable system.

### Key Features

- **Single Authentication Flow**: One coordinated flow from login to dashboard
- **Unified Role Detection**: Single source of truth for user roles and permissions
- **Request Deduplication**: Prevents duplicate database queries
- **Circuit Breaker Protection**: Automatic recovery from failures
- **Session Management**: Persistent sessions across page refreshes
- **Redirect Loop Prevention**: Built-in protection against infinite redirects

### User Types

The system supports two primary user types:

1. **Client Users** (`role='client'`)
   - Access `/client/*` routes
   - Redirected to `/client/dashboard` after login

2. **Staff Users** (`role='staff'`)
   - **Clinical Staff** (`is_clinician=true`): Redirected to `/staff/registration`
   - **Non-Clinical Staff** (`is_clinician=false`): Redirected to `/staff/dashboard`
   - May have admin privileges (`is_admin=true`)

## Architecture

### Component Hierarchy

```
Application Root
└── AuthenticationProvider (manages auth state)
    └── UnifiedRoutingGuard (enforces routing rules)
        └── Your Application Routes
```

### Core Services

1. **UnifiedRoleDetectionService**: Determines user roles and attributes
2. **SessionCacheService**: Manages cached user data
3. **CircuitBreakerRecoveryService**: Handles failure recovery
4. **QueryDeduplicator**: Prevents duplicate queries

### Authentication Flow

```
User Login
    ↓
Supabase Authentication
    ↓
Load User Data (deduplicated)
    ↓
Detect User Role
    ↓
Cache User Data
    ↓
Routing Guard Redirects
    ↓
User Dashboard
```

## Getting Started

### Installation

The unified authentication system is already integrated into the application. No additional installation is required.

### Basic Setup

The system is already configured in `src/App.tsx`:

```tsx
import { AuthenticationProvider } from '@/providers';
import { UnifiedRoutingGuard } from '@/components/routing';

function App() {
  return (
    <AuthenticationProvider>
      <BrowserRouter>
        <UnifiedRoutingGuard>
          <Routes>
            {/* Your routes */}
          </Routes>
        </UnifiedRoutingGuard>
      </BrowserRouter>
    </AuthenticationProvider>
  );
}
```

## Using AuthenticationProvider

### Importing the Hook

```tsx
import { useAuth } from '@/contexts';
```

### Available Methods and Properties

```tsx
const {
  user,              // Current user object or null
  isLoading,         // Loading state
  error,             // Error object or null
  login,             // Login function
  logout,            // Logout function
  resetAuth,         // Reset authentication state
  refreshUserData    // Refresh user data from database
} = useAuth();
```

### Login

```tsx
import { useAuth } from '@/contexts';

function LoginForm() {
  const { login, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await login(email, password);
      // User is now authenticated and redirected automatically
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isLoading}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
      {error && <div className="error">{error.message}</div>}
    </form>
  );
}
```

### Logout

```tsx
import { useAuth } from '@/contexts';

function LogoutButton() {
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      // User is logged out and redirected to /auth
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return <button onClick={handleLogout}>Logout</button>;
}
```

### Reset Authentication

Use this when you need to clear all cached data and reset the circuit breaker:

```tsx
import { useAuth } from '@/contexts';

function ResetButton() {
  const { resetAuth } = useAuth();

  const handleReset = async () => {
    try {
      await resetAuth();
      // Circuit breaker reset, cache cleared, user data reloaded
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  return <button onClick={handleReset}>Reset & Retry</button>;
}
```

### Refresh User Data

Use this to manually refresh user data from the database:

```tsx
import { useAuth } from '@/contexts';

function RefreshButton() {
  const { refreshUserData, isLoading } = useAuth();

  const handleRefresh = async () => {
    try {
      await refreshUserData();
      // User data refreshed
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  };

  return (
    <button onClick={handleRefresh} disabled={isLoading}>
      {isLoading ? 'Refreshing...' : 'Refresh Data'}
    </button>
  );
}
```

## Accessing User Data

### User Object Structure

```typescript
interface User {
  id: string;
  email: string;
  profile: UserProfile;
  role: 'staff' | 'client';
  staffAttributes?: StaffAttributes;
  permissions?: UserPermissions;
}

interface UserProfile {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  role: 'staff' | 'client';
  tenant_id: string;
  avatar_url: string | null;
  phone: string | null;
}

interface StaffAttributes {
  is_clinician: boolean;
  is_admin: boolean;
  clinician_status?: string;
}

interface UserPermissions {
  access_appointments: boolean;
  access_calendar: boolean;
  access_customers: boolean;
  access_forms: boolean;
  access_invoicing: boolean;
  access_services: boolean;
  access_settings: boolean;
  access_user_management: boolean;
  supervisor: boolean;
}
```

### Checking User Role

```tsx
import { useAuth } from '@/contexts';

function MyComponent() {
  const { user } = useAuth();

  if (!user) {
    return <div>Please log in</div>;
  }

  if (user.role === 'client') {
    return <ClientView />;
  }

  if (user.role === 'staff') {
    return <StaffView />;
  }

  return null;
}
```

### Checking Staff Attributes

```tsx
import { useAuth } from '@/contexts';

function StaffComponent() {
  const { user } = useAuth();

  if (!user || user.role !== 'staff') {
    return null;
  }

  const isClinician = user.staffAttributes?.is_clinician ?? false;
  const isAdmin = user.staffAttributes?.is_admin ?? false;

  return (
    <div>
      <h2>Staff Dashboard</h2>
      {isClinician && <p>You are a clinician</p>}
      {isAdmin && <p>You have admin privileges</p>}
    </div>
  );
}
```

### Checking Permissions

```tsx
import { useAuth } from '@/contexts';

function SettingsButton() {
  const { user } = useAuth();

  const canAccessSettings = user?.permissions?.access_settings ?? false;

  if (!canAccessSettings) {
    return null;
  }

  return <button>Settings</button>;
}
```

### Loading and Error States

```tsx
import { useAuth } from '@/contexts';

function MyComponent() {
  const { user, isLoading, error } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <p>Error: {error.message}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!user) {
    return <div>Please log in</div>;
  }

  return <div>Welcome, {user.profile.full_name}!</div>;
}
```

## Error Handling

### Error Types

The system defines several error types:

```typescript
enum AuthErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  ROLE_DETECTION_FAILED = 'ROLE_DETECTION_FAILED',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  REDIRECT_LOOP_DETECTED = 'REDIRECT_LOOP_DETECTED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DATA_FETCH_FAILED = 'DATA_FETCH_FAILED'
}
```

### Handling Errors

```tsx
import { useAuth } from '@/contexts';
import { AuthError, AuthErrorType } from '@/services/auth/AuthError';

function LoginForm() {
  const { login } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (email: string, password: string) => {
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof AuthError) {
        switch (err.type) {
          case AuthErrorType.NETWORK_ERROR:
            setErrorMessage('Network error. Please check your connection.');
            break;
          case AuthErrorType.AUTHENTICATION_FAILED:
            setErrorMessage('Invalid email or password.');
            break;
          case AuthErrorType.CIRCUIT_BREAKER_OPEN:
            setErrorMessage('Service temporarily unavailable. Please try again.');
            break;
          default:
            setErrorMessage(err.userMessage);
        }
      } else {
        setErrorMessage('An unexpected error occurred.');
      }
    }
  };

  return (
    <div>
      {/* Login form */}
      {errorMessage && <div className="error">{errorMessage}</div>}
    </div>
  );
}
```

### Automatic Error Recovery

The system automatically handles:

- **Network Errors**: Retries with exponential backoff (up to 3 attempts)
- **Circuit Breaker**: Opens after 3 consecutive failures, shows recovery UI
- **Session Expiration**: Automatically redirects to login

### Manual Error Recovery

For circuit breaker errors, use the `resetAuth()` method:

```tsx
import { useAuth } from '@/contexts';

function ErrorRecovery() {
  const { error, resetAuth } = useAuth();

  if (!error) return null;

  return (
    <div className="error-recovery">
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={resetAuth}>Reset & Retry</button>
    </div>
  );
}
```

## Common Scenarios

### Scenario 1: Displaying User Profile

```tsx
import { useAuth } from '@/contexts';

function UserProfile() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <div>Not logged in</div>;

  return (
    <div className="profile">
      <img src={user.profile.avatar_url || '/default-avatar.png'} alt="Avatar" />
      <h2>{user.profile.full_name}</h2>
      <p>{user.email}</p>
      <p>Role: {user.role}</p>
      {user.staffAttributes && (
        <div>
          <p>Clinician: {user.staffAttributes.is_clinician ? 'Yes' : 'No'}</p>
          <p>Admin: {user.staffAttributes.is_admin ? 'Yes' : 'No'}</p>
        </div>
      )}
    </div>
  );
}
```

### Scenario 2: Conditional Rendering Based on Permissions

```tsx
import { useAuth } from '@/contexts';

function AdminPanel() {
  const { user } = useAuth();

  const isAdmin = user?.staffAttributes?.is_admin ?? false;
  const canManageUsers = user?.permissions?.access_user_management ?? false;

  if (!isAdmin && !canManageUsers) {
    return <div>Access denied</div>;
  }

  return (
    <div className="admin-panel">
      <h2>Admin Panel</h2>
      {canManageUsers && <UserManagement />}
      {/* Other admin features */}
    </div>
  );
}
```

### Scenario 3: Protecting a Component

```tsx
import { useAuth } from '@/contexts';
import { Navigate } from 'react-router-dom';

function ProtectedComponent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <div>Protected content</div>;
}
```

### Scenario 4: Role-Specific Navigation

```tsx
import { useAuth } from '@/contexts';
import { Link } from 'react-router-dom';

function Navigation() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <nav>
      {user.role === 'client' && (
        <>
          <Link to="/client/dashboard">Dashboard</Link>
          <Link to="/client/appointments">Appointments</Link>
        </>
      )}
      {user.role === 'staff' && (
        <>
          <Link to="/staff/dashboard">Dashboard</Link>
          {user.staffAttributes?.is_clinician && (
            <Link to="/staff/registration">Registration</Link>
          )}
          {user.permissions?.access_calendar && (
            <Link to="/staff/calendar">Calendar</Link>
          )}
        </>
      )}
    </nav>
  );
}
```

### Scenario 5: Handling Session Expiration

```tsx
import { useAuth } from '@/contexts';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function SessionMonitor() {
  const { user, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (error && error.message.includes('session')) {
      // Session expired
      navigate('/auth', { 
        state: { message: 'Your session has expired. Please log in again.' }
      });
    }
  }, [error, navigate]);

  return null;
}
```

## Troubleshooting

### Issue: User data not loading

**Symptoms**: `user` is always `null` even after login

**Solutions**:
1. Check browser console for errors
2. Verify Supabase connection is working
3. Check that `AuthenticationProvider` wraps your app
4. Verify user exists in `profiles` table
5. Check network tab for failed queries

### Issue: Redirect loops

**Symptoms**: Page keeps redirecting, console shows multiple redirect logs

**Solutions**:
1. The system automatically detects and stops redirect loops after 3 attempts
2. Check that you're not manually redirecting in components
3. Verify routing logic in `UnifiedRoutingGuard`
4. Clear browser cache and sessionStorage
5. Use the "Reset & Retry" button when error page appears

### Issue: Circuit breaker open

**Symptoms**: Error message "Service temporarily unavailable"

**Solutions**:
1. Click "Reset & Retry" button
2. Check network connection
3. Verify Supabase is accessible
4. Wait 30 seconds for automatic recovery
5. Check browser console for underlying errors

### Issue: Permissions not working

**Symptoms**: User can't access features they should have access to

**Solutions**:
1. Verify `user_permissions` record exists for the user
2. Check permission flags in database
3. Call `refreshUserData()` to reload permissions
4. Verify permission checks in your code use optional chaining (`?.`)

### Issue: Staff attributes missing

**Symptoms**: `user.staffAttributes` is undefined for staff users

**Solutions**:
1. Verify `clinicians` record exists for the user
2. Check `user_id` matches between `profiles` and `clinicians` tables
3. Call `refreshUserData()` to reload data
4. Check browser console for role detection errors

### Debugging Tools

#### Enable Debug Logging

In development mode, the system logs all authentication flow steps:

```
[AuthenticationProvider] Login started
[RoleDetectionService] Detecting role for user: abc123
[RoleDetectionService] Role detected: staff
[SessionCacheService] Cached user data
[UnifiedRoutingGuard] Routing decision: redirect to /staff/dashboard
```

#### Use AuthDebugPanel

In development mode, add the debug panel to see current auth state:

```tsx
import { AuthDebugPanel } from '@/components/auth';

function App() {
  return (
    <div>
      {/* Your app */}
      <AuthDebugPanel />
    </div>
  );
}
```

#### Check SessionStorage

Open browser DevTools > Application > Session Storage and look for:
- `user:*` - Cached user data
- `role:*` - Cached role context

#### Clear All Auth State

```tsx
const { resetAuth } = useAuth();
await resetAuth();
```

Or manually:
```javascript
sessionStorage.clear();
window.location.reload();
```

## API Reference

### useAuth Hook

```typescript
function useAuth(): AuthenticationContextValue
```

Returns the authentication context with the following properties:

#### Properties

- **user**: `User | null` - Current authenticated user or null
- **isLoading**: `boolean` - True while authentication is in progress
- **error**: `Error | null` - Current error or null

#### Methods

- **login(email: string, password: string): Promise<void>**
  - Authenticates user with email and password
  - Loads user data and caches it
  - Throws `AuthError` on failure

- **logout(): Promise<void>**
  - Logs out current user
  - Clears all cached data
  - Redirects to `/auth`

- **resetAuth(): Promise<void>**
  - Resets circuit breaker state
  - Clears all cached data
  - Reloads user data
  - Use for error recovery

- **refreshUserData(): Promise<void>**
  - Reloads user data from database
  - Updates cache
  - Use when user data may have changed

### User Type

```typescript
interface User {
  id: string;
  email: string;
  profile: UserProfile;
  role: 'staff' | 'client';
  staffAttributes?: StaffAttributes;
  permissions?: UserPermissions;
}
```

### AuthError Class

```typescript
class AuthError extends Error {
  type: AuthErrorType;
  recoverable: boolean;
  userMessage: string;
  technicalDetails: any;
}
```

### Error Types

```typescript
enum AuthErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  ROLE_DETECTION_FAILED = 'ROLE_DETECTION_FAILED',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  REDIRECT_LOOP_DETECTED = 'REDIRECT_LOOP_DETECTED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DATA_FETCH_FAILED = 'DATA_FETCH_FAILED'
}
```

## Additional Resources

- [Authentication Service README](../src/services/auth/README.md)
- [Routing System README](../src/components/routing/README.md)
- [Design Document](../.kiro/specs/unified-auth-routing-rebuild/design.md)
- [Requirements Document](../.kiro/specs/unified-auth-routing-rebuild/requirements.md)
- [Testing Guide](../src/test/UNIFIED_AUTH_TESTING_README.md)

## Support

For issues or questions:
- Check the troubleshooting section above
- Review console logs for debugging information
- Check the design and requirements documents
- Contact the development team
