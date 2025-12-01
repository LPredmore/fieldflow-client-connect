# Authentication System Implementation

## Overview

This directory contains the unified authentication system implementation for the application. The system provides a single, coordinated authentication flow that eliminates competing logic and prevents request stampedes.

## Components

### Core Services

#### 1. **UnifiedRoleDetectionService** (`UnifiedRoleDetectionService.ts`)
- Single source of truth for user role detection
- Determines user type (client vs staff) and staff attributes
- Integrates with SessionCacheService for caching
- Uses QueryDeduplicator to prevent duplicate queries

#### 2. **SessionCacheService** (`SessionCacheService.ts`)
- Manages cached user data for session duration
- Uses in-memory Map for fast access
- Syncs with sessionStorage for persistence across page refreshes
- Supports TTL (time-to-live) for cache entries

#### 3. **CircuitBreakerRecoveryService** (`CircuitBreakerRecoveryService.ts`)
- Implements circuit breaker pattern for fault tolerance
- Tracks failures and opens circuit when threshold is reached
- Provides automatic recovery with half-open state testing
- Supports manual reset for user-initiated recovery

#### 4. **QueryDeduplicator** (`QueryDeduplicator.ts`)
- Prevents duplicate database queries from executing simultaneously
- Queues duplicate requests and resolves them with same result
- Automatically cleans up completed queries

### Error Handling

#### **AuthError** (`AuthError.ts`)
- Custom error class for authentication operations
- Defines error types (NETWORK_ERROR, AUTHENTICATION_FAILED, etc.)
- Provides user-friendly error messages
- Supports error recovery strategies

#### **retryWithBackoff** (`retryWithBackoff.ts`)
- Utility for retrying failed operations with exponential backoff
- Configurable retry attempts and delays
- Integrates with AuthError for smart retry decisions

## Context and Provider

### **AuthenticationContext** (`src/contexts/AuthenticationContext.tsx`)
- React context for authentication state
- Defines User, StaffAttributes, and AuthenticationContextValue types
- Exports useAuth hook for consuming context

### **AuthenticationProvider** (`src/providers/AuthenticationProvider.tsx`)
- Top-level provider that manages authentication state
- Implements login, logout, resetAuth, and refreshUserData methods
- Handles Supabase auth session management
- Integrates all core services
- Provides error handling and retry logic

## Usage

### Basic Setup

```typescript
import { AuthenticationProvider } from '@/providers';
import { useAuth } from '@/contexts';

// Wrap your app with AuthenticationProvider
function App() {
  return (
    <AuthenticationProvider>
      <YourApp />
    </AuthenticationProvider>
  );
}

// Use authentication in components
function MyComponent() {
  const { user, isLoading, error, login, logout } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return <LoginForm onLogin={login} />;

  return (
    <div>
      <h1>Welcome, {user.profile.full_name}</h1>
      <p>Role: {user.role}</p>
      {user.staffAttributes && (
        <p>
          Clinician: {user.staffAttributes.is_clinician ? 'Yes' : 'No'}
          Admin: {user.staffAttributes.is_admin ? 'Yes' : 'No'}
        </p>
      )}
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Login

```typescript
const { login } = useAuth();

try {
  await login(email, password);
  // User is now authenticated and data is loaded
} catch (error) {
  if (error instanceof AuthError) {
    console.error(error.userMessage); // User-friendly message
  }
}
```

### Logout

```typescript
const { logout } = useAuth();

await logout();
// User is logged out, all cached data is cleared
```

### Reset Authentication

```typescript
const { resetAuth } = useAuth();

try {
  await resetAuth();
  // Circuit breaker reset, cache cleared, user data reloaded
} catch (error) {
  console.error('Reset failed:', error);
}
```

### Refresh User Data

```typescript
const { refreshUserData } = useAuth();

try {
  await refreshUserData();
  // User data refreshed from database
} catch (error) {
  console.error('Refresh failed:', error);
}
```

## Architecture

### Authentication Flow

```
User Login
    ↓
[AuthenticationProvider.login()]
    ↓
Supabase Authentication
    ↓
[loadUserData()]
    ↓
[UnifiedRoleDetectionService.detectUserRole()]
    ↓
Query profiles table (deduplicated)
    ↓
If staff: Query clinicians + permissions (deduplicated)
    ↓
Build User object
    ↓
Cache user data
    ↓
Update context state
    ↓
User Dashboard
```

### Session Management

- On app initialization, checks for existing Supabase session
- If session exists, loads user data from cache or database
- Listens to Supabase auth state changes (SIGNED_IN, SIGNED_OUT, etc.)
- Automatically handles session restoration and expiration

### Error Handling

- All async operations wrapped in try-catch blocks
- Network errors automatically retried with exponential backoff (up to 3 attempts)
- Circuit breaker opens after 3 consecutive failures
- User-friendly error messages provided for all error types
- Technical details logged for debugging

### Caching Strategy

- User data cached in memory and sessionStorage
- Cache TTL: 1 hour (configurable)
- Cache invalidated on logout, manual refresh, or role change
- Query deduplication prevents duplicate database queries

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

- **1.1-1.5**: Single authentication flow
- **2.1-2.7**: Unified role detection
- **4.1-4.6**: Request deduplication
- **5.1-5.7**: Circuit breaker recovery
- **7.1-7.6**: Performance and reliability
- **8.1-8.7**: Session management

## Testing

See the main spec document for comprehensive testing instructions.

## Next Steps

After implementing this authentication system:

1. Build UnifiedRoutingGuard component (Task 3)
2. Create CircuitBreakerRecoveryUI component (Task 4)
3. Integrate into application (Task 5)
4. Remove competing authentication logic (Task 6)
5. Add monitoring and debugging tools (Task 7)
6. Comprehensive testing (Task 8)
