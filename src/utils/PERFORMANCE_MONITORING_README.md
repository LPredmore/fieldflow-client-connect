# Query Performance Monitoring System

This system provides comprehensive real-time monitoring and analysis of database query performance, including automated alerting, trend analysis, and system health metrics.

## Components

### 1. QueryPerformanceMonitor (`queryPerformanceMonitor.ts`)
- **Purpose**: Core monitoring engine that tracks individual query executions
- **Features**:
  - Real-time metrics collection
  - Performance trend analysis
  - Automated alerting system
  - Configurable thresholds

### 2. PerformanceMetricsAggregator (`performanceMetricsAggregator.ts`)
- **Purpose**: Advanced analytics and aggregation of performance data
- **Features**:
  - Statistical analysis (percentiles, trends)
  - System health scoring
  - Performance comparisons
  - Intelligent recommendations

### 3. QueryPerformanceDashboard (`QueryPerformanceDashboard.tsx`)
- **Purpose**: React component for visualizing performance metrics
- **Features**:
  - Real-time dashboard with multiple time windows
  - System health overview
  - Performance alerts display
  - Table-specific metrics
  - Trend analysis and comparisons

## Usage

### Basic Integration

```typescript
import { queryPerformanceMonitor } from '@/utils/queryPerformanceMonitor';

// Start tracking a query
const queryId = queryPerformanceMonitor.startQuery('clinicians', 'HIGH', {
  component: 'CliniciansList',
  userId: 'user123'
});

// End tracking when query completes
queryPerformanceMonitor.endQuery(queryId, {
  cacheHit: false,
  resultCount: 25,
  networkTime: 150,
  processingTime: 50
});
```

### Using the Enhanced Hook

```typescript
import { useSupabaseQueryWithPerformanceMonitoring } from '@/hooks/useSupabaseQueryWithPerformanceMonitoring';

function CliniciansList() {
  const { data, loading, error } = useSupabaseQueryWithPerformanceMonitoring({
    table: 'clinicians',
    select: 'id, name, email, active',
    filters: { active: true },
    priority: 'HIGH',
    context: { component: 'CliniciansList' }
  });

  // Component logic...
}
```

### Monitoring Existing Queries

```typescript
import { useQueryMonitoring } from '@/hooks/useSupabaseQueryWithPerformanceMonitoring';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';

function ExistingComponent() {
  const queryResult = useSupabaseQuery({
    table: 'customers',
    select: 'id, name, email',
    filters: { active: true }
  });

  // Add monitoring to existing query
  useQueryMonitoring(queryResult, 'customers', {
    priority: 'MEDIUM',
    context: { component: 'CustomersList' }
  });

  return (
    // Component JSX...
  );
}
```

### Dashboard Integration

```typescript
import { QueryPerformanceDashboard } from '@/components/Admin/QueryPerformanceDashboard';

function AdminDashboard() {
  return (
    <div>
      <h1>System Administration</h1>
      <QueryPerformanceDashboard 
        autoRefresh={true}
        refreshInterval={5000}
      />
    </div>
  );
}
```

### Alert Subscription

```typescript
import { subscribeToPerformanceAlerts } from '@/utils/performanceMonitoringIntegration';

// Subscribe to performance alerts
const unsubscribe = subscribeToPerformanceAlerts((alert) => {
  console.log('Performance Alert:', alert);
  
  if (alert.severity === 'CRITICAL') {
    // Handle critical alerts (e.g., show notification, send to monitoring service)
    showNotification({
      title: 'Critical Performance Issue',
      message: alert.message,
      type: 'error'
    });
  }
});

// Cleanup subscription
return unsubscribe;
```

## Configuration

### Performance Thresholds

```typescript
import { updatePerformanceThresholds } from '@/utils/performanceMonitoringIntegration';

// Update monitoring thresholds
updatePerformanceThresholds({
  maxQueryTime: 2000,        // 2 seconds
  minCacheHitRate: 70,       // 70%
  maxErrorRate: 1,           // 1%
  maxCircuitBreakerActivations: 5,
  maxAuthenticationDelay: 500,
  performanceDegradationThreshold: 20  // 20% change
});
```

### Time Windows

The system supports multiple time windows for analysis:
- Last 5 Minutes
- Last 15 Minutes  
- Last Hour
- Last 6 Hours
- Last 24 Hours

## Metrics Collected

### Query-Level Metrics
- **Duration**: Total query execution time
- **Cache Hit/Miss**: Whether result came from cache
- **Deduplication**: Whether request was deduplicated
- **Circuit Breaker State**: State during query execution
- **Authentication Delay**: Time spent on auth checks
- **Network/Processing Time**: Breakdown of execution time
- **Result Count**: Number of records returned
- **Error Information**: Type and details of any errors

### Aggregated Metrics
- **Average Query Time**: Mean execution time across queries
- **Cache Hit Rate**: Percentage of queries served from cache
- **Error Rate**: Percentage of failed queries
- **Deduplication Savings**: Percentage of requests saved
- **Circuit Breaker Activations**: Number of circuit breaker triggers
- **Performance Trend**: Improving/stable/degrading analysis

### System Health Metrics
- **Overall Health Score**: 0-100 composite score
- **Component Health**: Individual scores for cache, queries, circuit breaker, deduplication
- **Recommendations**: Automated suggestions for improvement

## Alerts

### Alert Types
- **SLOW_QUERY**: Queries exceeding time thresholds
- **HIGH_ERROR_RATE**: Error rate above acceptable limits
- **LOW_CACHE_HIT_RATE**: Cache performance below targets
- **CIRCUIT_BREAKER_ACTIVE**: Circuit breaker preventing requests
- **PERFORMANCE_DEGRADATION**: Declining performance trends

### Alert Severities
- **CRITICAL**: Immediate attention required
- **HIGH**: Important issues affecting performance
- **MEDIUM**: Notable issues that should be addressed
- **LOW**: Minor issues or informational alerts

## Best Practices

### 1. Query Priority Assignment
- **CRITICAL**: Authentication, settings, core configuration
- **HIGH**: User profiles, permissions, frequently accessed data
- **MEDIUM**: Business entities, operational data
- **LOW**: Analytics, logs, background processes

### 2. Context Information
Always provide meaningful context:
```typescript
{
  component: 'ComponentName',
  userId: 'user123',
  feature: 'feature-name',
  userRole: 'admin'
}
```

### 3. Threshold Configuration
- Set realistic thresholds based on your application's requirements
- Monitor trends and adjust thresholds as needed
- Consider different thresholds for different environments (dev/staging/prod)

### 4. Alert Management
- Subscribe to alerts in appropriate components
- Implement proper error handling and user feedback
- Consider integrating with external monitoring services

## Integration with Existing Systems

### Cache Integration
The monitoring system integrates with the enhanced query cache to track:
- Cache hit/miss rates
- Cache age and staleness
- Background refresh operations

### Circuit Breaker Integration
Monitors circuit breaker state and activations:
- Tracks when circuit breaker opens/closes
- Correlates circuit breaker state with query performance
- Provides insights into system stability

### Deduplication Integration
Tracks request deduplication effectiveness:
- Measures percentage of requests saved
- Identifies opportunities for optimization
- Monitors deduplication performance impact

## Development and Testing

### Clearing Data
```typescript
import { clearPerformanceData } from '@/utils/performanceMonitoringIntegration';

// Clear all monitoring data (useful for testing)
clearPerformanceData();
```

### Getting Current Metrics
```typescript
import { getCurrentPerformanceMetrics } from '@/utils/performanceMonitoringIntegration';

// Get current performance metrics
const metrics = getCurrentPerformanceMetrics(300000); // Last 5 minutes
console.log('Current Performance:', metrics);
```

### System Health Check
```typescript
import { getSystemHealth } from '@/utils/performanceMonitoringIntegration';

// Get system health information
const health = getSystemHealth();
console.log('System Health Score:', health.healthScore);
console.log('Recommendations:', health.recommendations);
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**: The system maintains metrics in memory. If memory usage becomes a concern, consider:
   - Reducing the metrics history size
   - Implementing periodic cleanup
   - Using external storage for long-term metrics

2. **Performance Impact**: The monitoring system is designed to be lightweight, but if you notice performance impact:
   - Disable monitoring in development environments
   - Reduce the frequency of aggregation
   - Optimize the metrics collection process

3. **Alert Fatigue**: If receiving too many alerts:
   - Adjust thresholds to be more appropriate
   - Implement alert rate limiting
   - Focus on critical alerts first

### Debugging

Enable detailed logging by setting the appropriate log levels in your environment. The system provides comprehensive logging for:
- Query start/end events
- Performance calculations
- Alert generation
- System health changes

## Future Enhancements

Potential improvements to consider:
- Integration with external monitoring services (DataDog, New Relic, etc.)
- Historical data persistence
- Advanced machine learning for anomaly detection
- Custom dashboard widgets
- Performance regression testing automation
- Real-time performance optimization suggestions