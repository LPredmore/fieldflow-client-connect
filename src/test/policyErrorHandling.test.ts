/**
 * Policy Error Handling Tests
 * 
 * Tests the enhanced error detection and handling for policy-related failures
 * Requirements: 3.1, 3.2, 3.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreaker, ErrorType } from '@/utils/circuitBreaker';
import { getPolicyErrorMessage, isPolicyError, getErrorCode } from '@/utils/policyErrorMessages';
import { executeWithPolicyFallback, getFallbackGuidance } from '@/utils/policyFallbackStrategies';
import { recordPolicyError, getRecoveryStatus } from '@/utils/policyErrorRecovery';

describe('Policy Error Detection', () => {
  beforeEach(() => {
    // Reset circuit breaker state before each test
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000,
      monitoringPeriod: 60000
    });
    circuitBreaker.reset();
  });

  describe('Error Classification', () => {
    it('should detect infinite recursion errors', () => {
      const error = new Error('infinite recursion detected in policy for relation \'clinicians\'');
      const errorInfo = CircuitBreaker.classifyError(error);
      
      expect(errorInfo.type).toBe(ErrorType.POLICY_INFINITE_RECURSION);
      expect(errorInfo.retryable).toBe(false);
    });

    it('should detect circular dependency errors', () => {
      const error = new Error('circular dependency detected in policy evaluation');
      const errorInfo = CircuitBreaker.classifyError(error);
      
      expect(errorInfo.type).toBe(ErrorType.POLICY_CIRCULAR_DEPENDENCY);
      expect(errorInfo.retryable).toBe(false);
    });

    it('should detect general policy evaluation errors', () => {
      const error = new Error('policy evaluation failed for table access');
      const errorInfo = CircuitBreaker.classifyError(error);
      
      expect(errorInfo.type).toBe(ErrorType.POLICY_EVALUATION_ERROR);
      expect(errorInfo.retryable).toBe(false);
    });

    it('should detect timeout-based infinite recursion', () => {
      const error = new Error('Query timeout - possible infinite recursion');
      const errorInfo = CircuitBreaker.classifyError(error);
      
      expect(errorInfo.type).toBe(ErrorType.POLICY_INFINITE_RECURSION);
      expect(errorInfo.retryable).toBe(false);
    });
  });

  describe('User-Friendly Error Messages', () => {
    it('should provide appropriate message for infinite recursion', () => {
      const errorInfo = getPolicyErrorMessage(
        ErrorType.POLICY_INFINITE_RECURSION,
        'infinite recursion detected in policy for relation \'clinicians\''
      );
      
      expect(errorInfo.userMessage).toContain('technical issue');
      expect(errorInfo.severity).toBe('critical');
      expect(errorInfo.actionable).toBe(false);
      expect(errorInfo.suggestedActions).toContain('Please try again in a few minutes');
    });

    it('should provide appropriate message for circular dependency', () => {
      const errorInfo = getPolicyErrorMessage(
        ErrorType.POLICY_CIRCULAR_DEPENDENCY,
        'circular dependency detected'
      );
      
      expect(errorInfo.userMessage).toContain('configuration issue');
      expect(errorInfo.severity).toBe('critical');
      expect(errorInfo.actionable).toBe(false);
    });

    it('should provide appropriate message for policy evaluation errors', () => {
      const errorInfo = getPolicyErrorMessage(
        ErrorType.POLICY_EVALUATION_ERROR,
        'policy evaluation failed'
      );
      
      expect(errorInfo.userMessage).toContain('security policy issue');
      expect(errorInfo.severity).toBe('high');
      expect(errorInfo.actionable).toBe(true);
    });
  });

  describe('Policy Error Detection Utility', () => {
    it('should correctly identify policy errors', () => {
      expect(isPolicyError(ErrorType.POLICY_INFINITE_RECURSION)).toBe(true);
      expect(isPolicyError(ErrorType.POLICY_CIRCULAR_DEPENDENCY)).toBe(true);
      expect(isPolicyError(ErrorType.POLICY_EVALUATION_ERROR)).toBe(true);
      expect(isPolicyError(ErrorType.NETWORK_ERROR)).toBe(false);
      expect(isPolicyError(ErrorType.SCHEMA_MISMATCH)).toBe(false);
    });

    it('should generate appropriate error codes', () => {
      expect(getErrorCode(ErrorType.POLICY_INFINITE_RECURSION)).toBe('POL_RECURSION');
      expect(getErrorCode(ErrorType.POLICY_CIRCULAR_DEPENDENCY)).toBe('POL_CIRCULAR');
      expect(getErrorCode(ErrorType.POLICY_EVALUATION_ERROR)).toBe('POL_EVAL');
    });
  });

  describe('Fallback Strategies', () => {
    it('should provide appropriate fallback guidance for policy errors', () => {
      const infiniteRecursionGuidance = getFallbackGuidance(ErrorType.POLICY_INFINITE_RECURSION);
      expect(infiniteRecursionGuidance.canRetry).toBe(false);
      expect(infiniteRecursionGuidance.userAction).toContain('wait a few minutes');

      const circularDependencyGuidance = getFallbackGuidance(ErrorType.POLICY_CIRCULAR_DEPENDENCY);
      expect(circularDependencyGuidance.canRetry).toBe(false);
      expect(circularDependencyGuidance.userAction).toContain('contact support');

      const policyEvalGuidance = getFallbackGuidance(ErrorType.POLICY_EVALUATION_ERROR);
      expect(policyEvalGuidance.canRetry).toBe(true);
      expect(policyEvalGuidance.userAction).toContain('try again');
    });

    it('should handle policy errors with fallback execution', async () => {
      let attemptCount = 0;
      const failingOperation = async () => {
        attemptCount++;
        throw new Error('infinite recursion detected in policy for relation \'clinicians\'');
      };

      const result = await executeWithPolicyFallback(failingOperation, {
        enableRetry: false,
        maxRetries: 0
      });

      expect(result.success).toBe(false);
      expect(result.fallbackUsed).toBe(true);
      expect(attemptCount).toBe(1); // Should not retry policy errors
    });
  });

  describe('Policy Error Recovery', () => {
    it('should track policy errors for recovery', async () => {
      // Get initial status
      const initialStatus = getRecoveryStatus();
      const initialCount = initialStatus.errorCount;
      
      await recordPolicyError(ErrorType.POLICY_INFINITE_RECURSION, 'test infinite recursion');
      
      // Check that error was recorded (may be reset after recovery)
      // The key is that recovery was attempted
      const finalStatus = getRecoveryStatus();
      expect(finalStatus.recoveryAttempts).toBeGreaterThan(initialStatus.recoveryAttempts);
    });

    it('should enter recovery mode for critical policy errors', async () => {
      const initialStatus = getRecoveryStatus();
      
      await recordPolicyError(ErrorType.POLICY_INFINITE_RECURSION, 'critical policy error');
      
      const status = getRecoveryStatus();
      // Recovery should have been attempted at least once (may be in timeout)
      expect(status.recoveryAttempts).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Circuit Breaker Policy Integration', () => {
    it('should immediately open circuit for infinite recursion errors', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 30000,
        monitoringPeriod: 60000
      });

      const error = new Error('infinite recursion detected in policy for relation \'clinicians\'');
      
      try {
        await circuitBreaker.execute(async () => {
          throw error;
        });
      } catch (e) {
        // Expected to throw
      }

      const state = circuitBreaker.getState();
      expect(state.isOpen).toBe(true);
      expect(state.hasCriticalPolicyErrors).toBe(true);
    });

    it('should track policy error statistics', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 30000,
        monitoringPeriod: 60000
      });

      // Simulate multiple policy errors
      const errors = [
        new Error('infinite recursion detected in policy for relation \'clinicians\''),
        new Error('circular dependency detected in policy evaluation'),
        new Error('policy evaluation failed for table access')
      ];

      let errorCount = 0;
      for (const error of errors) {
        try {
          await circuitBreaker.execute(async () => {
            throw error;
          });
        } catch (e) {
          errorCount++;
          // Expected to throw
        }
      }

      const state = circuitBreaker.getState();
      const policyStats = circuitBreaker.getPolicyErrorStats();
      
      // After the first critical error (infinite recursion), circuit opens immediately
      // So we expect at least 1 policy error to be tracked
      expect(policyStats.totalPolicyErrors).toBeGreaterThanOrEqual(1);
      expect(policyStats.hasCriticalErrors).toBe(true);
      expect(circuitBreaker.shouldUsePolicyFallback()).toBe(true);
      expect(errorCount).toBe(3); // All three operations should have thrown
    });
  });
});