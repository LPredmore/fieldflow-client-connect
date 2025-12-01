# Conditional Loading Patterns

This document describes the conditional loading patterns implemented to optimize database query performance and prevent unnecessary data fetching.

## Overview

Conditional loading prevents components from fetching data when it's not needed, reducing database load and improving page performance. This is especially important for shared components like Layout that render on every page.

## Implementation Patterns

### 1. Route-Based Conditional Loading

Load data only when the user is on a specific route that needs it.

```tsx
import { useLocation } from 'react-router-dom';
import { useUnifiedAppointments } from '@/hooks/useUnifiedAppointments';

function DashboardComponent() {
  const location = useLocation();
  const isDashboardRoute = location.pathname === '/';
  
  // Only load appointment data when on dashboard route
  const { unifiedJobs, loading, error } = useUnifiedAppointments({ 
    enabled: isDashboardRoute 
  });

  if (!isDashboardRoute) {
    return null; // Don't render if not on dashboard
  }

  return (
    <div>
      {loading ? 'Loading...' : `${unifiedJobs.length} appointments`}
    </div>
  );
}
```

### 2. Component Visibility-Based Loading

Load data only when a component is actually visible to the user.

```tsx
import { useState, useEffect } from 'react';
import { useUnifiedAppointments } from '@/hooks/useUnifiedAppointments';

function CollapsibleJobsList() {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Only load data when component is expanded
  const { unifiedJobs, loading } = useUnifiedAppointments({ 
    enabled: isExpanded 
  });

  return (
    <div>
      <button onClick={() => setIsExpanded(!isExpanded)}>
        {isExpanded ? 'Hide' : 'Show'} Jobs
      </button>
      
      {isExpanded && (
        <div>
          {loading ? 'Loading...' : unifiedJobs.map(job => (
            <div key={job.id}>{job.title}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3. Lazy Loading with Intersection Observer

Load data when a component comes into view.

```tsx
import { useState, useEffect, useRef } from 'react';
import { useUnifiedAppointments } from '@/hooks/useUnifiedAppointments';

function LazyJobsList() {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  // Only load data when component is visible
  const { unifiedJobs, loading } = useUnifiedAppointments({ 
    enabled: isVisible 
  });

  return (
    <div ref={ref}>
      {isVisible && (
        loading ? 'Loading...' : unifiedJobs.map(job => (
          <div key={job.id}>{job.title}</div>
        ))
      )}
    </div>
  );
}
```

### 4. Conditional Sub-Query Loading

Skip expensive sub-queries when only summary data is needed.

```tsx
import { useUnifiedAppointments } from '@/hooks/useUnifiedAppointments';

function JobsSummary() {
  // Skip occurrence queries for faster loading when only showing counts
  const { unifiedJobs, loading } = useUnifiedAppointments({ 
    enabled: true,
    skipOccurrences: true // Only load one-time jobs, skip recurring instances
  });

  return (
    <div>
      <h3>Jobs Summary</h3>
      <p>Total one-time jobs: {unifiedJobs.length}</p>
    </div>
  );
}

function DetailedJobsList() {
  // Load all data including occurrences for detailed view
  const { unifiedJobs, loading } = useUnifiedAppointments({ 
    enabled: true,
    skipOccurrences: false // Load both one-time and recurring jobs
  });

  return (
    <div>
      <h3>All Jobs</h3>
      {unifiedJobs.map(job => (
        <div key={job.id}>
          <h4>{job.title}</h4>
          <p>Type: {job.appointment_type}</p>
          <p>Status: {job.status}</p>
        </div>
      ))}
    </div>
  );
}
```

## Hook Options

### useUnifiedAppointments Options

```tsx
interface UseUnifiedAppointmentsOptions {
  /**
   * Controls whether the hook should execute queries
   * Default: true
   */
  enabled?: boolean;
  
  /**
   * Controls whether to skip appointment occurrence queries
   * Default: false
   */
  skipOccurrences?: boolean;
}
```

### useSupabaseQuery Options

```tsx
interface QueryOptions<T> {
  table: string;
  select?: string;
  filters?: Record<string, any>;
  orderBy?: { column: string; ascending?: boolean };
  
  /**
   * Controls whether the query should execute
   * Default: true
   */
  enabled?: boolean;
  
  /**
   * Time in ms before cached data is considered stale
   * Default: 5000ms (5 seconds)
   */
  staleTime?: number;
  
  /**
   * Minimum time between requests to prevent excessive querying
   * Default: 1000ms (1 second)
   */
  throttleMs?: number;
  
  // ... other options
}
```

## Performance Benefits

### Before Conditional Loading
- Every page load triggered appointment data fetching
- Services page loaded dashboard data unnecessarily
- 60+ second load times due to schema errors affecting all pages
- Circuit breaker blocked all queries globally

### After Conditional Loading
- Only dashboard loads appointment data
- Services page loads in <5 seconds
- Schema errors isolated to specific components
- Better resource utilization and user experience

## Best Practices

### 1. Use Route-Based Loading for Page-Specific Data
```tsx
// ✅ Good: Only load on relevant routes
const isDashboardRoute = location.pathname === '/';
const { data } = useQuery({ enabled: isDashboardRoute });

// ❌ Bad: Always loading regardless of route
const { data } = useQuery({ enabled: true });
```

### 2. Combine Multiple Conditions
```tsx
// ✅ Good: Multiple conditions for optimal loading
const shouldLoad = isVisible && isExpanded && hasPermission;
const { data } = useQuery({ enabled: shouldLoad });
```

### 3. Use skipOccurrences for Summary Views
```tsx
// ✅ Good: Skip heavy queries for summary
const { jobs } = useUnifiedAppointments({ 
  enabled: true, 
  skipOccurrences: true 
});

// ✅ Good: Load all data for detailed view
const { jobs } = useUnifiedAppointments({ 
  enabled: isDetailedView, 
  skipOccurrences: false 
});
```

### 4. Handle Loading States Appropriately
```tsx
function ConditionalComponent({ enabled }: { enabled: boolean }) {
  const { data, loading, error } = useQuery({ enabled });
  
  // Don't show loading spinner if query is disabled
  if (!enabled) {
    return <div>Component not active</div>;
  }
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <div>{data.map(item => ...)}</div>;
}
```

## Troubleshooting

### Common Issues

1. **Component still loading when disabled**
   - Check that `enabled: false` is properly passed to the hook
   - Verify loading state handling in component

2. **Data not loading when enabled**
   - Check that conditions are correctly evaluated
   - Verify user authentication and permissions

3. **Stale data showing**
   - This is expected behavior with stale-while-revalidate
   - Use `isStale` flag to show refresh indicators

### Debugging

```tsx
function DebugConditionalLoading() {
  const location = useLocation();
  const isDashboardRoute = location.pathname === '/';
  
  const { data, loading, isStale, lastUpdated } = useUnifiedAppointments({ 
    enabled: isDashboardRoute 
  });
  
  console.log('Conditional loading debug:', {
    currentRoute: location.pathname,
    isDashboardRoute,
    enabled: isDashboardRoute,
    loading,
    dataLength: data.length,
    isStale,
    lastUpdated
  });
  
  return (
    <div>
      <p>Route: {location.pathname}</p>
      <p>Enabled: {isDashboardRoute.toString()}</p>
      <p>Loading: {loading.toString()}</p>
      <p>Data count: {data.length}</p>
      <p>Is stale: {isStale.toString()}</p>
      <p>Last updated: {lastUpdated?.toISOString()}</p>
    </div>
  );
}
```

## Migration Guide

### Converting Existing Components

1. **Identify data dependencies**
   ```tsx
   // Before: Always loading
   function MyComponent() {
     const { data } = useQuery();
     return <div>{data.map(...)}</div>;
   }
   ```

2. **Add conditional logic**
   ```tsx
   // After: Conditional loading
   function MyComponent({ isActive }: { isActive: boolean }) {
     const { data } = useQuery({ enabled: isActive });
     
     if (!isActive) return null;
     return <div>{data.map(...)}</div>;
   }
   ```

3. **Update parent components**
   ```tsx
   function ParentComponent() {
     const location = useLocation();
     const isRelevantRoute = location.pathname === '/relevant-page';
     
     return (
       <div>
         <MyComponent isActive={isRelevantRoute} />
       </div>
     );
   }
   ```

This conditional loading system ensures optimal performance by only fetching data when it's actually needed, while maintaining a smooth user experience through caching and graceful degradation.