# Post-Deployment Monitoring Checklist

This checklist ensures proper validation of the database query performance fixes after deployment.

## Immediate Monitoring (First 30 Minutes)

### Performance Metrics
Check every 5 minutes:

- [ ] **Dashboard Page Load Time**
  - Target: < 5 seconds
  - Method: Browser DevTools Network tab or automated monitoring
  - Alert if: > 10 seconds

- [ ] **Services Page Load Time**
  - Target: < 5 seconds  
  - Method: Browser DevTools Network tab or automated monitoring
  - Alert if: > 8 seconds

- [ ] **Other Pages Load Time**
  - Target: < 10 seconds
  - Method: Spot check key pages (customers, appointments, reports)
  - Alert if: > 15 seconds

### Database Query Health
- [ ] **Query Success Rate**
  - Target: > 98%
  - Method: Check application logs or monitoring dashboard
  - Alert if: < 95%

- [ ] **Circuit Breaker State**
  - Target: CLOSED
  - Method: Check circuit breaker monitoring logs
  - Alert if: OPEN for > 2 minutes

- [ ] **Schema Error Count**
  - Target: 0
  - Method: Search logs for "column does not exist" errors
  - Alert if: Any schema errors found

### User Experience Indicators
- [ ] **JavaScript Errors**
  - Target: < baseline + 10%
  - Method: Browser console, error tracking service
  - Alert if: > baseline + 25%

- [ ] **Failed Page Loads**
  - Target: < 2%
  - Method: Server logs, monitoring service
  - Alert if: > 5%

## Short-Term Monitoring (First 4 Hours)

### Detailed Performance Analysis
Check every 30 minutes:

- [ ] **Average Query Response Time**
  ```sql
  SELECT 
    table_name,
    AVG(duration_ms) as avg_duration,
    COUNT(*) as query_count
  FROM query_performance_logs 
  WHERE timestamp > NOW() - INTERVAL '30 minutes'
  GROUP BY table_name
  ORDER BY avg_duration DESC;
  ```

- [ ] **Circuit Breaker Events**
  ```sql
  SELECT 
    event_type,
    COUNT(*) as event_count,
    MAX(timestamp) as last_occurrence
  FROM circuit_breaker_logs 
  WHERE timestamp > NOW() - INTERVAL '30 minutes'
  GROUP BY event_type;
  ```

- [ ] **Error Rate by Type**
  ```sql
  SELECT 
    error_type,
    COUNT(*) as error_count,
    COUNT(*) * 100.0 / (SELECT COUNT(*) FROM request_logs WHERE timestamp > NOW() - INTERVAL '30 minutes') as error_percentage
  FROM error_logs 
  WHERE timestamp > NOW() - INTERVAL '30 minutes'
  GROUP BY error_type;
  ```

### Conditional Loading Validation
- [ ] **Dashboard Route Data Loading**
  - Method: Navigate to dashboard, check network tab
  - Expected: Appointment queries execute
  - Alert if: No appointment data loads

- [ ] **Non-Dashboard Route Data Loading**
  - Method: Navigate to services page, check network tab
  - Expected: No appointment queries execute
  - Alert if: Unnecessary appointment queries found

- [ ] **Component Visibility Loading**
  - Method: Test expandable/collapsible components
  - Expected: Data loads only when expanded
  - Alert if: Data loads when collapsed

## Extended Monitoring (First 24 Hours)

### Performance Trend Analysis
Check every 2 hours:

- [ ] **Page Load Time Trends**
  ```javascript
  // Example monitoring query
  const loadTimes = await getPageLoadTimes({
    timeRange: '2h',
    pages: ['dashboard', 'services', 'customers', 'appointments']
  });
  
  // Alert if any page shows degrading trend
  loadTimes.forEach(page => {
    if (page.trend === 'increasing' && page.avgTime > page.baseline * 1.2) {
      alert(`${page.name} load time degrading: ${page.avgTime}ms`);
    }
  });
  ```

- [ ] **Database Connection Pool Health**
  ```sql
  SELECT 
    active_connections,
    idle_connections,
    max_connections,
    (active_connections * 100.0 / max_connections) as utilization_percent
  FROM pg_stat_database 
  WHERE datname = 'your_database';
  ```

- [ ] **Memory Usage Patterns**
  - Method: Monitor application memory usage
  - Expected: Stable or reduced memory usage
  - Alert if: Memory usage increases >20% from baseline

### User Impact Assessment
- [ ] **Session Duration Changes**
  ```sql
  SELECT 
    DATE_TRUNC('hour', session_start) as hour,
    AVG(session_duration_minutes) as avg_duration,
    COUNT(*) as session_count
  FROM user_sessions 
  WHERE session_start > NOW() - INTERVAL '24 hours'
  GROUP BY hour
  ORDER BY hour;
  ```

- [ ] **Feature Usage Patterns**
  ```sql
  SELECT 
    feature_name,
    COUNT(*) as usage_count,
    COUNT(DISTINCT user_id) as unique_users
  FROM feature_usage_logs 
  WHERE timestamp > NOW() - INTERVAL '24 hours'
  GROUP BY feature_name
  ORDER BY usage_count DESC;
  ```

- [ ] **User Complaint Tracking**
  - Method: Monitor support tickets, user feedback
  - Expected: No increase in performance-related complaints
  - Alert if: >3 performance complaints in 4 hours

## Long-Term Monitoring (First Week)

### Weekly Performance Review
Check daily:

- [ ] **Performance Improvement Validation**
  ```sql
  -- Compare current week to previous week
  WITH current_week AS (
    SELECT AVG(page_load_time_ms) as avg_load_time
    FROM performance_logs 
    WHERE timestamp > NOW() - INTERVAL '7 days'
  ),
  previous_week AS (
    SELECT AVG(page_load_time_ms) as avg_load_time
    FROM performance_logs 
    WHERE timestamp BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
  )
  SELECT 
    c.avg_load_time as current_avg,
    p.avg_load_time as previous_avg,
    ((c.avg_load_time - p.avg_load_time) / p.avg_load_time * 100) as improvement_percent
  FROM current_week c, previous_week p;
  ```

- [ ] **Circuit Breaker Stability**
  ```sql
  SELECT 
    DATE(timestamp) as date,
    COUNT(CASE WHEN event_type = 'OPEN' THEN 1 END) as opens,
    COUNT(CASE WHEN event_type = 'CLOSE' THEN 1 END) as closes,
    AVG(CASE WHEN event_type = 'FAILURE' THEN failure_count END) as avg_failures
  FROM circuit_breaker_logs 
  WHERE timestamp > NOW() - INTERVAL '7 days'
  GROUP BY DATE(timestamp)
  ORDER BY date;
  ```

- [ ] **Error Rate Stability**
  ```sql
  SELECT 
    DATE(timestamp) as date,
    error_type,
    COUNT(*) as error_count,
    COUNT(*) * 100.0 / (
      SELECT COUNT(*) 
      FROM request_logs r 
      WHERE DATE(r.timestamp) = DATE(e.timestamp)
    ) as error_rate_percent
  FROM error_logs e
  WHERE timestamp > NOW() - INTERVAL '7 days'
  GROUP BY DATE(timestamp), error_type
  ORDER BY date, error_rate_percent DESC;
  ```

## Automated Monitoring Setup

### Key Metrics Dashboard
Create monitoring dashboard with:

```javascript
// Example dashboard configuration
const dashboardMetrics = {
  pageLoadTimes: {
    query: 'avg(page_load_time_ms) by (page_name)',
    threshold: { warning: 5000, critical: 10000 },
    interval: '1m'
  },
  
  circuitBreakerState: {
    query: 'circuit_breaker_state',
    threshold: { critical: 'OPEN' },
    interval: '30s'
  },
  
  errorRate: {
    query: 'rate(error_count[5m]) * 100',
    threshold: { warning: 1, critical: 5 },
    interval: '1m'
  },
  
  querySuccessRate: {
    query: '(successful_queries / total_queries) * 100',
    threshold: { warning: 95, critical: 90 },
    interval: '1m'
  }
};
```

### Alert Configuration
```yaml
# Example alert rules
alerts:
  - name: PageLoadTimeHigh
    condition: page_load_time_ms > 10000
    duration: 2m
    severity: critical
    
  - name: CircuitBreakerOpen
    condition: circuit_breaker_state == "OPEN"
    duration: 1m
    severity: critical
    
  - name: ErrorRateHigh
    condition: error_rate > 5%
    duration: 5m
    severity: warning
    
  - name: QueryFailureRateHigh
    condition: query_failure_rate > 2%
    duration: 3m
    severity: warning
```

## Rollback Decision Matrix

| Metric | Warning Threshold | Critical Threshold | Action |
|--------|------------------|-------------------|---------|
| Page Load Time | >8 seconds | >15 seconds | Monitor / Rollback |
| Error Rate | >2% | >5% | Investigate / Rollback |
| Circuit Breaker Opens | >3 per hour | >5 per hour | Investigate / Rollback |
| Query Failure Rate | >1% | >3% | Monitor / Rollback |
| User Complaints | >2 per hour | >5 per hour | Investigate / Rollback |

## Success Validation Checklist

After 24 hours, confirm:

- [ ] **Performance Improvements Achieved**
  - Dashboard loads in <5 seconds consistently
  - Services page loads in <5 seconds consistently
  - Overall page load time improved by >50%

- [ ] **Stability Maintained**
  - Error rates remain at or below baseline
  - Circuit breaker opens <1 time per day
  - No increase in user complaints

- [ ] **Conditional Loading Working**
  - Non-dashboard pages don't load appointment data
  - Components load data only when needed
  - Network requests reduced on non-relevant pages

- [ ] **Graceful Degradation Functional**
  - Cached data shows during circuit breaker open
  - User-friendly error messages display
  - No blank screens or crashes during failures

## Monitoring Tools and Commands

### Browser-Based Monitoring
```javascript
// Performance monitoring snippet
const measurePageLoad = () => {
  const navigation = performance.getEntriesByType('navigation')[0];
  const loadTime = navigation.loadEventEnd - navigation.fetchStart;
  console.log(`Page load time: ${loadTime}ms`);
  
  // Send to monitoring service
  analytics.track('page_load_time', {
    page: window.location.pathname,
    loadTime: loadTime,
    timestamp: new Date().toISOString()
  });
};

window.addEventListener('load', measurePageLoad);
```

### Server-Side Monitoring
```bash
# Check application logs for errors
tail -f /var/log/app/error.log | grep -E "(schema|circuit|query)"

# Monitor database connections
psql -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;"

# Check memory usage
free -h && ps aux --sort=-%mem | head -10
```

### Network Monitoring
```bash
# Monitor API response times
curl -w "@curl-format.txt" -o /dev/null -s "https://your-app.com/api/appointments"

# Check DNS resolution time
dig your-app.com

# Monitor SSL certificate
openssl s_client -connect your-app.com:443 -servername your-app.com < /dev/null
```

This comprehensive monitoring checklist ensures that the performance fixes are working correctly and helps identify any issues early for quick resolution.