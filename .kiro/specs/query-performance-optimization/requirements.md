# Requirements Document

## Introduction

The application is experiencing severe performance degradation with database queries taking 2-60+ seconds to complete, causing poor user experience and frequent authentication redirections. The logs show specific patterns: slow queries on clinicians, customers, and settings tables with cache ages exceeding stale times, excessive circuit breaker activations, and authentication routing issues preventing proper data loading.

## Requirements

### Requirement 1: Optimize Query Caching Strategy

**User Story:** As a user, I want database queries to return quickly using intelligent caching, so that pages load in under 2 seconds consistently.

#### Acceptance Criteria

1. WHEN a query is executed THEN it SHALL complete within 2 seconds or use cached data
2. WHEN cached data exists and is less than 5 seconds old THEN it SHALL be returned immediately without network requests
3. WHEN cached data is stale but usable THEN it SHALL be shown while fresh data loads in the background
4. WHEN cache age exceeds 399 seconds (customers table) THEN the cache SHALL be invalidated and fresh data fetched
5. WHEN multiple components request the same data THEN requests SHALL be deduplicated to prevent redundant queries

### Requirement 2: Fix Authentication-Related Query Blocking

**User Story:** As a user, I want queries to execute properly regardless of authentication state transitions, so that I don't see "useSupabaseQuery Skipped" errors.

#### Acceptance Criteria

1. WHEN authentication state is loading THEN queries SHALL be properly queued rather than skipped
2. WHEN user authentication completes THEN pending queries SHALL execute automatically
3. WHEN AppRouter redirects for authentication THEN in-flight queries SHALL be cancelled gracefully
4. WHEN user permissions change THEN affected queries SHALL be re-executed with new permissions
5. WHEN routing between pages THEN queries SHALL not be blocked by authentication checks

### Requirement 3: Optimize Circuit Breaker Configuration for Performance

**User Story:** As a user, I want the circuit breaker to prevent cascading failures without blocking legitimate requests, so that temporary issues don't cause extended outages.

#### Acceptance Criteria

1. WHEN queries consistently take over 2 seconds THEN the circuit breaker SHALL implement progressive timeouts
2. WHEN the circuit breaker opens THEN it SHALL serve cached data if available rather than blocking completely
3. WHEN network conditions improve THEN the circuit breaker SHALL close within 15 seconds instead of 30 seconds
4. WHEN schema or permission errors occur THEN they SHALL not count toward circuit breaker failure threshold
5. WHEN query deduplication is active THEN circuit breaker state SHALL be shared across deduplicated requests

### Requirement 4: Implement Query Performance Monitoring and Alerting

**User Story:** As a developer, I want real-time visibility into query performance issues, so that I can identify and resolve bottlenecks quickly.

#### Acceptance Criteria

1. WHEN queries exceed 2 seconds THEN they SHALL be logged as slow queries with detailed context
2. WHEN cache hit rates drop below 70% THEN an alert SHALL be generated
3. WHEN circuit breaker activations exceed 5 per minute THEN performance degradation SHALL be flagged
4. WHEN authentication-related query skips exceed 10% THEN routing issues SHALL be identified
5. WHEN query deduplication saves more than 50% of requests THEN efficiency metrics SHALL be tracked

### Requirement 5: Optimize Specific Table Query Patterns

**User Story:** As a user, I want clinicians, customers, and settings data to load quickly, so that these core business entities are always responsive.

#### Acceptance Criteria

1. WHEN clinicians table is queried THEN results SHALL be cached for 30 seconds with background refresh
2. WHEN customers table is queried THEN results SHALL use progressive loading for large datasets
3. WHEN settings table is queried THEN results SHALL be cached for 5 minutes since they change infrequently
4. WHEN any of these tables have stale cache (>staleTime) THEN background refresh SHALL occur without blocking UI
5. WHEN these queries fail THEN fallback to cached data SHALL be automatic with user notification

### Requirement 6: Implement Request Prioritization and Throttling

**User Story:** As a user, I want critical queries to execute first during high load, so that essential functionality remains responsive.

#### Acceptance Criteria

1. WHEN multiple queries are pending THEN authentication and settings queries SHALL have highest priority
2. WHEN query rate exceeds 10 requests per second THEN non-critical queries SHALL be throttled
3. WHEN user navigates between pages THEN previous page queries SHALL be cancelled to free resources
4. WHEN component unmounts THEN associated queries SHALL be aborted to prevent memory leaks
5. WHEN system is under load THEN query batching SHALL be used to reduce database connections

### Requirement 7: Enhance Error Recovery and User Experience

**User Story:** As a user, I want clear feedback when queries are slow or failing, so that I understand what's happening and can take appropriate action.

#### Acceptance Criteria

1. WHEN queries take longer than 5 seconds THEN a loading indicator with progress SHALL be shown
2. WHEN queries fail due to network issues THEN automatic retry with exponential backoff SHALL occur
3. WHEN cached data is being shown due to errors THEN a subtle indicator SHALL inform the user
4. WHEN circuit breaker is active THEN users SHALL see a "service temporarily unavailable" message with retry option
5. WHEN authentication is required for queries THEN users SHALL be redirected smoothly without losing context