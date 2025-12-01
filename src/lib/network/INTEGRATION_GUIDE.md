# Network Resilience System Integration Guide

## Overview

The Network Resilience System provides comprehensive error handling, retry mechanisms, and graceful degradation for network operations. This guide shows how to integrate it with existing code.

## Quick Start

### 1. Initialize the System

Add to your main App component:

```typescript
import { initializeNetworkResilience, NetworkErrorBoundary, NetworkStatusBanner } from '@/lib/network';

function App() {
  useEffect(() => {
    initializeNetworkResilience();
  }, []);

  return (
    <NetworkErrorBoundary>
      <NetworkStatusBanner />
      {/* Your app content */}
    </NetworkErrorBoundary>
  );
}
```

### 2. Use the Hook in Components

```typescript
import { useNetworkResilience } from '@/lib/network';

function MyComponent() {
  const { executeQuery, networkStatus, isInFallbackMode } = useNetworkResilience({
    onError: (error) => console.error('Network error:', error),
    onNetworkStatusChange: (status) => console.log('Status:', status)
  });

  const fetchData = async () => {
    const result = await executeQuery(
      (client) => client.from('users').select('*'),
      { cacheKey: 'users_list' }
    );

    if (result.data) {
      // Use the data
    } else if (result.source === 'cache') {
      // Show cached data indicator
    }
  };

  return (
    <div>
      {isInFallbackMode && <div>Using cached data</div>}
      {/* Your component content */}
    </div>
  );
}
```

## Migrating Existing Hooks

### Before: Direct Supabase Usage

```typescript
// OLD: Direct supabase usage
const { data, error } = await supabase
  .from('users')
  .select('*');

if (error) {
  throw error; // This could cause infinite loading
}
```

### After: Network Resilience

```typescript
// NEW: With network resilience
const { executeQuery } = useNetworkResilience();

const result = await executeQuery(
  (client) => client.from('users').select('*'),
  { cacheKey: 'users_list' }
);

if (result.error && result.source === 'network') {
  // Handle actual network error
} else if (result.data) {
  // Use data (could be from network or cache)
}
```

### Updating Authentication Hooks

```typescript
// In useAuth hook
import { useNetworkResilience } from '@/lib/network';

export function useAuth() {
  const { executeQuery, cacheUserSession, getCachedUserSession } = useNetworkResilience();

  const signIn = async (email: string, password: string) => {
    const result = await executeQuery(
      (client) => client.auth.signInWithPassword({ email, password })
    );

    if (result.data?.user) {
      // Cache user session for offline access
      cacheUserSession(
        result.data.user.id,
        result.data.user.user_metadata?.role || null,
        result.data.user.user_metadata?.permissions || [],
        result.data.user.user_metadata?.tenant_id || null
      );
    }

    return result;
  };

  const getCurrentUser = async () => {
    const result = await executeQuery(
      (client) => client.auth.getUser(),
      { cacheKey: 'current_user' }
    );

    // If network fails, try cached session
    if (!result.data && result.source === 'fallback') {
      const cachedSession = getCachedUserSession();
      if (cachedSession) {
        return { data: { user: cachedSession }, source: 'cache' };
      }
    }

    return result;
  };
}
```

### Updating Data Fetching Hooks

```typescript
// In useUserRole hook
import { useNetworkResilience } from '@/lib/network';

export function useUserRole() {
  const { executeQuery, getCachedData } = useNetworkResilience();
  const [role, setRole] = useState(null);

  const fetchRole = async () => {
    const result = await executeQuery(
      (client) => client.rpc('get_user_role'),
      { cacheKey: 'user_role' }
    );

    if (result.data) {
      setRole(result.data);
    } else {
      // Try cached role
      const cachedRole = getCachedData('user_role');
      if (cachedRole) {
        setRole(cachedRole);
      }
    }
  };

  return { role, fetchRole };
}
```

## Routing Integration

### Protecting Navigation

```typescript
import { createProtectedNavigate } from '@/lib/network';

function MyComponent() {
  const navigate = useNavigate();
  const protectedNavigate = createProtectedNavigate(navigate);

  const handleNavigation = () => {
    // This will be blocked if there are too many redirects or network issues
    protectedNavigate('/dashboard', 'user_action');
  };
}
```

### Route Guards

```typescript
import { withRoutingProtection } from '@/lib/network';

// Protect a navigation function
const protectedRedirect = withRoutingProtection(
  (path: string) => navigate(path),
  'auth_redirect'
);

// Use in route guards
if (!user) {
  protectedRedirect('/auth'); // Won't cause redirect loops
}
```

## Error Handling

### Component-Level Error Boundaries

```typescript
import { withNetworkErrorBoundary } from '@/lib/network';

const MyComponent = () => {
  // Component that might have network errors
  return <div>Content</div>;
};

// Wrap with network error boundary
export default withNetworkErrorBoundary(MyComponent, (error, retry) => (
  <div>
    <p>Network error: {error.message}</p>
    <button onClick={retry}>Retry</button>
  </div>
));
```

### Global Error Handling

```typescript
import { networkResilienceManager } from '@/lib/network';

// Register global error handler
networkResilienceManager.registerErrorHandler((error) => {
  if (error.severity === 'critical') {
    // Show critical error notification
    toast.error('Critical network error detected');
  }
});
```

## UI Components

### Network Status Indicator

```typescript
import { NetworkStatusIndicator } from '@/lib/network';

function Header() {
  return (
    <div className="header">
      <h1>My App</h1>
      <NetworkStatusIndicator showDetails />
    </div>
  );
}
```

### Conditional Rendering Based on Network Status

```typescript
import { useNetworkStatus } from '@/lib/network';

function DataTable() {
  const { status, isOnline } = useNetworkStatus();

  return (
    <div>
      {!isOnline && (
        <div className="offline-banner">
          You're offline. Showing cached data.
        </div>
      )}
      
      <table>
        {/* Table content */}
      </table>
      
      {status === 'DEGRADED' && (
        <div className="slow-connection-warning">
          Slow connection detected. Some features may be limited.
        </div>
      )}
    </div>
  );
}
```

## Testing

### Simulating Network Issues

```typescript
import { networkResilienceManager, routingProtection } from '@/lib/network';

// Force fallback mode for testing
networkResilienceManager.forceFallbackMode();

// Force routing protection for testing
routingProtection.forceUnblock();

// Get system status for debugging
console.log(networkResilienceManager.getSystemStatus());
```

### Testing Offline Scenarios

```typescript
// Simulate offline mode
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: false
});

window.dispatchEvent(new Event('offline'));
```

## Performance Considerations

### Cache Management

```typescript
import { cacheManager } from '@/lib/network';

// Manual cache cleanup
cacheManager.cleanup();

// Get cache statistics
const stats = cacheManager.getStats();
console.log(`Cache: ${stats.validEntries}/${stats.totalEntries} entries`);
```

### Monitoring

```typescript
import { getSystemHealth } from '@/lib/network';

// Get comprehensive system health
const health = getSystemHealth();
console.log('System Health:', health);
```

## Best Practices

1. **Always use cacheKey for important data** that users need when offline
2. **Handle both network and cache sources** in your UI
3. **Show appropriate loading states** based on network status
4. **Implement graceful degradation** for non-critical features
5. **Use routing protection** for authentication flows
6. **Monitor network status** and adjust UI accordingly
7. **Test offline scenarios** regularly
8. **Cache user permissions and roles** for offline access

## Common Patterns

### Loading States

```typescript
function DataComponent() {
  const [loading, setLoading] = useState(false);
  const { executeQuery, networkStatus } = useNetworkResilience();

  const loadData = async () => {
    setLoading(true);
    const result = await executeQuery(/* ... */);
    setLoading(false);

    if (result.source === 'cache') {
      // Show "cached data" indicator
    }
  };

  return (
    <div>
      {loading && networkStatus === 'DEGRADED' && (
        <div>Loading may take longer due to slow connection...</div>
      )}
      {/* Content */}
    </div>
  );
}
```

### Retry Logic

```typescript
function RetryableComponent() {
  const { executeQuery } = useNetworkResilience();
  const [retryCount, setRetryCount] = useState(0);

  const fetchWithRetry = async () => {
    const result = await executeQuery(/* ... */);
    
    if (result.error && result.error.retryable && retryCount < 3) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        fetchWithRetry();
      }, 1000 * Math.pow(2, retryCount));
    }
  };
}
```

This integration guide provides comprehensive examples for migrating existing code to use the Network Resilience System while maintaining backward compatibility and improving user experience during network issues.