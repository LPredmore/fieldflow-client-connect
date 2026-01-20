# Authentication Monitoring and Debugging Tools

This document describes the monitoring and debugging tools implemented for the unified authentication system.

## Overview

The authentication system includes comprehensive logging and debugging capabilities to help developers understand and troubleshoot authentication flows, role detection, routing decisions, and system health.

## Console-Based Debugging

All debugging is now done via browser console. The following utilities are available:

### AuthLogger

**Location**: `src/services/auth/AuthLogger.ts`

Access in browser console:
```javascript
// Import is already available in window context during development
authLogger.getHistory()           // Get all log entries
authLogger.getHistoryByCategory('authentication')  // Filter by category
authLogger.getHistoryByUser(userId)  // Filter by user
authLogger.exportLogs()           // Export as JSON string
authLogger.clearHistory()         // Clear log history
```

### SessionCacheService

```javascript
sessionCacheService.getStats()    // Get cache statistics
sessionCacheService.clear()       // Clear all cached data
```

### Categories

- `authentication` - Login/logout events
- `role_detection` - Role detection events
- `routing` - Routing decisions
- `query_deduplication` - Query deduplication events
- `circuit_breaker` - Circuit breaker state changes
- `cache` - Cache operations
- `session` - Session events

## Integrated Logging

All authentication services include comprehensive logging:

### QueryDeduplicator
- Logs when queries are deduplicated
- Logs when new queries are executed
- Logs query completion with duration
- Logs query failures

### CircuitBreakerRecoveryService
- Logs state transitions (closed → open → half-open)
- Logs failure recordings with threshold checks
- Logs manual resets

### UnifiedRoleDetectionService
- Logs role detection start/completion
- Logs cache hits/misses
- Logs database errors

### SessionCacheService
- Logs cache set/get operations
- Logs cache expiration and deletions

### UnifiedRoutingGuard
- Logs routing decisions for all user types
- Logs redirect attempts and blocking

## Log Entry Format

```typescript
{
  timestamp: string;        // ISO 8601 timestamp
  level: AuthLogLevel;      // debug | info | warn | error
  category: AuthLogCategory;
  message: string;
  data?: Record<string, any>;
  userId?: string;
}
```

## Debugging Workflow

### 1. Investigating Authentication Issues

1. Open browser DevTools console
2. Run `authLogger.getHistoryByCategory('authentication')`
3. Look for error messages or unexpected state transitions
4. Check `sessionCacheService.getStats()` for cache health

### 2. Investigating Routing Issues

1. Open browser DevTools console
2. Run `authLogger.getHistoryByCategory('routing')`
3. Look for routing decisions and redirects
4. Check for redirect loop warnings

### 3. Investigating Performance Issues

1. Run `authLogger.getHistoryByCategory('query_deduplication')`
2. Look for query durations in logs
3. Check `sessionCacheService.getStats()` for cache effectiveness

### 4. Investigating Circuit Breaker Issues

1. Run `authLogger.getHistoryByCategory('circuit_breaker')`
2. Look for failure patterns and state transitions

## Best Practices

1. **Use appropriate log levels**:
   - DEBUG: Detailed flow information
   - INFO: Important events (login, logout, role detection)
   - WARN: Recoverable issues (circuit breaker state changes)
   - ERROR: Failures that need attention

2. **Include context in log data**:
   - Always include userId when available
   - Include relevant IDs (tenantId, sessionId)
   - Include timing information

3. **Don't log sensitive data**:
   - Never log passwords or tokens
   - Be careful with PII

## Production Logging

In production, the logger:
- Only outputs WARN and ERROR level logs
- Uses structured JSON format
- Can be integrated with external logging services (Sentry, LogRocket, Datadog)
