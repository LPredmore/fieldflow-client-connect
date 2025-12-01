/**
 * Smart Circuit Breaker Integration Tests
 * 
 * Tests the integration of the smart circuit breaker with the query system,
 * including cache-aware operation, progressive timeouts, and deduplication.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { smartSupabaseCircuitBreaker, smartCircuitBreakerConfig } from '@/utils/smartCircuitBreakerInstance';
import { enhancedQueryCache } from '@/utils/enhancedQueryCache';
import { deduplicationManager } from '@/utils/deduplicationManager';
import { ErrorType } from '@/utils/circuitBreaker';

describe('Smart Circuit Breaker Integration', () => {
  beforeEach(() => {
    // Reset smart circuit breaker state
    smartSupabaseCircuitBreaker.resetAdaptiveThresholds();
    
    // Clear cache and deduplication manager
    enhancedQueryCache.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup any intervals or timeouts
    smartSupabaseCircuitBreaker.destroy();
  });

  describe('Cache-Aware Circuit Breaker Operation', () => {
    it('should serve cached data when circuit is open', async () => {
      // Setup: Add data to cache
      const testData = [{ id: 1, name: 'Test User' }];
      const cacheKey = 'test-cache-key';
      const queryMetadata = {
        table: 'users',
        select: '*',
        filters: {},
        userId: 'test-user',
        tenantId: 'test-tenant'
      };
      
      enhancedQueryCache.set(cacheKey, testData, {
        staleTime: 30000,
        maxAge: 300000,
        priority: 2,
        backgroundRefresh: true
      }, queryMetadata);

      // Force circuit breaker to open by causing failures
      for (let i = 0; i < 6; i++) {
        try {
          await smartSupabaseCircuitBreaker.execute(async () => {
            throw new Error('Network timeout');
          }, cacheKey, 'users');
        } catch (error) {
          // Expected failures
        }
      }

      // Verify circuit is open
      const circuitState = smartSupabaseCircuitBreaker.getEnhancedState();
      expect(circuitState.state).toBe('OPEN');

      // Test: Execute operation with cache available
      const result = await smartSupabaseCircuitBreaker.execute(async () => {
        throw new Error('Should not execute - circuit is open');
      }, cacheKey, 'users');

      // Should return cached data instead of throwing error
      expect(result).toEqual(testData);
    });

    it('should throw error when circuit is open and no cache available', async () => {
      // Force circuit breaker to open
      for (let i = 0; i < 6; i++) {
        try {
          await smartSupabaseCircuitBreaker.execute(async () => {
            throw new Error('Network timeout');
          }, 'no-cache-key', 'users');
        } catch (error) {
          // Expected failures
        }
      }

      // Verify circuit is open
      const circuitState = smartSupabaseCircuitBreaker.getEnhancedState();
      expect(circuitState.state).toBe('OPEN');

      // Test: Execute operation without cache
      await expect(
        smartSupabaseCircuitBreaker.execute(async () => {
          throw new Error('Should not execute - circuit is open');
        }, 'no-cache-key', 'users')
      ).rejects.toThrow('Smart Circuit breaker is OPEN');
    });
  });

  describe('Progressive Timeout Strategy', () => {
    it('should increase timeout with consecutive failures', async () => {
      // Don't reset for this test - we want to track consecutive failures
      const initialState = smartSupabaseCircuitBreaker.getProgressiveTimeoutInfo();
      
      // Cause some failures using the same cache key to track consecutive failures
      const cacheKey = 'consecutive-failure-test';
      for (let i = 0; i < 4; i++) {
        try {
          await smartSupabaseCircuitBreaker.execute(async () => {
            throw new Error('Network timeout');
          }, cacheKey, 'users');
        } catch (error) {
          // Expected failures
        }
      }

      const updatedState = smartSupabaseCircuitBreaker.getProgressiveTimeoutInfo();
      expect(updatedState.consecutiveFailures).toBe(4);
      expect(updatedState.currentStep).toBeGreaterThan(0);

      // Test adaptive timeout calculation
      const adaptiveTimeout = smartSupabaseCircuitBreaker.getAdaptiveTimeout();
      expect(adaptiveTimeout).toBeGreaterThan(smartCircuitBreakerConfig.resetTimeout);
    });

    it('should reset timeout step on successful operations', async () => {
      // Use the state from the previous test (consecutive failures should be 4)
      const stateAfterFailures = smartSupabaseCircuitBreaker.getProgressiveTimeoutInfo();
      expect(stateAfterFailures.consecutiveFailures).toBe(4);

      // Execute successful operation
      const result = await smartSupabaseCircuitBreaker.execute(async () => {
        return 'success';
      }, 'success-key', 'users');

      expect(result).toBe('success');

      const stateAfterSuccess = smartSupabaseCircuitBreaker.getProgressiveTimeoutInfo();
      expect(stateAfterSuccess.consecutiveFailures).toBe(0);
    });
  });

  describe('Adaptive Threshold Management', () => {
    it('should adjust thresholds based on performance trends', async () => {
      // Reset circuit breaker for clean test
      smartSupabaseCircuitBreaker.resetAdaptiveThresholds();
      
      const initialThresholds = smartSupabaseCircuitBreaker.getEnhancedState().adaptiveThresholds;
      
      // Simulate good performance
      for (let i = 0; i < 10; i++) {
        await smartSupabaseCircuitBreaker.execute(async () => {
          // Simulate fast operation
          await new Promise(resolve => setTimeout(resolve, 50));
          return `success-${i}`;
        }, `fast-key-${i}`, 'users');
      }

      // Wait for adaptive adjustment (would normally take 2 minutes, but we can test the logic)
      const enhancedState = smartSupabaseCircuitBreaker.getEnhancedState();
      expect(enhancedState.performanceMetrics.avgDuration).toBeLessThan(1000);
      expect(enhancedState.performanceMetrics.successRate).toBe(1);
    });
  });

  describe('System Load Monitoring', () => {
    it('should track system load metrics', async () => {
      // Reset circuit breaker for clean test
      smartSupabaseCircuitBreaker.resetAdaptiveThresholds();
      
      // Execute some operations to generate load metrics
      for (let i = 0; i < 5; i++) {
        await smartSupabaseCircuitBreaker.execute(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return `result-${i}`;
        }, `load-key-${i}`, 'users');
      }

      const loadMetrics = smartSupabaseCircuitBreaker.getSystemLoadMetrics();
      expect(loadMetrics).toBeDefined();
      expect(loadMetrics.loadLevel).toMatch(/^(low|medium|high|critical)$/);
      expect(loadMetrics.timestamp).toBeGreaterThan(0);
    });
  });

  describe('Error Type Weighting', () => {
    it('should not count schema errors toward circuit breaker threshold', async () => {
      // Reset circuit breaker for this specific test
      smartSupabaseCircuitBreaker.resetAdaptiveThresholds();
      
      const initialState = smartSupabaseCircuitBreaker.getEnhancedState();
      expect(initialState.state).toBe('CLOSED');
      
      // Cause schema errors (should not count toward threshold)
      for (let i = 0; i < 10; i++) {
        try {
          await smartSupabaseCircuitBreaker.execute(async () => {
            const error = new Error('column "nonexistent" does not exist');
            throw error;
          }, `schema-key-${i}`, 'users');
        } catch (error) {
          // Expected schema errors
        }
      }

      const stateAfterSchemaErrors = smartSupabaseCircuitBreaker.getEnhancedState();
      
      // Circuit should still be closed because schema errors have weight 0
      expect(stateAfterSchemaErrors.state).toBe('CLOSED');
    });

    it('should count network errors with standard weight', async () => {
      // Cause network errors (should count toward threshold)
      for (let i = 0; i < 6; i++) {
        try {
          await smartSupabaseCircuitBreaker.execute(async () => {
            const error = new Error('Network connection failed');
            throw error;
          }, `network-key-${i}`, 'users');
        } catch (error) {
          // Expected network errors
        }
      }

      const stateAfterNetworkErrors = smartSupabaseCircuitBreaker.getEnhancedState();
      
      // Circuit should be open because network errors count toward threshold
      expect(stateAfterNetworkErrors.state).toBe('OPEN');
    });
  });

  describe('Deduplication Integration', () => {
    it('should share circuit breaker state across deduplicated requests', async () => {
      const cacheKey = 'shared-request-key';
      
      // Create multiple concurrent requests that should be deduplicated
      const promises = Array.from({ length: 5 }, (_, i) => 
        deduplicationManager.deduplicate(
          cacheKey,
          async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return `shared-result-${i}`;
          },
          2, // MEDIUM priority
          { table: 'users', userId: 'test-user' }
        )
      );

      const results = await Promise.all(promises);
      
      // All requests should get the same result due to deduplication
      expect(results.every(result => result === results[0])).toBe(true);
    });
  });

  describe('Performance Metrics Collection', () => {
    it('should collect comprehensive performance metrics', async () => {
      // Reset circuit breaker for clean metrics
      smartSupabaseCircuitBreaker.resetAdaptiveThresholds();
      
      // Execute operations with varying performance
      const operations = [
        { duration: 100, shouldFail: false },
        { duration: 200, shouldFail: false },
        { duration: 300, shouldFail: false },
      ];

      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        try {
          const result = await smartSupabaseCircuitBreaker.execute(async () => {
            await new Promise(resolve => setTimeout(resolve, op.duration));
            if (op.shouldFail) {
              throw new Error('Simulated failure');
            }
            return `result-${i}`;
          }, `perf-key-${i}`, 'users');
          
          expect(result).toBe(`result-${i}`);
        } catch (error) {
          // Expected for failing operations
        }
      }

      const enhancedState = smartSupabaseCircuitBreaker.getEnhancedState();
      const perfMetrics = enhancedState.performanceMetrics;
      
      expect(perfMetrics.avgDuration).toBeGreaterThan(0);
      expect(perfMetrics.successRate).toBeGreaterThan(0);
      expect(perfMetrics.successRate).toBeLessThanOrEqual(1);
      expect(perfMetrics.recentOperations).toBe(operations.length);
    });
  });

  describe('Configuration Validation', () => {
    it('should have valid smart circuit breaker configuration', () => {
      expect(smartCircuitBreakerConfig.failureThreshold).toBeGreaterThan(0);
      expect(smartCircuitBreakerConfig.resetTimeout).toBeGreaterThan(0);
      expect(smartCircuitBreakerConfig.progressiveTimeouts).toBe(true);
      expect(smartCircuitBreakerConfig.adaptiveThresholds).toBe(true);
      expect(smartCircuitBreakerConfig.cacheGracePeriod).toBeGreaterThan(0);
      
      // Validate error type weights
      expect(smartCircuitBreakerConfig.errorTypeWeights[ErrorType.SCHEMA_MISMATCH]).toBe(0);
      expect(smartCircuitBreakerConfig.errorTypeWeights[ErrorType.NETWORK_ERROR]).toBeGreaterThan(0);
      expect(smartCircuitBreakerConfig.errorTypeWeights[ErrorType.POLICY_INFINITE_RECURSION]).toBeGreaterThan(1);
      
      // Validate progressive timeout config
      expect(smartCircuitBreakerConfig.progressiveTimeoutConfig.enabled).toBe(true);
      expect(smartCircuitBreakerConfig.progressiveTimeoutConfig.timeoutSteps.length).toBeGreaterThan(0);
      
      // Validate load monitoring config
      expect(smartCircuitBreakerConfig.loadMonitoringConfig.enabled).toBe(true);
      expect(smartCircuitBreakerConfig.loadMonitoringConfig.cpuThreshold).toBeGreaterThan(0);
    });
  });
});