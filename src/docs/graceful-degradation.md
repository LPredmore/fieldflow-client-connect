# Graceful Degradation Implementation

This document describes the graceful degradation system implemented to handle database query failures and provide a better user experience when data loading fails.

## Overview

The graceful degradation system provides multiple layers of fallback behavior when database queries fail:

1. **Cached Data Display**: Show previously loaded data when circuit breaker is open
2. **Stale Data Indicators**: Inform users when data may be outdated
3. **Error State Management**: Provide appropriate error messages based on error type
4. **Retry Mechanisms**: Allow users to retry failed operations
5. **Empty State Handling**: Show helpful empty states when no data is available

## Components

### GracefulDataWrapper

A higher-order component that wraps data-loading components with graceful degradation logic.

```tsx
import { GracefulDataWrapper } from '@/components/ui/graceful-data-wrapper';

<GracefulDataWrapper
  loading={loading}
  error={error}
  errorType={errorType}
  data={data}
  isStale={isStale}
  isCircuitBreakerOpen={isCircuitBreakerOpen}
  lastUpdated={lastUpdated}
  onRetry={handleRetry}
  onRefresh={handleRefresh}
  emptyStateTitle="No items found"
  emptyStateDescription="Add some items to get started"
>
  {/* Your data display component */}
</GracefulDataWrapper>
```

**Features:**
- Automatically handles loading, error, empty, and stale states
- Shows cached data when circuit breaker is open
- Provides retry and refresh functionality
- Customizable empty state messages

### EnhancedEmptyState

A flexible empty state component that handles different scenarios.

```tsx
import { EnhancedEmptyState } from '@/components/ui/enhanced-empty-state';

<EnhancedEmptyState
  type="circuit_breaker"
  lastUpdated={lastUpdated}
  cachedDataCount={5}
  onRetry={handleRetry}
  compact={true}
/>
```

**Types:**
- `empty`: No data available
- `error`: Error occurred with no cached data
- `circuit_breaker`: Service unavailable, may show cached data info
- `stale_data`: Data is outdated and needs refresh

### RetryMechanism

A component that provides user-friendly retry options with auto-retry capability.

```tsx
import { RetryMechanism } from '@/components/ui/retry-mechanism';

<RetryMechanism
  onRetry={handleRetry}
  error="Network connection failed"
  errorType={ErrorType.NETWORK_ERROR}
  maxRetries={3}
  retryDelay={5000}
  autoRetry={true}
  compact={true}
/>
```

**Features:**
- Manual retry with exponential backoff
- Auto-retry with countdown timer
- Different behavior based on error type
- Maximum retry limits

### ErrorBoundary

A React error boundary that catches JavaScript errors and provides recovery options.

```tsx
import { ErrorBoundary } from '@/components/ui/error-boundary';

<ErrorBoundary onError={handleError} showErrorDetails={true}>
  <YourComponent />
</ErrorBoundary>
```

**Features:**
- Catches React component errors
- Provides retry functionality
- Shows error details in development
- Custom fallback UI support

### CachedDataIndicator

Shows users when they're viewing cached or stale data.

```tsx
import { CachedDataIndicator } from '@/components/ui/cached-data-indicator';

<CachedDataIndicator
  isStale={true}
  isOffline={false}
  lastUpdated={lastUpdated}
  onRefresh={handleRefresh}
  compact={true}
/>
```

## Error Types

The system recognizes different error types and handles them appropriately:

### ErrorType.NETWORK_ERROR
- **Behavior**: Auto-retry enabled, shows network-related messaging
- **User Message**: "Connection Problem - Please check your internet connection"
- **Retry Strategy**: Exponential backoff with auto-retry

### ErrorType.PERMISSION_ERROR
- **Behavior**: No auto-retry, shows permission-related messaging
- **User Message**: "Access Denied - You don't have permission to access this data"
- **Retry Strategy**: Manual retry only

### ErrorType.TIMEOUT_ERROR
- **Behavior**: Auto-retry enabled, shows timeout-related messaging
- **User Message**: "Request Timeout - The request took too long to complete"
- **Retry Strategy**: Immediate retry with longer timeout

### ErrorType.SCHEMA_MISMATCH
- **Behavior**: No auto-retry, shows technical error messaging
- **User Message**: "Data Structure Issue - Please contact support"
- **Retry Strategy**: Manual retry only (likely needs code fix)

## Implementation Patterns

### Basic Data Loading Component

```tsx
function MyDataComponent() {
  const { 
    data, 
    loading, 
    error, 
    errorType,
    isStale,
    isCircuitBreakerOpen,
    lastUpdated,
    refetch 
  } = useMyDataHook();

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Data</CardTitle>
      </CardHeader>
      <CardContent>
        <GracefulDataWrapper
          loading={loading}
          error={error}
          errorType={errorType}
          data={data}
          isStale={isStale}
          isCircuitBreakerOpen={isCircuitBreakerOpen}
          lastUpdated={lastUpdated}
          onRetry={refetch}
          onRefresh={refetch}
          emptyStateTitle="No data found"
          emptyStateDescription="Try adding some data to get started"
        >
          <div className="space-y-2">
            {data.map(item => (
              <div key={item.id} className="p-2 border rounded">
                {item.name}
              </div>
            ))}
          </div>
        </GracefulDataWrapper>
      </CardContent>
    </Card>
  );
}
```

### Custom Error Handling

```tsx
function MyComponentWithCustomErrors() {
  const { data, loading, error, errorType, refetch } = useMyDataHook();

  // Custom error handling logic
  if (error && !data?.length) {
    if (errorType === ErrorType.PERMISSION_ERROR) {
      return <CustomPermissionError onRetry={refetch} />;
    }
    
    if (errorType === ErrorType.SCHEMA_MISMATCH) {
      return <CustomSchemaError onContactSupport={handleContactSupport} />;
    }
  }

  // Use default graceful degradation for other cases
  return (
    <GracefulDataWrapper
      loading={loading}
      error={error}
      errorType={errorType}
      data={data}
      onRetry={refetch}
    >
      {/* Component content */}
    </GracefulDataWrapper>
  );
}
```

### Error Boundary Usage

```tsx
function App() {
  return (
    <ErrorBoundary 
      onError={(error, errorInfo) => {
        // Log to error reporting service
        console.error('App error:', error, errorInfo);
      }}
    >
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/appointments" element={<Appointments />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
```

## Best Practices

### 1. Always Provide Fallback Data
- Show cached data when possible instead of blocking the UI
- Use stale data with indicators rather than empty states
- Provide meaningful empty states when no data exists

### 2. Error Type Classification
- Classify errors appropriately to provide relevant user messaging
- Don't auto-retry non-recoverable errors (permissions, schema mismatches)
- Use exponential backoff for network-related retries

### 3. User Communication
- Always inform users about the state of their data
- Provide clear actions users can take (retry, refresh, contact support)
- Show timestamps for cached/stale data

### 4. Performance Considerations
- Don't block the UI while retrying in the background
- Use loading skeletons that match your content structure
- Implement proper cleanup for cancelled requests

### 5. Testing
- Test all error scenarios in your components
- Verify graceful degradation works with real network conditions
- Test error boundary recovery flows

## Circuit Breaker Integration

The graceful degradation system works closely with the circuit breaker:

```tsx
// Circuit breaker states affect graceful degradation
const {
  data,
  loading,
  error,
  isCircuitBreakerOpen, // Circuit breaker is blocking requests
  isStale,               // Data is older than staleTime
  lastUpdated           // When data was last successfully fetched
} = useSupabaseQuery({
  table: 'my_table',
  staleTime: 300000,    // 5 minutes
  enabled: true
});

// Graceful degradation handles these states automatically
```

## Monitoring and Observability

The system provides hooks for monitoring:

```tsx
// Custom error handler for logging
<ErrorBoundary 
  onError={(error, errorInfo) => {
    // Send to monitoring service
    analytics.track('component_error', {
      error: error.message,
      component: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });
  }}
>
  <MyComponent />
</ErrorBoundary>

// Retry mechanism with monitoring
<RetryMechanism
  onRetry={async () => {
    analytics.track('user_retry_attempt');
    await handleRetry();
  }}
/>
```

## Migration Guide

To add graceful degradation to existing components:

1. **Wrap with GracefulDataWrapper**:
   ```tsx
   // Before
   if (loading) return <LoadingSpinner />;
   if (error) return <ErrorMessage error={error} />;
   if (!data.length) return <EmptyState />;
   return <DataDisplay data={data} />;

   // After
   return (
     <GracefulDataWrapper
       loading={loading}
       error={error}
       data={data}
       onRetry={refetch}
     >
       <DataDisplay data={data} />
     </GracefulDataWrapper>
   );
   ```

2. **Add Error Boundaries**:
   ```tsx
   // Wrap route components
   <Route 
     path="/dashboard" 
     element={
       <ErrorBoundary>
         <Dashboard />
       </ErrorBoundary>
     } 
   />
   ```

3. **Update Data Hooks**:
   Ensure your data hooks return the required graceful degradation properties:
   - `isStale`
   - `isCircuitBreakerOpen`
   - `lastUpdated`
   - `errorType`

This implementation ensures that users always have a functional interface, even when backend services are experiencing issues.