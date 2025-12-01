# Query Prioritization and Throttling System

## Overview

This system implements comprehensive query performance optimization through three integrated components:

1. **Priority-based Query Execution** - Ensures critical queries execute first
2. **Request Throttling** - Prevents system overload with intelligent rate limiting
3. **Query Batching** - Reduces database connection overhead by grouping similar operations

## Components

### 1. Query Priority System (`queryPrioritySystem.ts`)

#### QueryPriority Enum
```typescript
enum QueryPriority {
  CRITICAL = 1,    // Auth, settings - must execute immediately
  HIGH = 2,        // User profile, permissions - high importance
  MEDIUM = 3,      // Business data (customers, clinicians) - normal priority
  LOW = 4          // Analytics, logs - can be delayed
}
```

#### Key Features
- **Priority Queue**: Executes queries in priority order
- **Context-Aware Prioritization**: Adjusts priority based on user role and authentication requirements
- **Configurable Priority Rules**: Table-specific priority configurations with context modifiers
- **Concurrent Execution**: Supports multiple concurrent queries with priority ordering

#### Default Priority Configurations
- `auth`, `settings`: CRITICAL priority
- `profiles`: HIGH priority (with role-based modifiers)
- `clinicians`, `customers`: MEDIUM priority
- `analytics`, `logs`: LOW priority

### 2. Query Throttling System (`queryThrottlingSystem.ts`)

#### Key Features
- **Token Bucket Rate Limiting**: Prevents burst traffic while allowing normal flow
- **Sliding Window Rate Limiter**: Ensures consistent rate limiting over time windows
- **Adaptive Throttling**: Adjusts throttling based on system load
- **Priority-Aware**: Never throttles CRITICAL priority requests
- **Comprehensive Metrics**: Tracks throttling effectiveness and system performance

#### Configuration Options
```typescript
interface ThrottleConfig {
  maxRequestsPerSecond: number;    // Default: 10
  burstLimit: number;              // Default: 20
  throttleNonCritical: boolean;    // Default: true
  adaptiveThrottling: boolean;     // Default: true
  windowSizeMs: number;            // Default: 1000
}
```

### 3. Query Batching System (`queryBatchingSystem.ts`)

#### Key Features
- **Intelligent Batching**: Groups similar queries to reduce database connections
- **Adaptive Batch Sizing**: Optimizes batch sizes based on performance history
- **Operation-Specific Batching**: Handles SELECT, INSERT, and UPDATE operations
- **Performance Optimization**: Tracks batching efficiency and connection savings
- **Configurable Batching Rules**: Table and operation-based batching strategies

#### Configuration Options
```typescript
interface BatchConfig {
  maxBatchSize: number;           // Default: 50
  maxWaitTimeMs: number;          // Default: 100
  minBatchSize: number;           // Default: 2
  enableAdaptiveBatching: boolean; // Default: true
  batchByTable: boolean;          // Default: true
  batchByOperation: boolean;      // Default: true
}
```

## Integration Layer (`queryPrioritizationAndThrottling.ts`)

### QueryPerformanceManager

The main interface that coordinates all three systems:

```typescript
const result = await queryPerformanceManager.executeQuery(
  'query-id',
  () => supabase.from('clinicians').select('*'),
  {
    table: 'clinicians',
    operation: 'select',
    userContext: {
      userId: 'user123',
      role: 'admin',
      permissions: ['read', 'write']
    },
    authRequired: true,
    enableBatching: true,
    enableThrottling: true
  }
);
```

### Convenience Function

For simple query execution:

```typescript
const data = await executeOptimizedQuery(
  'simple-query',
  'clinicians',
  () => supabase.from('clinicians').select('*'),
  { operation: 'select' }
);
```

## Performance Benefits

### Expected Improvements
- **Query Response Time**: 60+ seconds → < 2 seconds (97% improvement)
- **Connection Efficiency**: 50%+ reduction in database connections through batching
- **System Stability**: Prevents cascading failures through intelligent throttling
- **Resource Utilization**: Optimal CPU and memory usage through priority-based execution

### Metrics and Monitoring

The system provides comprehensive metrics:

```typescript
const metrics = queryPerformanceManager.getPerformanceMetrics();

// Priority System Metrics
metrics.prioritySystem.queueStatus.total;           // Pending queries
metrics.prioritySystem.queueStatus.byPriority;     // Queries by priority level

// Throttling Metrics
metrics.throttlingSystem.metrics.throttleRatio;    // Percentage of throttled requests
metrics.throttlingSystem.metrics.currentRate;      // Current request rate

// Batching Metrics
metrics.batchingSystem.metrics.batchingEfficiency; // Batching effectiveness
metrics.batchingSystem.metrics.connectionsSaved;   // Database connections saved

// Overall Performance
metrics.overall.averageExecutionTime;              // Average query time
metrics.overall.systemLoad;                        // Current system load
metrics.overall.recommendations;                   // Performance recommendations
```

## Usage Examples

### Basic Query Execution
```typescript
import { executeOptimizedQuery, QueryPriority } from './queryPrioritizationAndThrottling';

// Execute with automatic optimization
const clinicians = await executeOptimizedQuery(
  'fetch-clinicians',
  'clinicians',
  () => supabase.from('clinicians').select('*')
);
```

### Advanced Query Execution
```typescript
import { queryPerformanceManager } from './queryPrioritizationAndThrottling';

const result = await queryPerformanceManager.executeQuery(
  'critical-auth-check',
  () => supabase.auth.getUser(),
  {
    table: 'auth',
    priority: QueryPriority.CRITICAL,
    authRequired: true,
    enableThrottling: false // Never throttle critical auth queries
  }
);
```

### Batch Query Execution
```typescript
const queries = [
  {
    id: 'fetch-clinicians',
    queryFn: () => supabase.from('clinicians').select('*'),
    options: { table: 'clinicians', operation: 'select' }
  },
  {
    id: 'fetch-customers',
    queryFn: () => supabase.from('customers').select('*'),
    options: { table: 'customers', operation: 'select' }
  }
];

const results = await queryPerformanceManager.executeQueries(queries);
```

### System Configuration
```typescript
queryPerformanceManager.configureSystem({
  throttling: {
    maxRequestsPerSecond: 15,
    burstLimit: 30
  },
  batching: {
    maxBatchSize: 25,
    maxWaitTimeMs: 150
  },
  maxConcurrentQueries: 5
});
```

## Integration with Existing Systems

### With useSupabaseQuery Hook
```typescript
// In your existing hook
const enhancedUseSupabaseQuery = (table, query, options) => {
  return useQuery({
    queryKey: [table, query],
    queryFn: () => executeOptimizedQuery(
      `${table}-${JSON.stringify(query)}`,
      table,
      () => supabase.from(table).select(query),
      { operation: 'select', ...options }
    )
  });
};
```

### With Circuit Breaker
```typescript
// The system integrates with existing circuit breaker
const result = await queryPerformanceManager.executeQuery(
  'protected-query',
  () => circuitBreaker.execute(() => supabase.from('table').select('*')),
  { table: 'table', operation: 'select' }
);
```

## Testing

Comprehensive test suite covers:
- Priority queue ordering and execution
- Throttling behavior under various load conditions
- Batching efficiency and optimization
- Error handling and recovery
- Performance metrics accuracy
- Integration between all systems

Run tests:
```bash
npx vitest run src/test/queryPrioritizationAndThrottling.test.ts
```

## Performance Monitoring

### Real-time Monitoring
```typescript
// Get current system status
const status = queryPerformanceManager.getPerformanceMetrics();

// Monitor throttling effectiveness
console.log(`Throttle ratio: ${status.throttlingSystem.metrics.throttleRatio * 100}%`);

// Monitor batching efficiency
console.log(`Batching efficiency: ${status.batchingSystem.metrics.batchingEfficiency * 100}%`);

// Get performance recommendations
status.overall.recommendations.forEach(rec => console.log(`Recommendation: ${rec}`));
```

### Performance Alerts
The system automatically generates recommendations when:
- Throttle ratio exceeds 20%
- Average execution time exceeds 2 seconds
- Batching efficiency drops below 30%
- High priority queries are being throttled
- System load exceeds 80%

## Best Practices

1. **Priority Assignment**: Use CRITICAL sparingly, only for authentication and essential settings
2. **Batching**: Enable batching for SELECT operations on large datasets
3. **Throttling**: Configure appropriate rate limits based on your database capacity
4. **Monitoring**: Regularly review performance metrics and apply recommendations
5. **Testing**: Test under realistic load conditions to validate performance improvements

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **Requirement 6.1**: ✅ Priority-based query execution with authentication and settings having highest priority
- **Requirement 6.2**: ✅ Request throttling with max 10 requests per second and non-critical query throttling
- **Requirement 6.5**: ✅ Query batching system to reduce database connection overhead

The system provides a comprehensive solution for query performance optimization while maintaining system stability and providing detailed monitoring capabilities.