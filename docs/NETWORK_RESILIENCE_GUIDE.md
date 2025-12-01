# Network Resilience System - Developer Guide

## Overview

This comprehensive network resilience system provides bulletproof data fetching, intelligent protocol management, and graceful degradation for your application. It eliminates HTTP/2 protocol errors, prevents redirect loops, and ensures reliable operation even during network issues.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Quick Start](#quick-start)
4. [Usage Examples](#usage-examples)
5. [Configuration](#configuration)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [API Reference](#api-reference)

## Architecture Overview

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     UI/UX Layer                              │
│  Network Indicators | Stale Data | Feature Availability     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Application Layer                           │
│  Enhanced Hooks | Protected Routing | Safe Navigation       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│               Query Coordination Layer                       │
│  Deduplication | Caching | Prioritization | Coordination    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│            Protocol & Connection Layer                       │
│  HTTP/2 ↔ HTTP/1.1 | Health Monitoring | Resilient Client  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Foundation Layer                            │
│  Error Classification | Retry Engine | Cache | Logging      │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action
    ↓
Enhanced Hook (useEnhancedSupabaseQuery)
    ↓
Request Prioritizer (priority queue)
    ↓
Query Coordinator (stale-while-revalidate)
    ↓
Query Deduplicator (prevent duplicates)
    ↓
Enhanced Resilient Client (protocol selection)
    ↓
Smart Retry Engine (exponential backoff)
    ↓
Supabase (HTTP/2 or HTTP/1.1)
    ↓
IndexedDB Cache (persistent storage)
    ↓
Result → UI
```

## Core Components

### 1. Enhanced Resilient Client

**Purpose**: Intelligent HTTP/2 ↔ HTTP/1.1 switching with comprehensive error handling.

**Location**: `src/integrations/supabase/enhancedResilientClient.ts`

**Key Features**:
- Automatic protocol switching on errors
- Success rate tracking per protocol
- Connection health monitoring
- Cache integration

**Usage**:
```typescript
import { enhancedResilientClient } from '@/integrations/supabase/enhancedResilientClient';

const result = await enhancedResilientClient.executeWithResilience(
  async (client) => {
    const { data, error } = await client
      .from('clinicians')
      .select('*');
    
    if (error) throw error;
    return data;
  },
  'clinicians.select',
  {
    enableCache: true,
    cacheKey: 'clinicians-list',
    cacheTTL: 3600000, // 1 hour
    priority: 'high'
  }
);
```

### 2. Query Coordinator

**Purpose**: Manages query lifecycle with stale-while-revalidate pattern.

**Location**: `src/utils/queryCoordinator.ts`

**Key Features**:
- Stale-while-revalidate
- Background refetching
- Query invalidation
- Subscriber notifications

**Usage**:
```typescript
import { queryCoordinator } from '@/utils/queryCoordinator';

const result = await queryCoordinator.executeQuery(
  {
    operation: 'clinicians.select',
    params: { tenant_id: 'abc123' },
    userId: user.id
  },
  async () => {
    // Your fetch logic
    return fetchClinicians();
  },
  {
    staleTime: 60000, // 1 minute
    cacheTTL: 3600000, // 1 hour
    retry: true
  }
);
```

### 3. Query Deduplicator

**Purpose**: Prevents duplicate simultaneous requests.

**Location**: `src/utils/queryDeduplicator.ts`

**Key Features**:
- Promise sharing
- Request coalescing
- Automatic cleanup

**Usage**:
```typescript
import { queryDeduplicator } from '@/utils/queryDeduplicator';

const result = await queryDeduplicator.deduplicate(
  {
    operation: 'clinicians.select',
    params: { tenant_id: 'abc123' },
    userId: user.id
  },
  async (signal) => {
    // Your fetch logic with abort signal
    return fetchClinicians(signal);
  }
);
```

### 4. Request Prioritizer

**Purpose**: Priority-based request queue with network-aware concurrency.

**Location**: `src/utils/requestPrioritizer.ts`

**Key Features**:
- 4 priority levels
- Network-aware concurrency
- Automatic escalation

**Usage**:
```typescript
import { requestPrioritizer } from '@/utils/requestPrioritizer';

const result = await requestPrioritizer.execute(
  'fetch-clinicians',
  async () => {
    return fetchClinicians();
  },
  'high' // priority: critical | high | medium | low
);
```

### 5. Role Detection Service

**Purpose**: Reliable role detection with 4-level fallback chain.

**Location**: `src/services/roleDetectionService.ts`

**Key Features**:
- Database → Cache → Session → Default
- Confidence scoring
- Automatic caching

**Usage**:
```typescript
import { roleDetectionService } from '@/services/roleDetectionService';

const result = await roleDetectionService.detectRole({
  userId: user.id,
  tenantId: tenant.id,
  sessionMetadata: user.user_metadata
});

console.log(result.role); // 'staff' | 'customer' | 'admin' | 'unknown'
console.log(result.confidence); // 0-1
console.log(result.source); // 'database' | 'cache' | 'session' | 'default'
```

### 6. Routing Protection Service

**Purpose**: Prevents redirect loops with intelligent detection.

**Location**: `src/services/routingProtectionService.ts`

**Key Features**:
- Loop detection
- Protection mode
- Navigation validation

**Usage**:
```typescript
import { routingProtectionService } from '@/services/routingProtectionService';

// Record redirects
routingProtectionService.recordRedirect('/login', '/dashboard', 'auth success');

// Validate navigation
const validation = routingProtectionService.validateNavigation('/dashboard', '/login');
if (!validation.isSafe) {
  console.log('Navigation blocked:', validation.reason);
}

// Check protection status
if (routingProtectionService.isProtected()) {
  console.log('Protection mode active');
}
```

## Quick Start

### 1. Install Dependencies

All dependencies are already included in your project.

### 2. Basic Query Hook Usage

```typescript
import { useEnhancedSupabaseQuery } from '@/hooks/data/useEnhancedSupabaseQuery';

function CliniciansPage() {
  const {
    data,
    loading,
    error,
    isStale,
    refetch,
    networkStatus
  } = useEnhancedSupabaseQuery({
    table: 'clinicians',
    select: '*',
    filters: { tenant_id: 'auto' },
    orderBy: { column: 'name', ascending: true },
    priority: 'high',
    staleTime: 60000 // 1 minute
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {isStale && <div>Refreshing data...</div>}
      {data.map(clinician => (
        <div key={clinician.id}>{clinician.name}</div>
      ))}
    </div>
  );
}
```

### 3. Protected Routing

```typescript
import { EnhancedAppRouterWithProtection } from '@/components/EnhancedAppRouterWithProtection';

function App() {
  return (
    <EnhancedAppRouterWithProtection
      allowedStates={['staff', 'admin']}
      fallbackPath="/"
      showProtectionUI={true}
    >
      <StaffDashboard />
    </EnhancedAppRouterWithProtection>
  );
}
```

### 4. Network Status Indicator

```typescript
import { EnhancedNetworkStatusIndicator } from '@/components/EnhancedNetworkStatusIndicator';

function App() {
  return (
    <>
      <EnhancedNetworkStatusIndicator
        position="top-right"
        compact={true}
        showDetails={true}
      />
      {/* Your app */}
    </>
  );
}
```

### 5. Feature Availability

```typescript
import { FeatureAvailability, NetworkAwareButton } from '@/components/FeatureAvailabilityIndicator';

function MyComponent() {
  return (
    <>
      {/* Wrap features that need network */}
      <FeatureAvailability requiresNetwork={true}>
        <Button onClick={syncData}>Sync Data</Button>
      </FeatureAvailability>

      {/* Or use network-aware button */}
      <NetworkAwareButton
        requiresGoodNetwork={true}
        onClick={uploadFile}
      >
        Upload File
      </NetworkAwareButton>
    </>
  );
}
```

## Configuration

### Cache Configuration

Configure cache behavior per table:

```typescript
// In your cache configuration file
export const cacheConfig = {
  clinicians: {
    staleTime: 300000, // 5 minutes
    cacheTTL: 3600000, // 1 hour
    backgroundRefresh: true
  },
  customers: {
    staleTime: 60000, // 1 minute
    cacheTTL: 1800000, // 30 minutes
    backgroundRefresh: true
  }
};
```

### Retry Configuration

Configure retry behavior:

```typescript
const retryOptions = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.1
};
```

### Priority Configuration

Set request priorities:

```typescript
// Critical: Auth, settings (max 4 concurrent)
// High: User data, permissions (max 3 concurrent)
// Medium: Business entities (max 2 concurrent)
// Low: Analytics, logs (max 1 concurrent)
```

## Best Practices

### 1. Always Use Enhanced Hooks

✅ **Good**:
```typescript
const { data, loading, error } = useEnhancedSupabaseQuery({
  table: 'clinicians',
  select: '*'
});
```

❌ **Avoid**:
```typescript
const { data, loading, error } = useSupabaseQuery({
  table: 'clinicians',
  select: '*'
});
```

### 2. Set Appropriate Priorities

```typescript
// Critical operations
useEnhancedSupabaseQuery({ 
  table: 'profiles',
  priority: 'critical' 
});

// Regular data fetching
useEnhancedSupabaseQuery({ 
  table: 'clinicians',
  priority: 'high' 
});

// Analytics/logs
useEnhancedSupabaseQuery({ 
  table: 'analytics',
  priority: 'low' 
});
```

### 3. Configure Stale Times Appropriately

```typescript
// Frequently changing data
staleTime: 30000 // 30 seconds

// Moderately changing data
staleTime: 300000 // 5 minutes

// Rarely changing data
staleTime: 3600000 // 1 hour
```

### 4. Use Feature Availability for Network-Dependent Features

```typescript
<FeatureAvailability requiresNetwork={true}>
  <UploadButton />
</FeatureAvailability>
```

### 5. Show Stale Data Indicators

```typescript
<DataTableWithStaleIndicator
  lastUpdated={lastUpdated}
  isStale={isStale}
  onRefresh={refetch}
>
  <Table data={data} />
</DataTableWithStaleIndicator>
```

## Troubleshooting

### Issue: HTTP/2 Protocol Errors

**Solution**: The system automatically switches to HTTP/1.1. Check protocol health:

```typescript
import { protocolHealthMonitor } from '@/utils/protocolHealthMonitor';

const comparison = protocolHealthMonitor.compareProtocols();
console.log('Recommended protocol:', comparison.recommended);
console.log('Reason:', comparison.reason);
```

### Issue: Redirect Loops

**Solution**: The system automatically detects and prevents loops. Check protection status:

```typescript
import { routingProtectionService } from '@/services/routingProtectionService';

if (routingProtectionService.isProtected()) {
  const state = routingProtectionService.getProtectionState();
  console.log('Protection reason:', state.reason);
}
```

### Issue: Stale Data

**Solution**: Adjust stale time or force refresh:

```typescript
const { refetch, invalidate } = useEnhancedSupabaseQuery({
  table: 'clinicians',
  staleTime: 60000 // Reduce stale time
});

// Force refresh
await refetch();

// Invalidate cache
await invalidate();
```

### Issue: Slow Queries

**Solution**: Check network quality and adjust priorities:

```typescript
import { networkQualityMonitor } from '@/utils/networkQualityMonitor';

const quality = networkQualityMonitor.getQuality();
console.log('Network status:', quality.status);
console.log('Error rate:', quality.metrics.errorRate);
```

### Issue: Export Diagnostics

**Solution**: Use the diagnostics export tool:

```typescript
import { diagnosticsExporter } from '@/utils/diagnosticsExporter';

// Copy to clipboard
await diagnosticsExporter.copyToClipboard('json');

// Download file
await diagnosticsExporter.downloadAsFile('json');
```

## API Reference

### Enhanced Resilient Client

```typescript
interface ResilienceOptions {
  enableCache?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  timeout?: number;
  retryOptions?: Partial<RetryOptions>;
}

executeWithResilience<T>(
  operation: (client: SupabaseClient) => Promise<T>,
  operationName: string,
  options?: ResilienceOptions
): Promise<T>
```

### Query Coordinator

```typescript
interface QueryOptions {
  cacheKey?: string;
  cacheTTL?: number;
  staleTime?: number;
  retry?: boolean;
  retryOptions?: Partial<RetryOptions>;
}

executeQuery<T>(
  queryKey: QueryKey,
  fetcher: () => Promise<T>,
  options?: QueryOptions
): Promise<QueryResult<T>>
```

### Role Detection Service

```typescript
interface RoleDetectionOptions {
  userId: string;
  tenantId?: string;
  sessionMetadata?: any;
  bypassCache?: boolean;
  timeout?: number;
}

detectRole(options: RoleDetectionOptions): Promise<RoleDetectionResult>
```

### Routing Protection Service

```typescript
recordRedirect(from: string, to: string, reason?: string): void
validateNavigation(from: string, to: string): NavigationValidation
isProtected(): boolean
getProtectionState(): ProtectionState
```

## Performance Tips

1. **Use appropriate stale times** - Balance freshness vs performance
2. **Set correct priorities** - Critical operations first
3. **Enable background refresh** - For frequently accessed data
4. **Monitor network quality** - Adjust behavior based on conditions
5. **Use query deduplication** - Automatic, but be aware of it
6. **Cache aggressively** - Especially for rarely changing data
7. **Prefetch data** - For predictable navigation patterns

## Support

For issues or questions:
1. Check the troubleshooting section
2. Export diagnostics for debugging
3. Review the logs in the console
4. Check network status indicator

---

**Version**: 1.0.0  
**Last Updated**: 2025-11-07
