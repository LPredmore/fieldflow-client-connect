/**
 * Query Prioritization and Throttling System Tests
 * 
 * Comprehensive tests for the integrated query performance optimization system.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  QueryPriority,
  QueryPriorityQueue,
  QueryPriorityManager,
  PriorityQueryExecutor
} from '../utils/queryPrioritySystem';

import { 
  QueryThrottlingManager,
  ThrottleConfig 
} from '../utils/queryThrottlingSystem';

import { 
  QueryBatchingManager,
  BatchConfig 
} from '../utils/queryBatchingSystem';

import { 
  QueryPerformanceManager,
  executeOptimizedQuery 
} from '../utils/queryPrioritizationAndThrottling';

describe('Query Priority System', () => {
  let priorityQueue: QueryPriorityQueue;
  let priorityManager: QueryPriorityManager;

  beforeEach(() => {
    priorityQueue = new QueryPriorityQueue();
    priorityManager = QueryPriorityManager.getInstance();
  });

  describe('QueryPriorityQueue', () => {
    it('should enqueue queries in priority order', () => {
      const highPriorityQuery = {
        id: 'high',
        table: 'settings',
        query: vi.fn(),
        priority: QueryPriority.HIGH,
        timestamp: Date.now(),
        authRequired: false,
        resolve: vi.fn(),
        reject: vi.fn()
      };

      const criticalQuery = {
        id: 'critical',
        table: 'auth',
        query: vi.fn(),
        priority: QueryPriority.CRITICAL,
        timestamp: Date.now(),
        authRequired: true,
        resolve: vi.fn(),
        reject: vi.fn()
      };

      const lowQuery = {
        id: 'low',
        table: 'logs',
        query: vi.fn(),
        priority: QueryPriority.LOW,
        timestamp: Date.now(),
        authRequired: false,
        resolve: vi.fn(),
        reject: vi.fn()
      };

      priorityQueue.enqueue(highPriorityQuery);
      priorityQueue.enqueue(criticalQuery);
      priorityQueue.enqueue(lowQuery);

      expect(priorityQueue.size()).toBe(3);

      // Should dequeue in priority order (CRITICAL first)
      const first = priorityQueue.dequeue();
      expect(first?.id).toBe('critical');
      expect(first?.priority).toBe(QueryPriority.CRITICAL);

      const second = priorityQueue.dequeue();
      expect(second?.id).toBe('high');
      expect(second?.priority).toBe(QueryPriority.HIGH);

      const third = priorityQueue.dequeue();
      expect(third?.id).toBe('low');
      expect(third?.priority).toBe(QueryPriority.LOW);
    });

    it('should provide queue status information', () => {
      const query1 = {
        id: 'q1',
        table: 'clinicians',
        query: vi.fn(),
        priority: QueryPriority.MEDIUM,
        timestamp: Date.now() - 1000,
        authRequired: false,
        resolve: vi.fn(),
        reject: vi.fn()
      };

      const query2 = {
        id: 'q2',
        table: 'settings',
        query: vi.fn(),
        priority: QueryPriority.CRITICAL,
        timestamp: Date.now(),
        authRequired: true,
        resolve: vi.fn(),
        reject: vi.fn()
      };

      priorityQueue.enqueue(query1);
      priorityQueue.enqueue(query2);

      const status = priorityQueue.getQueueStatus();
      expect(status.total).toBe(2);
      expect(status.byPriority[QueryPriority.CRITICAL]).toBe(1);
      expect(status.byPriority[QueryPriority.MEDIUM]).toBe(1);
      expect(status.oldestQuery).toBeDefined();
      expect(status.oldestQuery?.age).toBeGreaterThan(0);
    });
  });

  describe('QueryPriorityManager', () => {
    it('should calculate correct priorities for different tables', () => {
      const authPriority = priorityManager.calculatePriority('auth');
      expect(authPriority).toBe(QueryPriority.CRITICAL);

      const settingsPriority = priorityManager.calculatePriority('settings');
      expect(settingsPriority).toBe(QueryPriority.CRITICAL);

      const cliniciansPriority = priorityManager.calculatePriority('clinicians');
      expect(cliniciansPriority).toBe(QueryPriority.MEDIUM);

      const logsPriority = priorityManager.calculatePriority('logs');
      expect(logsPriority).toBe(QueryPriority.LOW);
    });

    it('should apply context modifiers correctly', () => {
      const userContext = {
        userId: 'user1',
        role: 'admin',
        permissions: ['read', 'write']
      };

      // Admin role should increase priority for profiles
      const profilePriority = priorityManager.calculatePriority('profiles', userContext, true);
      expect(profilePriority).toBe(QueryPriority.HIGH); // Base HIGH + auth modifier (-1) + admin modifier (-1) = HIGH

      // Unknown table should default to MEDIUM
      const unknownPriority = priorityManager.calculatePriority('unknown_table');
      expect(unknownPriority).toBe(QueryPriority.MEDIUM);
    });
  });
});

describe('Query Throttling System', () => {
  let throttlingManager: QueryThrottlingManager;

  beforeEach(() => {
    const config: Partial<ThrottleConfig> = {
      maxRequestsPerSecond: 5,
      burstLimit: 10,
      windowSizeMs: 1000,
      throttleNonCritical: true,
      adaptiveThrottling: false // Disable for predictable testing
    };
    throttlingManager = QueryThrottlingManager.getInstance(config);
    throttlingManager.reset();
  });

  afterEach(() => {
    throttlingManager.reset();
  });

  it('should never throttle CRITICAL priority requests', () => {
    // Make many critical requests
    for (let i = 0; i < 20; i++) {
      const result = throttlingManager.shouldThrottle(
        `critical-${i}`,
        QueryPriority.CRITICAL,
        'auth'
      );
      expect(result.throttled).toBe(false);
    }
  });

  it('should throttle requests when rate limit is exceeded', () => {
    // Make requests up to the limit
    for (let i = 0; i < 10; i++) {
      const result = throttlingManager.shouldThrottle(
        `request-${i}`,
        QueryPriority.MEDIUM,
        'clinicians'
      );
      expect(result.throttled).toBe(false);
    }

    // Next request should be throttled
    const throttledResult = throttlingManager.shouldThrottle(
      'request-overflow',
      QueryPriority.MEDIUM,
      'clinicians'
    );
    expect(throttledResult.throttled).toBe(true);
    expect(throttledResult.reason).toContain('Rate limit exceeded');
  });

  it('should provide accurate throttling metrics', () => {
    // Make some requests to fill up the rate limit
    for (let i = 0; i < 10; i++) {
      throttlingManager.shouldThrottle(`request-${i}`, QueryPriority.MEDIUM, 'clinicians');
    }

    // Make one that should get throttled due to rate limit
    throttlingManager.shouldThrottle('throttled', QueryPriority.LOW, 'logs');

    const metrics = throttlingManager.getMetrics();
    expect(metrics.totalRequests).toBe(11);
    expect(metrics.throttledRequests).toBeGreaterThan(0);
    expect(metrics.throttleRatio).toBeGreaterThan(0);
  });

  it('should update system load for adaptive throttling', () => {
    throttlingManager.updateSystemLoad(5, 10, 1500);
    
    const status = throttlingManager.getStatus();
    expect(status.systemLoad).toBeDefined();
    expect(status.systemLoad.currentLoad).toBeGreaterThan(0);
  });
});

describe('Query Batching System', () => {
  let batchingManager: QueryBatchingManager;

  beforeEach(() => {
    const config: Partial<BatchConfig> = {
      maxBatchSize: 5,
      maxWaitTimeMs: 50,
      minBatchSize: 2,
      enableAdaptiveBatching: false
    };
    batchingManager = QueryBatchingManager.getInstance(config);
    batchingManager.reset();
  });

  afterEach(() => {
    batchingManager.reset();
  });

  it('should batch similar queries together', async () => {
    const mockQuery = vi.fn().mockResolvedValue([{ id: 1, name: 'test' }]);
    
    // Execute multiple similar queries
    const promises = [
      batchingManager.executeQuery('q1', 'clinicians', 'select', mockQuery),
      batchingManager.executeQuery('q2', 'clinicians', 'select', mockQuery),
      batchingManager.executeQuery('q3', 'clinicians', 'select', mockQuery)
    ];

    await Promise.all(promises);

    const metrics = batchingManager.getMetrics();
    expect(metrics.batchedQueries).toBeGreaterThan(0);
    expect(metrics.totalBatches).toBeGreaterThan(0);
    expect(metrics.batchingEfficiency).toBeGreaterThan(0);
  });

  it('should execute individual queries when batch size is too small', async () => {
    const mockQuery = vi.fn().mockResolvedValue([{ id: 1 }]);
    
    // Execute single query (below minBatchSize)
    const result = await batchingManager.executeQuery('single', 'clinicians', 'select', mockQuery);
    
    expect(result).toBeDefined();
    
    const metrics = batchingManager.getMetrics();
    expect(metrics.totalQueries).toBe(1);
  });

  it('should provide batching status and recommendations', () => {
    const status = batchingManager.getStatus();
    expect(status.config).toBeDefined();
    expect(status.metrics).toBeDefined();
    expect(status.activeBatches).toBeDefined();
    expect(status.pendingQueries).toBeDefined();

    const recommendations = batchingManager.getRecommendations();
    expect(Array.isArray(recommendations)).toBe(true);
  });
});

describe('Integrated Query Performance Manager', () => {
  let performanceManager: QueryPerformanceManager;

  beforeEach(() => {
    performanceManager = QueryPerformanceManager.getInstance();
    performanceManager.reset();
  });

  afterEach(() => {
    performanceManager.reset();
  });

  it('should execute queries with integrated optimization', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ data: 'test' });
    
    const result = await performanceManager.executeQuery('test-query', mockQuery, {
      table: 'clinicians',
      operation: 'select',
      userContext: {
        userId: 'user1',
        role: 'admin',
        permissions: ['read']
      },
      authRequired: true
    });

    expect(result.data).toEqual({ data: 'test' });
    expect(result.metadata).toBeDefined();
    expect(result.metadata.executionTime).toBeGreaterThan(0);
    expect(result.metadata.priority).toBeDefined();
    expect(typeof result.metadata.wasBatched).toBe('boolean');
    expect(typeof result.metadata.wasThrottled).toBe('boolean');
  });

  it('should execute multiple queries with proper prioritization', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ data: 'test' });
    
    const queries = [
      {
        id: 'low-priority',
        queryFn: mockQuery,
        options: {
          table: 'logs',
          priority: QueryPriority.LOW,
          operation: 'select' as const
        }
      },
      {
        id: 'critical-priority',
        queryFn: mockQuery,
        options: {
          table: 'auth',
          priority: QueryPriority.CRITICAL,
          operation: 'select' as const
        }
      },
      {
        id: 'medium-priority',
        queryFn: mockQuery,
        options: {
          table: 'clinicians',
          priority: QueryPriority.MEDIUM,
          operation: 'select' as const
        }
      }
    ];

    const results = await performanceManager.executeQueries(queries);
    
    expect(results).toHaveLength(3);
    
    // Results should be in priority order (critical first)
    expect(results[0].metadata.priority).toBe(QueryPriority.CRITICAL);
    expect(results[1].metadata.priority).toBe(QueryPriority.MEDIUM);
    expect(results[2].metadata.priority).toBe(QueryPriority.LOW);
  });

  it('should provide comprehensive performance metrics', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ data: 'test' });
    
    // Execute some queries to generate metrics
    await performanceManager.executeQuery('test1', mockQuery, {
      table: 'clinicians',
      operation: 'select'
    });
    
    await performanceManager.executeQuery('test2', mockQuery, {
      table: 'settings',
      operation: 'select'
    });

    const metrics = performanceManager.getPerformanceMetrics();
    
    expect(metrics.prioritySystem).toBeDefined();
    expect(metrics.throttlingSystem).toBeDefined();
    expect(metrics.batchingSystem).toBeDefined();
    expect(metrics.overall).toBeDefined();
    expect(metrics.overall.totalQueries).toBeGreaterThan(0);
    expect(metrics.overall.averageExecutionTime).toBeGreaterThan(0);
    expect(Array.isArray(metrics.overall.recommendations)).toBe(true);
  });

  it('should handle system configuration updates', () => {
    performanceManager.configureSystem({
      throttling: {
        maxRequestsPerSecond: 20,
        burstLimit: 40
      },
      batching: {
        maxBatchSize: 10,
        maxWaitTimeMs: 200
      },
      maxConcurrentQueries: 5
    });

    // Configuration should be applied (no errors thrown)
    expect(true).toBe(true);
  });

  it('should cancel queries matching criteria', () => {
    // This test would need more complex setup to have pending queries
    const cancelledCount = performanceManager.cancelQueries(
      (query) => query.table === 'logs'
    );
    
    expect(typeof cancelledCount).toBe('number');
    expect(cancelledCount).toBeGreaterThanOrEqual(0);
  });
});

describe('Convenience Functions', () => {
  beforeEach(() => {
    QueryPerformanceManager.getInstance().reset();
  });

  it('should execute optimized query with convenience function', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ id: 1, name: 'test' });
    
    const result = await executeOptimizedQuery('convenience-test', 'clinicians', mockQuery, {
      operation: 'select',
      enableBatching: true,
      enableThrottling: true
    });

    expect(result).toEqual({ id: 1, name: 'test' });
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('Error Handling', () => {
  let performanceManager: QueryPerformanceManager;

  beforeEach(() => {
    performanceManager = QueryPerformanceManager.getInstance();
    performanceManager.reset();
  });

  it('should handle query execution errors gracefully', async () => {
    const mockQuery = vi.fn().mockRejectedValue(new Error('Database error'));
    
    await expect(
      performanceManager.executeQuery('error-test', mockQuery, {
        table: 'clinicians',
        operation: 'select'
      })
    ).rejects.toThrow('Database error');
  });

  it('should handle throttling errors appropriately', async () => {
    const performanceManager = QueryPerformanceManager.getInstance();
    
    // Configure very restrictive throttling
    performanceManager.configureSystem({
      throttling: {
        maxRequestsPerSecond: 1,
        burstLimit: 1
      }
    });

    const mockQuery = vi.fn().mockResolvedValue({ data: 'test' });
    
    // First query should succeed
    await performanceManager.executeQuery('first', mockQuery, {
      table: 'clinicians',
      operation: 'select',
      priority: QueryPriority.MEDIUM
    });

    // Second query might be throttled but should eventually succeed due to retry logic
    const result = await performanceManager.executeQuery('second', mockQuery, {
      table: 'clinicians',
      operation: 'select',
      priority: QueryPriority.MEDIUM
    });

    expect(result.data).toEqual({ data: 'test' });
  });
});

describe('Performance Optimization', () => {
  it('should demonstrate performance improvements with batching', async () => {
    const batchingManager = QueryBatchingManager.getInstance({
      maxBatchSize: 3,
      maxWaitTimeMs: 10,
      minBatchSize: 2
    });
    
    const mockQuery = vi.fn().mockResolvedValue([{ id: 1 }]);
    
    const startTime = Date.now();
    
    // Execute multiple similar queries
    const promises = Array.from({ length: 6 }, (_, i) =>
      batchingManager.executeQuery(`batch-test-${i}`, 'clinicians', 'select', mockQuery)
    );
    
    await Promise.all(promises);
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    const metrics = batchingManager.getMetrics();
    
    // Batching should improve efficiency
    expect(metrics.batchingEfficiency).toBeGreaterThan(0);
    expect(metrics.connectionsSaved).toBeGreaterThan(0);
    
    // Should complete reasonably quickly
    expect(executionTime).toBeLessThan(1000);
    
    batchingManager.reset();
  });
});