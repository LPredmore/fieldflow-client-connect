# Authentication Monitoring and Debugging Tools

This document describes the monitoring and debugging tools implemented for the unified authentication system.

## Overview

The authentication system includes comprehensive logging and debugging capabilities to help developers understand and troubleshoot authentication flows, role detection, routing decisions, and system health.

## Components

### 1. AuthLogger Service

**Location**: `src/services/auth/AuthLogger.ts`

A centralized logging utility that provides structured logging for all authentication-related operations.

#### Features

- **Category-based logging**: Logs are organized by category (authentication, role_detection, routing, query_deduplication, circuit_breaker, cache, session)
- **Log levels**: DEBUG, INFO, WARN, ERROR
- **Environment-aware**: Uses `console.debug` in development, structured JSON in production
- **Log history**: Maintains last 100 log entries in memory
- **Export capability**: Can export logs as JSON for analysis

#### Usage

```typescript
import { authLogger } from '@/services/auth/AuthLogger';

// Log authentication event
authLogger.logAuth('User login initiated', { email: 'user@example.com' }, userId);

// Log role detection
authLogger.logRoleDetection('Role detected', { role: 'staff', isClinician: true }, userId);

// Log routing decision
authLogger.logRouting('Redirecting to dashboard', { from: '/auth', to: '/staff/dashboard' }, userId);

// Log query deduplication
authLogger.logQueryDedup('Query deduplicated', { key: 'profile:123', queuedRequests: 3 });

// Log circuit breaker event
authLogger.logCircuitBreaker('Circuit breaker opened', { failureCount: 3 });

// Log cache operation
authLogger.logCache('Cache hit', { key: 'user:123', age: 1500 });

// Log session event
authLogger.logSession('Session restored', { userId: '123' }, userId);

// Log error
authLogger.logError('authentication', 'Login failed', error, { email: 'user@example.com' });
```

#### API

- `logAuth(message, data?, userId?)` - Log authentication flow step
- `logRoleDetection(message, data?, userId?)` - Log role detection event
- `logRouting(message, data?, userId?)` - Log routing decision
- `logQueryDedup(message, data?)` - Log query deduplication event
- `logCircuitBreaker(message, data?)` - Log circuit breaker state change
- `logCache(message, data?)` - Log cache operation
- `logSession(message, data?, userId?)` - Log session event
- `logError(category, message, error?, data?)` - Log error
- `getHistory()` - Get all log entries
- `getHistoryByCategory(category)` - Get logs for specific category
- `getHistoryByUser(userId)` - Get logs for specific user
- `clearHistory()` - Clear log history
- `exportLogs()` - Export logs as JSON string

### 2. AuthDebugPanel Component

**Location**: `src/components/auth/AuthDebugPanel.tsx`

A development-only UI component that displays real-time authentication state and provides manual controls.

#### Features

- **User State Display**: Shows current user, role, and permissions
- **Circuit Breaker Status**: Real-time circuit breaker state with visual indicators
- **Cache Statistics**: Shows cache size and cached keys
- **Pending Queries**: Lists currently in-flight queries
- **Log Viewer**: Displays recent logs with category filtering
- **Manual Controls**: Buttons to refresh, reset, and clear cache
- **Export Logs**: Download logs as JSON file
- **Collapsible**: Can be minimized to stay out of the way

#### Usage

The debug panel is automatically included in the app when running in development mode. It appears as a floating panel in the bottom-right corner.

```typescript
import { AuthDebugPanel } from '@/components/auth/AuthDebugPanel';

// In App.tsx (already added)
<AuthDebugPanel />
```

#### Controls

- **Refresh User Data**: Manually refresh user data from database
- **Reset Auth**: Reset circuit breaker and clear all cached data
- **Clear Cache**: Clear all cached authentication data
- **Clear Logs**: Clear log history
- **Export Logs**: Download logs as JSON file

#### Log Filtering

Click on category buttons to filter logs by:
- All
- authentication
- role_detection
- routing
- query_deduplication
- circuit_breaker
- cache
- session

### 3. Integrated Logging

All authentication services now include comprehensive logging:

#### QueryDeduplicator
- Logs when queries are deduplicated
- Logs when new queries are executed
- Logs query completion with duration
- Logs query failures
- Logs cleanup events

#### CircuitBreakerRecoveryService
- Logs initialization
- Logs success recordings
- Logs failure recordings with threshold checks
- Logs state transitions (closed → open → half-open)
- Logs manual resets
- Logs automatic half-open transitions
- Logs configuration updates

#### UnifiedRoleDetectionService
- Logs role detection start
- Logs cache hits/misses
- Logs profile fetching
- Logs clinician data fetching
- Logs permissions fetching
- Logs role detection completion with duration
- Logs cache invalidation
- Logs all database errors

#### SessionCacheService
- Logs cache set operations
- Logs cache hits with source (memory/sessionStorage)
- Logs cache misses
- Logs cache expiration
- Logs cache deletions
- Logs cache clears
- Logs storage errors

#### UnifiedRoutingGuard
- Logs routing decisions for all user types
- Logs redirect attempts
- Logs redirect blocking (cooldown/limit)
- Logs redirect loop detection
- Logs authentication errors
- Logs reset actions

## Log Entry Format

Each log entry contains:

```typescript
{
  timestamp: string;        // ISO 8601 timestamp
  level: AuthLogLevel;      // debug | info | warn | error
  category: AuthLogCategory; // authentication | role_detection | routing | etc.
  message: string;          // Human-readable message
  data?: Record<string, any>; // Additional structured data
  userId?: string;          // User ID if applicable
}
```

## Production Logging

In production, the logger:
- Only outputs WARN and ERROR level logs
- Uses structured JSON format
- Can be integrated with external logging services (e.g., Sentry, LogRocket, Datadog)

To integrate with an external service, modify the `logStructured` method in `AuthLogger.ts`:

```typescript
private logStructured(entry: LogEntry): void {
  // Send to your logging service
  if (entry.level === AuthLogLevel.ERROR) {
    // Example: Sentry.captureMessage(entry.message, { extra: entry.data });
  }
  
  // Also log to console
  if (entry.level === AuthLogLevel.WARN || entry.level === AuthLogLevel.ERROR) {
    console.log(JSON.stringify(entry));
  }
}
```

## Debugging Workflow

### 1. Investigating Authentication Issues

1. Open the AuthDebugPanel (bottom-right corner in dev mode)
2. Check the User State section for current authentication status
3. Filter logs by "authentication" category
4. Look for error messages or unexpected state transitions
5. Check Circuit Breaker status for system health
6. Use "Refresh User Data" to retry authentication

### 2. Investigating Routing Issues

1. Open the AuthDebugPanel
2. Filter logs by "routing" category
3. Look for routing decisions and redirects
4. Check for redirect loop warnings
5. Verify user role and permissions in User State section

### 3. Investigating Performance Issues

1. Open the AuthDebugPanel
2. Filter logs by "query_deduplication" category
3. Check Pending Queries section for stuck queries
4. Look for query durations in logs
5. Check Cache Statistics for cache effectiveness

### 4. Investigating Circuit Breaker Issues

1. Open the AuthDebugPanel
2. Check Circuit Breaker Status section
3. Filter logs by "circuit_breaker" category
4. Look for failure patterns
5. Use "Reset Auth" to manually reset circuit breaker

## Best Practices

1. **Use appropriate log levels**:
   - DEBUG: Detailed flow information
   - INFO: Important events (login, logout, role detection)
   - WARN: Recoverable issues (circuit breaker state changes)
   - ERROR: Failures that need attention

2. **Include context in log data**:
   - Always include userId when available
   - Include relevant IDs (tenantId, sessionId)
   - Include timing information (duration, timestamps)
   - Include error details for failures

3. **Don't log sensitive data**:
   - Never log passwords or tokens
   - Redact email addresses in production
   - Be careful with PII (personally identifiable information)

4. **Use the debug panel during development**:
   - Keep it open when testing authentication flows
   - Export logs when reporting bugs
   - Use manual controls to test edge cases

## Troubleshooting

### Debug Panel Not Showing

- Ensure you're running in development mode (`npm run dev`)
- Check browser console for errors
- Verify `import.meta.env.DEV` is true

### Logs Not Appearing

- Check that logging is enabled in the service
- Verify log level is appropriate (DEBUG logs only show in dev)
- Check browser console settings (ensure debug logs are visible)

### Performance Impact

- The debug panel updates every second
- Log history is limited to 100 entries
- In production, only WARN and ERROR logs are output
- Consider disabling verbose logging in production

## Future Enhancements

Potential improvements to the monitoring system:

1. **Remote Logging**: Send logs to external service (Sentry, LogRocket)
2. **Performance Metrics**: Track timing for all operations
3. **User Session Recording**: Record user sessions for debugging
4. **Alert System**: Notify developers of critical errors
5. **Log Search**: Add search functionality to log viewer
6. **Log Persistence**: Save logs to localStorage for later analysis
7. **Metrics Dashboard**: Visualize authentication metrics over time
