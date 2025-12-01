# Design Document

## Overview

This design rebuilds the authentication and routing system from the ground up with a unified, single-flow architecture. The core principle is **one authentication flow, one role detection service, one routing guard** - eliminating all competing logic that causes the current request stampede and redirect loops.

The system uses a layered approach:
1. **Authentication Layer**: Handles login and initial data loading
2. **Role Detection Layer**: Determines user type and attributes
3. **Routing Layer**: Enforces access control and redirects
4. **Caching Layer**: Prevents duplicate queries and stores session data

## Architecture

### High-Level Flow

```
User Login
    ↓
[AuthenticationService]
    ↓
Fetch user data (deduplicated)
    ↓
[RoleDetectionService]
    ↓
Determine: client | staff (clinical/non-clinical, admin/non-admin)
    ↓
[UnifiedRoutingGuard]
    ↓
Redirect to appropriate portal
    ↓
User Dashboard
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Application Root                      │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │         AuthenticationProvider                      │ │
│  │  - Manages auth state                              │ │
│  │  - Coordinates data loading                        │ │
│  │  - Provides auth context                           │ │
│  └────────────────────────────────────────────────────┘ │
│                          │                               │
│                          ↓                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │         UnifiedRoutingGuard                        │ │
│  │  - Single routing decision point                   │ │
│  │  - Enforces access control                         │ │
│  │  - Handles redirects                               │ │
│  └────────────────────────────────────────────────────┘ │
│                          │                               │
│                          ↓                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │              Route Components                       │ │
│  │  /staff/* | /client/* | /public/*                  │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

Services (Singleton Instances):
┌──────────────────────────┐  ┌──────────────────────────┐
│  RoleDetectionService    │  │  QueryDeduplicator       │
│  - Single source of      │  │  - Prevents duplicate    │
│    truth for roles       │  │    queries               │
│  - Caches results        │  │  - Queues requests       │
└──────────────────────────┘  └──────────────────────────┘

┌──────────────────────────┐  ┌──────────────────────────┐
│  SessionCacheService     │  │  CircuitBreakerService   │
│  - Stores user data      │  │  - Monitors failures     │
│  - Manages cache         │  │  - Provides recovery     │
│    lifecycle             │  │                          │
└──────────────────────────┘  └──────────────────────────┘
```

## Components and Interfaces

### 1. AuthenticationProvider

**Purpose**: Top-level provider that manages authentication state and coordinates the unified flow.

**Interface**:
```typescript
interface AuthenticationContextValue {
  user: User | null;
  userRole: UserRole | null;
  isLoading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetAuth: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

interface User {
  id: string;
  email: string;
  profile: UserProfile;
  role: 'staff' | 'client';
  staffAttributes?: StaffAttributes;
  permissions?: UserPermissions;
}

interface StaffAttributes {
  is_clinician: boolean;
  is_admin: boolean;
  clinician_status?: string;
}
```

**Responsibilities**:
- Manage Supabase auth session
- Coordinate initial data loading after login
- Provide auth context to entire app
- Handle logout and session cleanup
- Trigger role detection
- Manage loading and error states

**Key Methods**:
- `login()`: Authenticates user and triggers unified flow
- `loadUserData()`: Fetches all required user data in coordinated sequence
- `resetAuth()`: Clears all state and resets circuit breaker
- `refreshUserData()`: Re-fetches user data and updates cache

### 2. RoleDetectionService

**Purpose**: Single source of truth for determining user roles and attributes.

**Interface**:
```typescript
interface RoleDetectionService {
  detectUserRole(userId: string): Promise<UserRoleContext>;
  getCachedRole(userId: string): UserRoleContext | null;
  invalidateCache(userId: string): void;
}

interface UserRoleContext {
  userId: string;
  role: 'staff' | 'client';
  isStaff: boolean;
  isClient: boolean;
  isClinician: boolean;
  isAdmin: boolean;
  permissions: UserPermissions;
  tenantId: string;
}
```

**Logic Flow**:
```
1. Check cache for userId
   ├─ If cached → return cached data
   └─ If not cached → continue

2. Query profiles table for user
   └─ Get: role, tenant_id, email, name

3. If role === 'staff':
   ├─ Query clinicians table (deduplicated)
   │  └─ Get: is_clinician, is_admin, status
   ├─ Query user_permissions table (deduplicated)
   │  └─ Get: all permission flags
   └─ Build StaffRoleContext
   
4. If role === 'client':
   └─ Build ClientRoleContext (no additional queries)

5. Cache result with userId key
6. Return UserRoleContext
```

**Caching Strategy**:
- In-memory Map with userId as key
- Cache duration: session lifetime
- Invalidate on: logout, manual refresh, role change detected

### 3. UnifiedRoutingGuard

**Purpose**: Single component that makes all routing decisions based on user roles.

**Interface**:
```typescript
interface UnifiedRoutingGuardProps {
  children: React.ReactNode;
}

interface RoutingDecision {
  shouldRedirect: boolean;
  redirectTo?: string;
  reason?: string;
}
```

**Routing Logic**:
```typescript
function determineRoute(user: User, currentPath: string): RoutingDecision {
  // Not authenticated
  if (!user) {
    if (isPublicRoute(currentPath)) {
      return { shouldRedirect: false };
    }
    return { shouldRedirect: true, redirectTo: '/login' };
  }

  // Client user
  if (user.role === 'client') {
    if (currentPath.startsWith('/client/')) {
      return { shouldRedirect: false };
    }
    return { shouldRedirect: true, redirectTo: '/client/dashboard' };
  }

  // Staff user
  if (user.role === 'staff') {
    // Clinical staff → registration page
    if (user.staffAttributes?.is_clinician === true) {
      if (currentPath === '/staff/registration') {
        return { shouldRedirect: false };
      }
      return { shouldRedirect: true, redirectTo: '/staff/registration' };
    }
    
    // Non-clinical staff → dashboard
    if (user.staffAttributes?.is_clinician === false) {
      if (currentPath.startsWith('/staff/') && currentPath !== '/staff/registration') {
        return { shouldRedirect: false };
      }
      return { shouldRedirect: true, redirectTo: '/staff/dashboard' };
    }
  }

  // Fallback
  return { shouldRedirect: true, redirectTo: '/error' };
}
```

**Redirect Prevention**:
- Track last redirect timestamp
- Prevent redirects within 100ms of previous redirect
- Maximum 3 redirects per 5 seconds
- If limit exceeded → show error page with reset option

### 4. QueryDeduplicator

**Purpose**: Prevents duplicate database queries from executing simultaneously.

**Interface**:
```typescript
interface QueryDeduplicator {
  deduplicate<T>(
    key: string,
    queryFn: () => Promise<T>
  ): Promise<T>;
  clear(key: string): void;
  clearAll(): void;
}

interface PendingQuery<T> {
  promise: Promise<T>;
  resolvers: Array<(value: T) => void>;
  rejectors: Array<(error: Error) => void>;
  timestamp: number;
}
```

**Implementation**:
```typescript
class QueryDeduplicatorImpl {
  private pending = new Map<string, PendingQuery<any>>();

  async deduplicate<T>(key: string, queryFn: () => Promise<T>): Promise<T> {
    // Check if query already in flight
    const existing = this.pending.get(key);
    if (existing) {
      // Return promise that resolves when original query completes
      return new Promise((resolve, reject) => {
        existing.resolvers.push(resolve);
        existing.rejectors.push(reject);
      });
    }

    // Execute new query
    const promise = queryFn();
    const pendingQuery: PendingQuery<T> = {
      promise,
      resolvers: [],
      rejectors: [],
      timestamp: Date.now()
    };
    
    this.pending.set(key, pendingQuery);

    try {
      const result = await promise;
      // Resolve all queued requests
      pendingQuery.resolvers.forEach(resolve => resolve(result));
      return result;
    } catch (error) {
      // Reject all queued requests
      pendingQuery.rejectors.forEach(reject => reject(error));
      throw error;
    } finally {
      // Clean up
      setTimeout(() => this.pending.delete(key), 100);
    }
  }
}
```

**Query Keys**:
- Profile: `profile:${userId}`
- Clinician: `clinician:${userId}`
- Permissions: `permissions:${userId}`

### 5. SessionCacheService

**Purpose**: Manages cached user data for the session duration.

**Interface**:
```typescript
interface SessionCacheService {
  set(key: string, value: any, ttl?: number): void;
  get<T>(key: string): T | null;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}
```

**Storage Strategy**:
- Use sessionStorage for persistence across page refreshes
- Use in-memory Map for fast access
- Sync between memory and sessionStorage
- Clear on logout or browser close

**Cache Keys**:
- User data: `user:${userId}`
- Role context: `role:${userId}`
- Permissions: `permissions:${userId}`

### 6. CircuitBreakerRecoveryUI

**Purpose**: Provides user interface for circuit breaker recovery.

**Interface**:
```typescript
interface CircuitBreakerRecoveryUIProps {
  isOpen: boolean;
  onReset: () => Promise<void>;
  error?: Error;
}
```

**UI Components**:
- Error message explaining the issue
- "Reset and Retry" button
- Loading indicator during reset
- Success/failure feedback
- Link to support if reset fails

## Data Models

### UserProfile (from profiles table)
```typescript
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
  archived: boolean | null;
}
```

### ClinicianRecord (from clinicians table)
```typescript
interface ClinicianRecord {
  id: string;
  user_id: string;
  tenant_id: string;
  is_clinician: boolean;
  is_admin: boolean;
  clinician_status: string | null;
  prov_name_f: string | null;
  prov_name_last: string | null;
  // ... other clinician fields
}
```

### UserPermissions (from user_permissions table)
```typescript
interface UserPermissions {
  user_id: string;
  tenant_id: string;
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

## Error Handling

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

class AuthError extends Error {
  type: AuthErrorType;
  recoverable: boolean;
  userMessage: string;
  technicalDetails: any;
}
```

### Error Recovery Strategies

1. **Network Errors**: Retry with exponential backoff (3 attempts)
2. **Authentication Failed**: Show login form with error message
3. **Role Detection Failed**: Retry once, then show error with reset option
4. **Circuit Breaker Open**: Show recovery UI with reset button
5. **Redirect Loop**: Stop redirects, show error, provide manual navigation
6. **Permission Denied**: Show access denied page with contact info
7. **Data Fetch Failed**: Retry with backoff, fallback to cached data if available

## Testing Strategy

### Unit Tests

1. **RoleDetectionService**
   - Test role detection for staff users
   - Test role detection for client users
   - Test caching behavior
   - Test error handling

2. **QueryDeduplicator**
   - Test deduplication of simultaneous queries
   - Test query resolution
   - Test error propagation
   - Test cleanup

3. **UnifiedRoutingGuard**
   - Test routing decisions for each user type
   - Test redirect loop prevention
   - Test access control enforcement

4. **SessionCacheService**
   - Test cache set/get operations
   - Test TTL expiration
   - Test cache invalidation

### Integration Tests

1. **Complete Authentication Flow**
   - Test login → role detection → routing for staff (clinical)
   - Test login → role detection → routing for staff (non-clinical)
   - Test login → role detection → routing for client
   - Test error scenarios at each step

2. **Deduplication**
   - Test multiple simultaneous login attempts
   - Verify only one set of queries executes
   - Verify all requests receive same data

3. **Circuit Breaker Recovery**
   - Trigger circuit breaker open state
   - Test recovery UI
   - Test successful reset and retry

### Manual Testing Checklist

- [ ] Login as clinical staff → redirects to /staff/registration
- [ ] Login as non-clinical staff → redirects to /staff/dashboard
- [ ] Login as client → redirects to /client/dashboard
- [ ] Verify no duplicate queries in network tab
- [ ] Verify no redirect loops
- [ ] Test circuit breaker recovery
- [ ] Test with slow network
- [ ] Test with network errors
- [ ] Verify session persistence across page refresh
- [ ] Verify logout clears all cached data

## Migration Strategy

### Phase 1: Build New System (Parallel)
- Create new services without touching existing code
- Build AuthenticationProvider
- Build RoleDetectionService
- Build UnifiedRoutingGuard
- Build supporting services

### Phase 2: Identify Competing Logic
- Audit codebase for all authentication flows
- Document all routing logic locations
- Map all role detection code
- Create removal checklist

### Phase 3: Switch to New System
- Wrap app with new AuthenticationProvider
- Replace old routing with UnifiedRoutingGuard
- Disable old authentication flows (comment out, don't delete yet)
- Test thoroughly in development

### Phase 4: Remove Old Code
- Delete old authentication components
- Delete old routing logic
- Delete old role detection code
- Clean up unused imports and dependencies

### Phase 5: Monitor and Optimize
- Monitor production for issues
- Optimize query performance
- Tune cache TTLs
- Adjust circuit breaker thresholds

## Performance Considerations

### Query Optimization
- Fetch profile, clinician, and permissions in parallel (not sequential)
- Use select to fetch only needed fields
- Index on user_id in all tables (should already exist)

### Caching Strategy
- Cache aggressively during session
- Invalidate on explicit user actions (logout, refresh)
- Use memory cache for speed, sessionStorage for persistence

### Bundle Size
- Keep services lightweight
- Avoid heavy dependencies
- Code-split route components

### Monitoring
- Log authentication flow timing
- Track query deduplication effectiveness
- Monitor circuit breaker state changes
- Alert on redirect loops

## Security Considerations

1. **Session Security**
   - Use Supabase's built-in session management
   - Don't store sensitive data in sessionStorage
   - Clear all data on logout

2. **Access Control**
   - Enforce routing rules on both client and server
   - Validate permissions on every API call
   - Don't trust client-side role detection alone

3. **Error Messages**
   - Don't expose sensitive information in errors
   - Log detailed errors server-side
   - Show generic messages to users

4. **Rate Limiting**
   - Implement rate limiting on login attempts
   - Prevent brute force attacks
   - Use Supabase's built-in protections
