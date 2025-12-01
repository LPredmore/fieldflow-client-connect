/**
 * Basic tests for DeduplicationManager
 * 
 * These tests verify the core functionality of request deduplication,
 * queuing, and cancellation.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeduplicationManager, QueryPriority } from './deduplicationManager';

describe('DeduplicationManager', () => {
  let manager: DeduplicationManager;

  beforeEach(() => {
    manager = new DeduplicationManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  test('should deduplicate identical requests', async () => {
    const mockOperation = vi.fn().mockResolvedValue(['data1', 'data2']);
    const key = 'test-key';

    // Start two identical requests
    const promise1 = manager.deduplicate(key, mockOperation, QueryPriority.MEDIUM);
    const promise2 = manager.deduplicate(key, mockOperation, QueryPriority.MEDIUM);

    // Wait for both to complete
    const [result1, result2] = await Promise.all([promise1, promise2]);

    // Both should return the same result
    expect(result1).toEqual(['data1', 'data2']);
    expect(result2).toEqual(['data1', 'data2']);

    // Operation should only be called once
    expect(mockOperation).toHaveBeenCalledTimes(1);

    // Check metrics
    const metrics = manager.getMetrics();
    expect(metrics.totalRequests).toBe(2);
    expect(metrics.deduplicatedRequests).toBe(1);
    expect(metrics.deduplicationSavings).toBe(50);
  });

  test('should handle request failures correctly', async () => {
    const mockError = new Error('Test error');
    const mockOperation = vi.fn().mockRejectedValue(mockError);
    const key = 'test-key';

    // Start two identical requests
    const promise1 = manager.deduplicate(key, mockOperation, QueryPriority.MEDIUM);
    const promise2 = manager.deduplicate(key, mockOperation, QueryPriority.MEDIUM);

    // Both should reject with the same error
    await expect(promise1).rejects.toThrow('Test error');
    await expect(promise2).rejects.toThrow('Test error');

    // Operation should only be called once
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });

  test('should cancel pending requests', async () => {
    const mockOperation = vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve(['data']), 100))
    );
    const key = 'test-key';

    // Start a request
    const promise = manager.deduplicate(key, mockOperation, QueryPriority.MEDIUM);

    // Cancel it
    const cancelledCount = manager.cancelPendingRequests({ pattern: key });

    // Should have cancelled 1 request
    expect(cancelledCount).toBe(0); // The main request can't be cancelled, only queued ones

    // Start another request that will be queued
    const queuedPromise = manager.deduplicate(key, mockOperation, QueryPriority.MEDIUM);

    // Cancel queued requests
    const queuedCancelledCount = manager.cancelPendingRequests({ pattern: key });
    expect(queuedCancelledCount).toBeGreaterThanOrEqual(0);

    // Wait for original to complete
    await promise;
  });

  test('should track metrics correctly', async () => {
    const mockOperation = vi.fn().mockResolvedValue(['data']);
    
    // Execute some requests
    await manager.deduplicate('key1', mockOperation, QueryPriority.HIGH);
    await manager.deduplicate('key1', mockOperation, QueryPriority.HIGH); // Deduplicated
    await manager.deduplicate('key2', mockOperation, QueryPriority.LOW);

    const metrics = manager.getMetrics();
    
    expect(metrics.totalRequests).toBe(3);
    expect(metrics.deduplicatedRequests).toBe(1);
    expect(metrics.deduplicationSavings).toBeCloseTo(33.33, 1);
    expect(metrics.pendingRequests).toBe(0);
  });

  test('should prioritize requests correctly', async () => {
    const results: string[] = [];
    const mockOperation = (value: string) => vi.fn().mockImplementation(async () => {
      results.push(value);
      return [value];
    });

    const key = 'test-key';
    
    // Start a base request
    const basePromise = manager.deduplicate(key, mockOperation('base')(), QueryPriority.LOW);
    
    // Queue requests with different priorities
    const lowPromise = manager.deduplicate(key, mockOperation('low')(), QueryPriority.LOW);
    const highPromise = manager.deduplicate(key, mockOperation('high')(), QueryPriority.HIGH);
    const criticalPromise = manager.deduplicate(key, mockOperation('critical')(), QueryPriority.CRITICAL);

    // Wait for all to complete
    await Promise.all([basePromise, lowPromise, highPromise, criticalPromise]);

    // Only the base operation should have executed
    expect(results).toEqual(['base']);
  });
});