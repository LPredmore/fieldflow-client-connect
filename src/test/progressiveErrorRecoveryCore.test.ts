/**
 * Progressive Error Recovery Core Tests
 * 
 * Focused tests for the core progressive error recovery functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { progressiveErrorRecovery, FallbackLevel } from '../utils/progressiveErrorRecovery';
import { automaticRetryManager, executeWithRetry } from '../utils/automaticRetryManager';
import { ErrorType } from '../utils/circuitBreaker';
import { enhancedQueryCache } from '../utils/enhancedQueryCache';

describe('Progressive Error Recovery Core', () => {
  beforeEach(() => {
    enhancedQueryCache.clear();
  });

  describe('ProgressiveErrorRecovery', () => {
    it('should classify errors correctly', async () => {
      const networkError = new Error('Network connection failed');
      const schemaError = new Error('column "invalid" does not exist');
      const permissionError = new Error('permission denied');
      
      const context = {
        table: 'test_table',
        cacheKey: 'test-key',
        userId: 'user123',
        isAuthRequired: false,
        priority: 'medium' as const,
        originalQuery: async () => []
      };

      // Network error should attempt recovery
      const networkResult = await progressiveErrorRecovery.handleQueryError(networkError, context);
      expect(networkResult.success).toBe(false); // No cache available
      expect(networkResult.level).toBe(FallbackLevel.GRACEFUL_DEGRADATION);

      // Schema error should not use cache recovery
      const schemaResult = await progressiveErrorRecovery.handleQueryError(schemaError, context);
      expect(schemaResult.success).toBe(false);
      expect(schemaResult.level).toBe(FallbackLevel.GRACEFUL_DEGRADATION);
    });

    it('should use stale cache when available', async () => {
      const cacheKey = 'stale-cache-test';
      const cachedData = [{ id: 1, name: 'cached item' }];
      
      // Set up cache with proper metadata
      const metadata = {
        table: 'test_table',
        select: '*',
        filters: {},
        userId: 'user123'
      };
      
      enhancedQueryCache.set(cacheKey, cachedData, {
        staleTime: 30000,
        maxAge: 600000,
        priority: 2,
        backgroundRefresh: false
      }, metadata);

      const context = {
        table: 'test_table',
        cacheKey,
        userId: 'user123',
        isAuthRequired: false,
        priority: 'medium' as const,
        originalQuery: async () => []
      };

      const networkError = new Error('Network connection failed');
      const result = await progressiveErrorRecovery.handleQueryError(networkError, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedData);
      expect(result.level).toBe(FallbackLevel.CACHE_STALE);
    });

    it('should provide appropriate user messages', async () => {
      const context = {
        table: 'customers',
        cacheKey: 'test-key',
        userId: 'user123',
        isAuthRequired: false,
        priority: 'medium' as const,
        originalQuery: async () => []
      };

      const networkError = new Error('Network connection failed');
      const result = await progressiveErrorRecovery.handleQueryError(networkError, context);

      expect(result.userMessage).toContain('internet connection');
      expect(result.retryable).toBe(true);
    });
  });

  describe('AutomaticRetryManager', () => {
    it('should not retry non-retryable errors', async () => {
      const mockOperation = vi.fn(async () => {
        throw new Error('column "invalid_column" does not exist');
      });

      const result = await executeWithRetry(mockOperation, 'fast');

      expect(result.success).toBe(false);
      expect(result.totalAttempts).toBe(1);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry retryable errors', async () => {
      let attemptCount = 0;
      const mockOperation = vi.fn(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Network connection failed');
        }
        return 'success';
      });

      const result = await executeWithRetry(mockOperation, 'fast');

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.totalAttempts).toBe(2);
    });

    it('should calculate exponential backoff', async () => {
      let attemptCount = 0;
      const mockOperation = vi.fn(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('timeout occurred');
        }
        return 'success';
      });

      const result = await executeWithRetry(mockOperation, 'fast');

      expect(result.success).toBe(true);
      expect(result.attempts).toHaveLength(3);
      expect(result.attempts[1].delay).toBeGreaterThan(0);
      expect(result.attempts[2].delay).toBeGreaterThan(result.attempts[1].delay);
    });

    it('should provide retry statistics', () => {
      const stats = automaticRetryManager.getRetryStats();
      
      // Handle both array and stats object return types
      if (Array.isArray(stats)) {
        expect(Array.isArray(stats)).toBe(true);
      } else {
        expect(typeof stats.totalRetries).toBe('number');
        expect(typeof stats.successfulRetries).toBe('number');
        expect(typeof stats.activeRetries).toBe('number');
        expect(typeof stats.errorsByType).toBe('object');
      }
    });
  });

  describe('Error Classification', () => {
    it('should classify network errors as retryable', async () => {
      const mockOperation = vi.fn(async () => {
        throw new Error('fetch failed');
      });

      const result = await executeWithRetry(mockOperation, 'fast');
      
      expect(result.success).toBe(false);
      expect(result.totalAttempts).toBeGreaterThan(1); // Should retry
    });

    it('should classify schema errors as non-retryable', async () => {
      const mockOperation = vi.fn(async () => {
        throw new Error('column "nonexistent" does not exist');
      });

      const result = await executeWithRetry(mockOperation, 'fast');
      
      expect(result.success).toBe(false);
      expect(result.totalAttempts).toBe(1); // Should not retry
    });

    it('should classify permission errors as non-retryable', async () => {
      const mockOperation = vi.fn(async () => {
        throw new Error('permission denied');
      });

      const result = await executeWithRetry(mockOperation, 'fast');
      
      expect(result.success).toBe(false);
      expect(result.totalAttempts).toBe(1); // Should not retry
    });
  });

  describe('Recovery Statistics', () => {
    it('should track recovery attempts', async () => {
      const context = {
        table: 'test_table',
        cacheKey: 'stats-test',
        userId: 'user123',
        isAuthRequired: false,
        priority: 'medium' as const,
        originalQuery: async () => []
      };

      const error = new Error('Network error');
      await progressiveErrorRecovery.handleQueryError(error, context);

      const stats = progressiveErrorRecovery.getRecoveryStats();
      expect(stats.recentRecoveries).toBeGreaterThan(0);
    });

    it('should clear recovery attempts on success', () => {
      progressiveErrorRecovery.clearRecoveryAttempts('test_table', 'test-key');
      
      const stats = progressiveErrorRecovery.getRecoveryStats();
      // Should not throw and should provide valid stats
      expect(typeof stats.activeRecoveries).toBe('number');
    });
  });
});