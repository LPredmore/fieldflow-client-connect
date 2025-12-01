# Circuit Breaker Configuration

This document explains the circuit breaker implementation used to protect against database query failures and provide graceful degradation.

## Overview

The circuit breaker pattern prevents cascading failures by temporarily blocking requests to a failing service and providing fallback behavior. Our implementation is specifically optimized for database query performance issues.

## Configuration

### Current Settings

```typescript
export const supabaseCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,    // Open after 5 consecutive failures (increased from 3)
  resetTimeout: 30000,    // Try again after 30 seconds (reduced from 60s)
  monitoringPeriod: 60000 // Monitor failures over 1-minute windows
});
```

### Configuration Rationale

| Setting | Value | Previous | Reason for Change |
|---------|-------|----------|-------------------|
| `failureThreshold` | 5 | 3 | More tolerant of transient network issues |
| `resetTimeout` | 30000ms | 60000ms | Faster recovery from temporary problems |
| `monitoringPeriod` | 60000ms | 60000ms | Unchanged - good balance for tracking |

## Circuit Breaker States

### 1. CLOSED (Normal Operation)
- All requests are allowed through
- Failure count is tracked
- Successful requests reset failure count gradually

```typescript
// Circuit breaker allows all requests
const result = await supabaseCircuitBreaker.execute(async () => {
  return await supabase.from('table').select('*');
});
```

### 2. OPEN (Blocking Requests)
- Requests are blocked immediately
- Shows cached data if available
- Waits for resetTimeout before trying again

```typescript
// Circuit breaker blocks request, shows cached data
try {
  const result = await supabaseCircuitBreaker.execute(operation);
} catch (error) {
  if (error.message.includes('Circuit breaker is OPEN')) {
    // Show cached data or empty state
    return getCachedData() || [];
  }
}
```

### 3. HALF_OPEN (Testing Recovery)
- Allows limited requests to test if service recovered
- Requires 3 successful requests to fully close
- Single failure returns to OPEN state

## Error Classification

The circuit breaker intelligently classifies errors to determine whether they should count toward the failure threshold:

### Retryable Errors (Count Toward Threshold)
```typescript
enum RetryableErrors {
  NETWORK_ERROR = 'network_error',     // Connection issues
  TIMEOUT_ERROR = 'timeout_error',     // Request timeouts
  UNKNOWN_ERROR = 'unknown_error'      // Unclassified errors
}
```

### Non-Retryable Errors (Don't Count Toward Threshold)
```typescript
enum NonRetryableErrors {
  SCHEMA_MISMATCH = 'schema_mismatch',   // Column doesn't exist
  PERMISSION_ERROR = 'permission_error'  // Access denied
}
```

### Error Classification Logic

```typescript
static classifyError(error: any): ErrorInfo {
  const message = error?.message || error?.toString() || 'Unknown error';
  
  // Schema mismatch errors - don't retry
  if (message.includes('column') && message.includes('does not exist')) {
    return {
      type: ErrorType.SCHEMA_MISMATCH,
      retryable: false
    };
  }
  
  // Network errors - retry with backoff
  if (message.includes('fetch') || message.includes('network')) {
    return {
      type: ErrorType.NETWORK_ERROR,
      retryable: true
    };
  }
  
  // Permission errors - don't retry
  if (message.includes('permission') || message.includes('unauthorized')) {
    return {
      type: ErrorType.PERMISSION_ERROR,
      retryable: false
    };
  }
  
  // Timeout errors - retry
  if (message.includes('timeout') || error?.name === 'AbortError') {
    return {
      type: ErrorType.TIMEOUT_ERROR,
      retryable: true
    };
  }
  
  // Default to retryable for unknown errors
  return {
    type: ErrorType.UNKNOWN_ERROR,
    retryable: true
  };
}
```

## Integration with useSupabaseQuery

The circuit breaker is automatically integrated into all database queries through `useSupabaseQuery`:

```typescript
export function useSupabaseQuery<T>(options: QueryOptions<T>) {
  // ... other code
  
  const queryPromise = supabaseCircuitBreaker.execute(async () => {
    return await query.abortSignal(abortController.signal);
  });
  
  // ... error handling
}
```

## Graceful Degradation

When the circuit breaker is open, the system provides graceful degradation:

### 1. Show Cached Data
```typescript
if (isCircuitOpen && !force) {
  const cached = queryCache.get(cacheKey);
  if (cached && cached.data) {
    console.log('Circuit breaker OPEN - showing cached data');
    setData(cached.data);
    setIsStale(true);
    setError('Service temporarily unavailable - showing cached data');
    return;
  }
}
```

### 2. Show Empty State with Message
```typescript
// No cached data available
setError('Service temporarily unavailable');
setErrorType(ErrorType.NETWORK_ERROR);
setLoading(false);
```

### 3. User-Friendly Error Messages
```typescript
const getErrorMessage = (errorType: ErrorType) => {
  switch (errorType) {
    case ErrorType.SCHEMA_MISMATCH:
      return 'Database schema error - please contact support';
    case ErrorType.NETWORK_ERROR:
      return 'Connection issue - showing cached data';
    case ErrorType.PERMISSION_ERROR:
      return 'Access denied - please check permissions';
    case ErrorType.TIMEOUT_ERROR:
      return 'Request timeout - please try again';
    default:
      return 'Service temporarily unavailable';
  }
};
```

## Monitoring and Alerting

### State Change Logging
```typescript
circuitBreakerMonitor.logStateChange(previousState, newState, {
  failureCount: this.failureCount,
  successCount: this.successCount,
  requestCount: this.requestCount
});
```

### Error Logging
```typescript
circuitBreakerMonitor.logError(errorType, message, {
  retryable: errorInfo.retryable,
  currentState: this.state,
  failureCount: this.failureCount
});
```

### Success Logging
```typescript
circuitBreakerMonitor.logSuccess({
  successCount: this.successCount,
  requestCount: this.requestCount,
  currentState: this.state
});
```

## Usage Examples

### Basic Usage
```typescript
import { supabaseCircuitBreaker } from '@/utils/circuitBreaker';

async function fetchData() {
  try {
    const result = await supabaseCircuitBreaker.execute(async () => {
      return await supabase.from('appointments').select('*');
    });
    return result;
  } catch (error) {
    if (error.message.includes('Circuit breaker is OPEN')) {
      // Handle circuit breaker open state
      return getCachedData();
    }
    throw error;
  }
}
```

### With Error Handling
```typescript
async function fetchDataWithFallback() {
  try {
    return await supabaseCircuitBreaker.execute(operation);
  } catch (error) {
    const errorInfo = CircuitBreaker.classifyError(error);
    
    switch (errorInfo.type) {
      case ErrorType.SCHEMA_MISMATCH:
        console.error('Schema error - needs immediate fix');
        return [];
      case ErrorType.NETWORK_ERROR:
        console.warn('Network error - will retry later');
        return getCachedData();
      default:
        throw error;
    }
  }
}
```

### Checking Circuit Breaker State
```typescript
function ComponentWithCircuitBreakerStatus() {
  const circuitState = supabaseCircuitBreaker.getState();
  
  return (
    <div>
      <p>Circuit State: {circuitState.state}</p>
      <p>Failure Count: {circuitState.failureCount}</p>
      <p>Success Count: {circuitState.successCount}</p>
      {circuitState.isOpen && (
        <div className="alert alert-warning">
          Service temporarily unavailable - showing cached data
        </div>
      )}
    </div>
  );
}
```

## Performance Impact

### Before Circuit Breaker Optimization
- 3 failures triggered 60-second blocks
- Schema errors caused unnecessary circuit trips
- No graceful degradation
- All queries blocked globally

### After Circuit Breaker Optimization
- 5 failures required for more tolerance
- 30-second recovery time for faster restoration
- Schema errors don't trigger circuit breaker
- Cached data shown during outages
- Better user experience with meaningful error messages

## Troubleshooting

### Common Issues

1. **Circuit breaker opens too frequently**
   - Check if `failureThreshold` is too low
   - Verify error classification is working correctly
   - Look for underlying service issues

2. **Circuit breaker doesn't open when it should**
   - Check if errors are being classified as non-retryable
   - Verify error counting logic
   - Check monitoring logs

3. **Slow recovery from failures**
   - Verify `resetTimeout` configuration
   - Check if half-open state is working correctly
   - Look for continued underlying issues

### Debugging

```typescript
// Enable detailed logging
const circuitState = supabaseCircuitBreaker.getState();
console.log('Circuit Breaker Debug:', {
  state: circuitState.state,
  failureCount: circuitState.failureCount,
  successCount: circuitState.successCount,
  isOpen: circuitState.isOpen,
  errorHistory: circuitState.errorHistory,
  lastErrorType: circuitState.lastErrorType
});
```

### Manual Reset
```typescript
// Reset circuit breaker manually (for testing or emergency)
supabaseCircuitBreaker.reset();
```

## Best Practices

1. **Don't bypass the circuit breaker** - Always use it for database operations
2. **Implement proper fallbacks** - Have cached data or empty states ready
3. **Monitor circuit breaker state** - Track opens/closes in production
4. **Classify errors correctly** - Ensure retryable vs non-retryable logic is accurate
5. **Test failure scenarios** - Verify graceful degradation works as expected

## Configuration Tuning

### For High-Traffic Applications
```typescript
const highTrafficConfig = {
  failureThreshold: 10,   // More tolerant
  resetTimeout: 15000,    // Faster recovery
  monitoringPeriod: 30000 // Shorter monitoring window
};
```

### For Critical Systems
```typescript
const criticalSystemConfig = {
  failureThreshold: 3,    // Less tolerant
  resetTimeout: 60000,    // Slower recovery
  monitoringPeriod: 120000 // Longer monitoring window
};
```

### For Development
```typescript
const developmentConfig = {
  failureThreshold: 1,    // Fail fast for debugging
  resetTimeout: 5000,     // Quick recovery for testing
  monitoringPeriod: 10000 // Short monitoring for rapid iteration
};
```

The circuit breaker configuration provides a robust foundation for handling database failures while maintaining good user experience through intelligent error handling and graceful degradation.