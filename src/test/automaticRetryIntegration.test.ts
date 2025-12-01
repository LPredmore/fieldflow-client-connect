/**
 * Automatic Retry Integration Tests
 * 
 * Tests the automatic retry manager, progressive error recovery integration,
 * and circuit breaker coordination.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { automaticRetryManager, executeWithRetry } from '../utils/automaticRetryManager';
import { progressiveErrorRecovery } from '../utils/progressiveErrorRecovery';
import { queryRetryIntegration, executeEnhancedQuery } from '../utils/queryRetryIntegration';
import { supabaseCircuitBreaker, ErrorType } from '../utils/circuitBreaker';
import { enhancedQueryCache } from '../utils/enhancedQueryCache';

// Mock timers for testing delays
vi.useFakeTimers();

describe('Automatic Retry Integration', () => {
  beforeEach(() => {
    // Reset all managers before each test
    supabaseCircuitBreaker.reset();
    enhancedQueryCache.clear();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('AutomaticRetryManager', () => {
    it('should retry network errors with exponential backoff', async () => {
      let attemptCount = 0;
      const mockOperation = vi.fn(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network connection failed');
        }
        return 'success';
      });

      const resultPromise = executeWithRetry(mockOperation, 'fast');
      
      // Fast forward through retry delays
      await vi.advanceTimersByTimeAsync(10000);
      
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.totalAttempts).toBe(3);
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const mockOperation = vi.fn(async () => {
        throw new Error('column "invalid_column" does not exist');
      });

      const result = await executeWithRetry(mockOperation, 'standard');

      expect(result.success).toBe(false);
      expect(result.totalAttempts).toBe(1);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should respect circuit breaker state during retries', async () => {
      let attemptCount = 0;
      const mockOperation = vi.fn(async () => {
        attemptCount++;
        
        // Open circuit breaker after first attempt
        if (attemptCount === 1) {
          // Simulate multiple failures to open circuit breaker
          for (let i = 0; i < 6; i++) {
            try {
              await supabaseCircuitBreaker.execute(async () => {
                throw new Error('Network error');
              });
            } catch (e) {
              // Expected to fail
            }
          }
        }
        
        throw new Error('Network connection failed');
      });

      const result = await executeWithRetry(mockOperation, 'standard');

      expect(result.success).toBe(false);
      expect(result.totalAttempts).toBe(1); // Should stop after circuit breaker opens
      expect(supabaseCircuitBreaker.getState().isOpen).toBe(true);
    });

    it('should calculate exponential backoff delays correctly', async () => {
      const delays: number[] = [];
      let attemptCount = 0;
      
      const mockOperation = vi.fn(async () => {
        attemptCount++;
        const startTime = Date.now();
        
        if (attemptCount > 1) {
          delays.push(startTime);
        }
        
        if (attemptCount < 4) {
          throw new Error('Timeout error');
        }
        return 'success';
      });

      const resultPromise = executeWithRetry(mockOperation, 'standard');
      
      // Advance timers to allow retries
      await vi.advanceTimersByTimeAsync(30000);
      
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.totalAttempts).toBe(4);
      
      // Verify exponential backoff pattern (approximately)
      expect(result.attempts).toHaveLength(4);
      expect(result.attempts[1].delay).toBeGreaterThan(1000); // ~2s + jitter
      expect(result.attempts[2].delay).toBeGreaterThan(2000); // ~4s + jitter
    });
  });

  describe('Progressive Error Recovery Integration', () => {
    it('should attempt progressive recovery after retry failures', async () => {
      // Setup cache with stale data
      const cacheKey = 'test-table-key';
      const staleData = [{ id: 1, name: 'cached item' }];
      
      enhancedQueryCache.set(cacheKey, staleData, {
        staleTime: 30000,
        maxAge: 600000,
        priority: 2,
        backgroundRefresh: false
      }, {
        table: 'test_table',
        select: '*',
        filters: {},
        userId: 'user123'
      });

      const mockOperation = vi.fn(async () => {
        throw new Error('Network connection failed');
      });

      const context = {
        table: 'test_table',
        cacheKey,
        userId: 'user123',
        isAuthRequired: false,
        priority: 'medium' as const,
        originalQuery: mockOperation
      };

      const result = await executeEnhancedQuery(mockOperation, context, {
        retryScenario: 'fast',
        useProgressiveRecovery: true
      });

      expect(result.success).toBe(true); // Should succeed via recovery
      expect(result.data).toEqual(staleData);
      expect(result.fromCache).toBe(true);
      expect(result.recoveryResult).toBeDefined();
      expect(result.retryResult?.success).toBe(false); // Original query failed
    });

    it('should handle complete failure when no recovery options available', async () => {
      const mockOperation = vi.fn(async () => {
        throw new Error('Schema mismatch error');
      });

      const context = {
        table: 'test_table',
        cacheKey: 'no-cache-key',
        userId: 'user123',
        isAuthRequired: false,
        priority: 'medium' as const,
        originalQuery: mockOperation
      };

      const result = await executeEnhancedQuery(mockOperation, context, {
        retryScenario: 'fast',
        useProgressiveRecovery: true
      });

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.recoveryResult).toBeDefined();
      expect(result.recoveryResult?.success).toBe(false);
    });
  });

  describe('Query Retry Integration', () => {
    it('should cache successful results after retry', async () => {
      let attemptCount = 0;
      const successData = [{ id: 1, name: 'success item' }];
      
      const mockOperation = vi.fn(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary network error');
        }
        return successData;
      });

      const context = {
        table: 'test_table',
        cacheKey: 'success-cache-key',
        userId: 'user123',
        isAuthRequired: false,
        priority: 'medium' as const,
        originalQuery: mockOperation
      };

      const resultPromise = executeEnhancedQuery(mockOperation, context, {
        retryScenario: 'fast',
        cacheResults: true
      });

      await vi.advanceTimersByTimeAsync(5000);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toEqual(successData);
      
      // Verify data was cached
      const cacheEntry = enhancedQueryCache.get('success-cache-key');
      expect(cacheEntry.hit).toBe(true);
      if (cacheEntry.hit && cacheEntry.data) {
        expect(cacheEntry.data).toEqual(successData);
      }
    });

    it('should respect maximum retry time limit', async () => {
      const mockOperation = vi.fn(async () => {
        // Simulate slow operation
        await new Promise(resolve => setTimeout(resolve, 10000));
        throw new Error('Timeout error');
      });

      const context = {
        table: 'test_table',
        cacheKey: 'timeout-key',
        userId: 'user123',
        isAuthRequired: false,
        priority: 'medium' as const,
        originalQuery: mockOperation
      };

      const startTime = Date.now();
      const resultPromise = executeEnhancedQuery(mockOperation, context, {
        retryScenario: 'patient',
        maxRetryTime: 5000 // 5 second limit
      });

      await vi.advanceTimersByTimeAsync(6000);
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
      expect(result.totalDuration).toBeLessThan(6000);
    });

    it('should provide comprehensive query metrics', async () => {
      const mockOperation = vi.fn(async () => {
        throw new Error('Network error');
      });

      const context = {
        table: 'test_table',
        cacheKey: 'metrics-key',
        userId: 'user123',
        isAuthRequired: false,
        priority: 'medium' as const,
        originalQuery: mockOperation
      };

      const resultPromise = executeEnhancedQuery(mockOperation, context, {
        retryScenario: 'standard',
        operationId: 'test-operation'
      });

      await vi.advanceTimersByTimeAsync(10000);
      await resultPromise;

      const metrics = queryRetryIntegration.getQueryMetrics('test-operation');
      
      expect(metrics.retryStats).toBeDefined();
      expect(metrics.recoveryStats).toBeDefined();
      expect(metrics.circuitBreakerState).toBeDefined();
      expect(typeof metrics.activeQueries).toBe('number');
    });
  });

  describe('Error Classification and Handling', () => {
    it('should correctly classify different error types', async () => {
      const testCases = [
        {
          error: new Error('Network connection failed'),
          expectedRetryable: true,
          expectedAttempts: 3
        },
        {
          error: new Error('column "invalid" does not exist'),
          expectedRetryable: false,
          expectedAttempts: 1
        },
        {
          error: new Error('permission denied'),
          expectedRetryable: false,
          expectedAttempts: 1
        },
        {
          error: new Error('timeout occurred'),
          expectedRetryable: true,
          expectedAttempts: 3
        }
      ];

      for (const testCase of testCases) {
        const mockOperation = vi.fn(async () => {
          throw testCase.error;
        });

        const result = await executeWithRetry(mockOperation, 'standard');

        expect(result.success).toBe(false);
        expect(result.totalAttempts).toBe(testCase.expectedAttempts);
        expect(mockOperation).toHaveBeenCalledTimes(testCase.expectedAttempts);
      }
    });
  });

  describe('Performance and Resource Management', () => {
    it('should prevent duplicate retries for same operation', async () => {
      let globalAttemptCount = 0;
      const mockOperation = vi.fn(async () => {
        globalAttemptCount++;
        await new Promise(resolve => setTimeout(resolve, 1000));
        throw new Error('Network error');
      });

      // Start two identical operations simultaneously
      const promise1 = executeWithRetry(mockOperation, 'standard', 'duplicate-op');
      const promise2 = executeWithRetry(mockOperation, 'standard', 'duplicate-op');

      await vi.advanceTimersByTimeAsync(10000);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should get the same result, but operation should only run once
      expect(result1.success).toBe(result2.success);
      expect(globalAttemptCount).toBeLessThan(6); // Should not double the attempts
    });

    it('should clean up resources after query completion', async () => {
      const mockOperation = vi.fn(async () => ['success']);

      const context = {
        table: 'test_table',
        cacheKey: 'cleanup-key',
        userId: 'user123',
        isAuthRequired: false,
        priority: 'medium' as const,
        originalQuery: mockOperation as () => Promise<unknown[]>
      };

      await executeEnhancedQuery(mockOperation as () => Promise<unknown[]>, context, {
        operationId: 'cleanup-test'
      });

      const metrics = queryRetryIntegration.getQueryMetrics();
      expect(metrics.activeQueries).toBe(0);
    });
  });
});

describe('Integration with Existing Systems', () => {
  it('should work with circuit breaker state changes', async () => {
    // Start with closed circuit breaker
    expect(supabaseCircuitBreaker.getState().isOpen).toBe(false);

    let attemptCount = 0;
    const mockOperation = vi.fn(async () => {
      attemptCount++;
      
      // First few attempts fail to open circuit breaker
      if (attemptCount <= 3) {
        throw new Error('Network error');
      }
      
      return 'success';
    });

    const resultPromise = executeWithRetry(mockOperation, 'patient');
    await vi.advanceTimersByTimeAsync(20000);
    const result = await resultPromise;

    // Should eventually succeed even with circuit breaker involvement
    expect(result.success).toBe(true);
    expect(result.totalAttempts).toBeGreaterThan(1);
  });

  it('should integrate with cache system for recovery', async () => {
    // Pre-populate cache
    const cacheKey = 'integration-cache-key';
    const cachedData = [{ id: 1, name: 'cached data' }];
    
    enhancedQueryCache.set(cacheKey, cachedData, {
      staleTime: 30000,
      maxAge: 600000,
      priority: 2,
      backgroundRefresh: false
    }, {
      table: 'integration_table',
      select: '*',
      filters: {},
      userId: 'user123'
    });

    const mockOperation = vi.fn(async () => {
      throw new Error('Service unavailable');
    });

    const context = {
      table: 'integration_table',
      cacheKey,
      userId: 'user123',
      isAuthRequired: false,
      priority: 'high' as const,
      originalQuery: mockOperation
    };

    const result = await executeEnhancedQuery(mockOperation, context);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(cachedData);
    expect(result.fromCache).toBe(true);
  });
});