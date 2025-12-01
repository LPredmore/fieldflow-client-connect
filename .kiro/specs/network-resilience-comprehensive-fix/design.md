# Design Document

## Overview

This design implements a production-grade, multi-layered network resilience system that eliminates redirect loops, handles all network failure scenarios, and provides graceful degradation. The solution is architected to be bulletproof, maintainable, and performant.

## Architecture

### Layer 1: Connection Protocol Management
- **ResilientSupabaseClient**: Enhanced with intelligent protocol switching
- **ProtocolHealthMonitor**: Tracks HTTP/2 vs HTTP/1.1 success rates
- **AdaptiveProtocolSelector**: Chooses optimal protocol based on historical performance

### Layer 2: Request Execution & Retry
- **SmartRetryEngine**: Implements exponential backoff with jitter
- **ErrorClassifier**: Categorizes errors for appropriate handling
- **RequestPrioritizer**: Manages request queue based on priority
- **CircuitBreaker**: Prevents cascade failures

### Layer 3: Data Caching & Persistence
- **IndexedDBCache**: Persistent storage for offline capability
- **CacheInvalidationManager**: Smart cache expiration and refresh
- **OptimisticUpdateManager**: Handles offline mutations

### Layer 4: Query Coordination
- **QueryDeduplicator**: Prevents duplicate simultaneous requests
- **QueryCoordinator**: Manages query lifecycle and dependencies
- **StaleWhileRevalidate**: Returns cache immediately while fetching fresh data

### Layer 5: Role Detection & Routing
- **RoleDetectionService**: Multi-source role determination with fallbacks
- **RoutingProtectionService**: Prevents redirect loops
- **SafeNavigationManager**: Network-aware navigation

### Layer 6: Monitoring & Diagnostics
- **NetworkQualityMonitor**: Continuous health assessment
- **PerformanceTracker**: Metrics collection and analysis
- **DiagnosticsExporter**: Comprehensive debugging information

## Components and Interfaces

### 1. Enhanced Resilient Supabase Client

```typescript
interface ProtocolStrategy {
  name: 'http2' | 'http1.1' | 'adaptive';
  successRate: number;
  lastError: Date | null;
  consecutiveFailures: number;
}

interface ConnectionHealth {
  protocol: 'http2' | 'http1.1';
  quality: 'excellent' | 'good' | 'poor' | 'critical';
  errorRate: number;
  avgResponseTime: number;
  lastSuccessfulRequest: Date;
}

class EnhancedResilientClient {
  // Protocol management
  private protocolStrategies: Map<string, ProtocolStrategy>;
  private currentProtocol: 'http2' | 'http1.1';
  
  // Health monitoring
  private healthMonitor: ProtocolHealthMonitor;
  private connectionHealth: ConnectionHealth;
  
  // Request execution
  async executeWithResilience<T>(
    operation: Operation<T>,
    options: ResilienceOptions
  ): Promise<Result<T>>;
  
  // Protocol selection
  selectOptimalProtocol(): 'http2' | 'http1.1';
  
  // Health assessment
  assessConnectionHealth(): ConnectionHealth;
}
```

### 2. Smart Retry Engine

```typescript
interface RetryStrategy {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

interface RetryContext {
  attempt: number;
  lastError: Error;
  totalDuration: number;
  cacheAvailable: boolean;
}

class SmartRetryEngine {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    strategy: RetryStrategy,
    shouldRetry: (error: Error, context: RetryContext) => boolean
  ): Promise<T>;
  
  calculateBackoff(attempt: number, strategy: RetryStrategy): number;
  
  shouldRetryError(error: Error): boolean;
}
```

### 3. Error Classifier

```typescript
enum ErrorCategory {
  NETWORK = 'network',
  PROTOCOL = 'protocol',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  SERVER = 'server',
  CLIENT = 'client',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

interface ClassifiedError {
  category: ErrorCategory;
  isRetryable: boolean;
  retryDelay: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userMessage: string;
  technicalDetails: string;
}

class ErrorClassifier {
  classify(error: unknown): ClassifiedError;
  
  isNetworkError(error: unknown): boolean;
  isProtocolError(error: unknown): boolean;
  isAuthError(error: unknown): boolean;
  
  getRetryStrategy(error: ClassifiedError): RetryStrategy;
}
```

### 4. IndexedDB Cache Manager

```typescript
interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: Date;
  expiresAt: Date;
  version: number;
  metadata: {
    queryKey: string;
    userId: string;
    tenantId?: string;
  };
}

interface CacheOptions {
  ttl: number; // Time to live in milliseconds
  staleWhileRevalidate: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

class IndexedDBCacheManager {
  async get<T>(key: string): Promise<CacheEntry<T> | null>;
  
  async set<T>(key: string, data: T, options: CacheOptions): Promise<void>;
  
  async invalidate(pattern: string): Promise<void>;
  
  async getStaleData<T>(key: string, maxAge: number): Promise<T | null>;
  
  async cleanup(): Promise<void>; // Remove expired entries
}
```

### 5. Role Detection Service

```typescript
interface RoleSource {
  name: string;
  priority: number;
  fetch: () => Promise<UserRole | null>;
  isFallback: boolean;
}

interface UserRole {
  role: 'staff' | 'client';
  isAdmin: boolean;
  isClinician: boolean;
  source: string; // Which source provided this data
  confidence: 'high' | 'medium' | 'low';
  timestamp: Date;
}

class RoleDetectionService {
  private sources: RoleSource[] = [
    { name: 'database', priority: 1, fetch: this.fetchFromDatabase, isFallback: false },
    { name: 'cache', priority: 2, fetch: this.fetchFromCache, isFallback: true },
    { name: 'session', priority: 3, fetch: this.fetchFromSession, isFallback: true },
    { name: 'default', priority: 4, fetch: this.getDefaultRole, isFallback: true }
  ];
  
  async detectRole(userId: string): Promise<UserRole>;
  
  private async fetchFromDatabase(userId: string): Promise<UserRole | null>;
  private async fetchFromCache(userId: string): Promise<UserRole | null>;
  private async fetchFromSession(userId: string): Promise<UserRole | null>;
  private getDefaultRole(): UserRole;
}
```

### 6. Routing Protection Service

```typescript
interface RedirectAttempt {
  from: string;
  to: string;
  timestamp: Date;
  reason: string;
}

interface ProtectionState {
  isActive: boolean;
  redirectHistory: RedirectAttempt[];
  lastRedirect: Date | null;
  consecutiveRedirects: number;
}

class RoutingProtectionService {
  private readonly MAX_REDIRECTS = 3;
  private readonly REDIRECT_WINDOW = 5000; // 5 seconds
  
  canNavigate(to: string, reason: string): boolean;
  
  recordRedirect(from: string, to: string, reason: string): void;
  
  isInProtectionMode(): boolean;
  
  resetProtection(): void;
  
  getProtectionState(): ProtectionState;
}
```

### 7. Query Coordinator

```typescript
interface QueryState<T> {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: T | null;
  error: Error | null;
  isCached: boolean;
  cacheAge: number;
  lastFetch: Date | null;
}

interface QueryOptions {
  enabled: boolean;
  staleTime: number;
  cacheTime: number;
  retry: boolean | number;
  retryDelay: number;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

class QueryCoordinator {
  private activeQueries: Map<string, Promise<any>>;
  private queryStates: Map<string, QueryState<any>>;
  
  async executeQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    options: QueryOptions
  ): Promise<T>;
  
  deduplicateQuery<T>(queryKey: string, queryFn: () => Promise<T>): Promise<T>;
  
  invalidateQueries(pattern: string): void;
  
  prefetchQuery<T>(queryKey: string, queryFn: () => Promise<T>): void;
}
```

### 8. Network Quality Monitor

```typescript
interface NetworkMetrics {
  errorRate: number; // Percentage of failed requests
  avgResponseTime: number; // Average response time in ms
  protocolErrors: number; // Count of HTTP/2 protocol errors
  timeoutRate: number; // Percentage of timed out requests
  lastSuccessfulRequest: Date | null;
}

interface NetworkQuality {
  status: 'excellent' | 'good' | 'poor' | 'critical' | 'offline';
  metrics: NetworkMetrics;
  recommendations: string[];
}

class NetworkQualityMonitor {
  private metrics: NetworkMetrics;
  private readonly MONITOR_INTERVAL = 30000; // 30 seconds
  
  startMonitoring(): void;
  
  stopMonitoring(): void;
  
  recordRequest(success: boolean, duration: number, error?: Error): void;
  
  getQuality(): NetworkQuality;
  
  shouldUseConservativeMode(): boolean;
}
```

## Data Models

### Cache Schema (IndexedDB)

```typescript
// Store: 'queries'
interface QueryCache {
  id: string; // Primary key
  queryKey: string; // Indexed
  data: any;
  timestamp: number;
  expiresAt: number;
  userId: string; // Indexed
  version: number;
}

// Store: 'auth'
interface AuthCache {
  id: string; // Primary key: userId
  role: 'staff' | 'client';
  isAdmin: boolean;
  isClinician: boolean;
  tenantId: string;
  timestamp: number;
  expiresAt: number;
}

// Store: 'mutations'
interface PendingMutation {
  id: string; // Primary key
  operation: 'insert' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: number;
  retryCount: number;
  userId: string; // Indexed
}
```

### Network State

```typescript
interface NetworkState {
  isOnline: boolean;
  quality: 'excellent' | 'good' | 'poor' | 'critical';
  protocol: 'http2' | 'http1.1';
  errorRate: number;
  avgResponseTime: number;
  lastCheck: Date;
}
```

## Error Handling

### Error Classification Matrix

| Error Type | Category | Retryable | Retry Delay | Fallback Strategy |
|------------|----------|-----------|-------------|-------------------|
| ERR_HTTP2_PROTOCOL_ERROR | Protocol | Yes | Immediate | Switch to HTTP/1.1 |
| ERR_CONNECTION_RESET | Network | Yes | 1s, 2s, 4s | Use cache |
| ERR_CONNECTION_CLOSED | Network | Yes | 1s, 2s, 4s | Use cache |
| ETIMEDOUT | Timeout | Yes | 2s, 4s, 8s | Use cache |
| 401 Unauthorized | Auth | No | N/A | Redirect to login |
| 403 Forbidden | Authorization | No | N/A | Show permission error |
| 404 Not Found | Client | No | N/A | Return null |
| 500 Server Error | Server | Yes | 5s, 10s, 20s | Use cache |
| 502 Bad Gateway | Server | Yes | 5s, 10s, 20s | Use cache |
| 503 Service Unavailable | Server | Yes | 10s, 20s, 40s | Use cache |

### Error Recovery Flow

```
Request Initiated
    ↓
Execute with Primary Protocol (HTTP/2)
    ↓
Error Occurred?
    ↓ Yes
Classify Error
    ↓
Is Protocol Error?
    ↓ Yes
Switch to HTTP/1.1 → Retry
    ↓
Still Failed?
    ↓ Yes
Is Retryable?
    ↓ Yes
Apply Retry Strategy
    ↓
Max Retries Reached?
    ↓ Yes
Check Cache
    ↓
Cache Available?
    ↓ Yes
Return Cached Data (with stale indicator)
    ↓ No
Return Error with User-Friendly Message
```

## Testing Strategy

### Unit Tests
- Error classification accuracy
- Retry logic with various error types
- Cache hit/miss scenarios
- Protocol selection logic
- Role detection fallback chain

### Integration Tests
- End-to-end query flow with network failures
- Cache persistence across sessions
- Protocol switching under load
- Redirect loop prevention
- Offline mode functionality

### Performance Tests
- Query deduplication effectiveness
- Cache lookup performance
- Protocol switch overhead
- Memory usage with large cache
- Concurrent request handling

### Chaos Engineering Tests
- Random network failures
- Intermittent HTTP/2 errors
- Database unavailability
- Cache corruption
- Simultaneous protocol errors

## Deployment Strategy

### Phase 1: Foundation (Week 1)
- Implement enhanced error classifier
- Implement smart retry engine
- Implement IndexedDB cache manager
- Add comprehensive logging

### Phase 2: Protocol & Connection (Week 2)
- Enhance resilient Supabase client
- Implement protocol health monitoring
- Implement adaptive protocol selection
- Add connection quality monitoring

### Phase 3: Query Coordination (Week 3)
- Implement query deduplicator
- Implement query coordinator
- Implement stale-while-revalidate
- Add request prioritization

### Phase 4: Role Detection & Routing (Week 4)
- Implement role detection service
- Implement routing protection service
- Enhance useStaffRouting with fallbacks
- Add safe navigation manager

### Phase 5: Monitoring & Polish (Week 5)
- Implement network quality monitor
- Add diagnostics exporter
- Implement UI indicators
- Performance optimization

### Phase 6: Testing & Validation (Week 6)
- Comprehensive testing
- Load testing
- Chaos engineering
- User acceptance testing

## Performance Considerations

### Optimization Strategies
1. **Query Deduplication**: Reduce redundant network requests by 60-80%
2. **Stale-While-Revalidate**: Improve perceived performance by 200-300ms
3. **Protocol Caching**: Reduce protocol negotiation overhead
4. **Request Batching**: Combine multiple queries where possible
5. **Lazy Cache Cleanup**: Defer non-critical cache maintenance

### Memory Management
- Cache size limit: 50MB
- Automatic cleanup of entries older than 7 days
- LRU eviction when cache is full
- Compression for large cached objects

### Network Efficiency
- Connection pooling for HTTP/1.1
- Request coalescing for similar queries
- Adaptive timeout based on network quality
- Progressive retry delays to avoid thundering herd

## Security Considerations

### Data Protection
- Encrypt sensitive cached data
- Clear cache on logout
- Validate cache integrity
- Sanitize error messages (no sensitive data in logs)

### Authentication
- Never cache passwords or tokens
- Validate session before using cached role
- Implement cache versioning to invalidate on schema changes
- Rate limit retry attempts to prevent abuse

## Monitoring & Alerting

### Key Metrics
- Protocol error rate (alert if >5% for 5 minutes)
- Cache hit rate (alert if <70%)
- Average query duration (alert if >2s)
- Redirect loop occurrences (alert on any occurrence)
- Offline mode usage (track for capacity planning)

### Dashboards
- Real-time network quality
- Protocol distribution (HTTP/2 vs HTTP/1.1)
- Cache performance
- Error breakdown by category
- User impact metrics

## Rollback Plan

### Rollback Triggers
- Protocol error rate >10%
- Cache corruption affecting >1% of users
- Performance degradation >50%
- Critical bugs in production

### Rollback Procedure
1. Feature flag to disable new resilience layer
2. Fall back to previous Supabase client
3. Clear corrupted caches
4. Monitor for stability
5. Investigate root cause
6. Fix and redeploy

## Success Criteria

### Functional
- Zero redirect loops in production
- 99.9% successful role detection
- <1s average query response time
- Graceful handling of all error types

### Performance
- 80%+ cache hit rate
- 95%+ query deduplication effectiveness
- <100ms protocol switch overhead
- <10MB average cache size per user

### User Experience
- Clear offline mode indicators
- Informative error messages
- Smooth transitions between online/offline
- No data loss during network issues
