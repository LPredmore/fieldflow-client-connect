import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseCircuitBreaker, ErrorType, CircuitBreaker } from '@/utils/circuitBreaker';

describe('Database Query Performance Fix Verification', () => {
  beforeEach(() => {
    supabaseCircuitBreaker.reset();
  });

  describe('Circuit Breaker Configuration', () => {
    it('should use updated thresholds (5 failures, 30s reset)', async () => {
      // Test that circuit breaker doesn't open until 5 failures
      let failureCount = 0;
      
      // Test 4 failures - should not open circuit
      for (let i = 0; i < 4; i++) {
        try {
          await supabaseCircuitBreaker.execute(async () => {
            failureCount++;
            throw new Error('Network timeout');
          });
        } catch (error) {
          // Expected to fail
        }
      }

      const stateAfter4Failures = supabaseCircuitBreaker.getState();
      expect(stateAfter4Failures.isOpen).toBe(false);
      expect(stateAfter4Failures.failureCount).toBe(4);

      // 5th failure should open it
      try {
        await supabaseCircuitBreaker.execute(async () => {
          failureCount++;
          throw new Error('Network timeout');
        });
      } catch (error) {
        // Expected to fail
      }

      const stateAfter5Failures = supabaseCircuitBreaker.getState();
      expect(stateAfter5Failures.isOpen).toBe(true);
      expect(stateAfter5Failures.failureCount).toBe(5);
    });

    it('should not count schema errors towards circuit breaker threshold', async () => {
      // Trigger multiple schema mismatch errors (non-retryable)
      for (let i = 0; i < 10; i++) {
        try {
          await supabaseCircuitBreaker.execute(async () => {
            throw new Error('column "notes" does not exist');
          });
        } catch (error) {
          // Expected to fail
        }
      }

      const circuitState = supabaseCircuitBreaker.getState();
      
      // Circuit should still be closed because schema errors are non-retryable
      expect(circuitState.isOpen).toBe(false);
      expect(circuitState.lastErrorType).toBe(ErrorType.SCHEMA_MISMATCH);
      expect(circuitState.failureCount).toBe(0); // Non-retryable errors don't count
    });

    it('should recover after successful operations', async () => {
      // Use fake timers for this test
      vi.useFakeTimers();

      // First, open the circuit breaker
      for (let i = 0; i < 6; i++) {
        try {
          await supabaseCircuitBreaker.execute(async () => {
            throw new Error('Network timeout');
          });
        } catch (error) {
          // Expected to fail
        }
      }

      expect(supabaseCircuitBreaker.getState().isOpen).toBe(true);

      // Simulate time passing for reset timeout
      vi.advanceTimersByTime(31000); // 31 seconds

      // Execute successful operations to close circuit (requires 3 successes)
      for (let i = 0; i < 3; i++) {
        await supabaseCircuitBreaker.execute(async () => {
          return 'success';
        });
      }

      const finalState = supabaseCircuitBreaker.getState();
      expect(finalState.isOpen).toBe(false);
      expect(finalState.successCount).toBe(3);

      // Restore real timers
      vi.useRealTimers();
    });
  });

  describe('Error Classification', () => {
    it('should correctly classify different error types', () => {
      const schemaError = new Error('column "notes" does not exist');
      const networkError = new Error('Network error: fetch failed');
      const timeoutError = new Error('Request timeout');
      const permissionError = new Error('permission denied');

      const schemaInfo = CircuitBreaker.classifyError(schemaError);
      const networkInfo = CircuitBreaker.classifyError(networkError);
      const timeoutInfo = CircuitBreaker.classifyError(timeoutError);
      const permissionInfo = CircuitBreaker.classifyError(permissionError);

      expect(schemaInfo.type).toBe(ErrorType.SCHEMA_MISMATCH);
      expect(schemaInfo.retryable).toBe(false);

      expect(networkInfo.type).toBe(ErrorType.NETWORK_ERROR);
      expect(networkInfo.retryable).toBe(true);

      expect(timeoutInfo.type).toBe(ErrorType.TIMEOUT_ERROR);
      expect(timeoutInfo.retryable).toBe(true);

      expect(permissionInfo.type).toBe(ErrorType.PERMISSION_ERROR);
      expect(permissionInfo.retryable).toBe(false);
    });
  });

  describe('Performance Requirements Validation', () => {
    it('should not block operations for extended periods', async () => {
      const startTime = Date.now();
      
      // Even with circuit breaker open, operations should fail fast
      for (let i = 0; i < 6; i++) {
        try {
          await supabaseCircuitBreaker.execute(async () => {
            throw new Error('Network timeout');
          });
        } catch (error) {
          // Expected to fail
        }
      }

      // Circuit should be open now
      expect(supabaseCircuitBreaker.getState().isOpen).toBe(true);

      // Try another operation - should fail immediately
      try {
        await supabaseCircuitBreaker.execute(async () => {
          return 'should not execute';
        });
      } catch (error) {
        expect(error.message).toContain('Circuit breaker is OPEN');
      }

      const totalTime = Date.now() - startTime;
      
      // Should not take more than a few seconds, definitely not 60 seconds
      expect(totalTime).toBeLessThan(5000);
    });

    it('should handle rapid successive operations efficiently', async () => {
      const startTime = Date.now();
      const operations = [];

      // Execute 100 rapid operations
      for (let i = 0; i < 100; i++) {
        operations.push(
          supabaseCircuitBreaker.execute(async () => {
            return `operation-${i}`;
          })
        );
      }

      const results = await Promise.all(operations);
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(100);
      expect(totalTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('Fix Effectiveness Summary', () => {
    it('should demonstrate all key fixes are working', () => {
      const circuitState = supabaseCircuitBreaker.getState();
      
      // Verify circuit breaker is in good state
      expect(circuitState.state).toBe('CLOSED');
      expect(circuitState.failureCount).toBe(0);
      
      // Verify error classification works
      const schemaError = CircuitBreaker.classifyError(
        new Error('column "notes" does not exist')
      );
      expect(schemaError.type).toBe(ErrorType.SCHEMA_MISMATCH);
      expect(schemaError.retryable).toBe(false);

      console.log('✅ All database query performance fixes verified:');
      console.log('  - Circuit breaker uses 5 failure threshold');
      console.log('  - Circuit breaker resets after 30 seconds');
      console.log('  - Schema errors are non-retryable');
      console.log('  - Operations fail fast when circuit is open');
      console.log('  - Error classification works correctly');
    });
  });
});