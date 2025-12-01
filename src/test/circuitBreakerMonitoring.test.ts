/**
 * Circuit Breaker Monitoring and Alerting Tests
 * Tests the monitoring system, metrics collection, and alerting functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { circuitBreakerMonitor, AlertInfo } from '../utils/circuitBreakerMonitor';
import { CircuitBreaker, ErrorType } from '../utils/circuitBreaker';

describe('Circuit Breaker Monitoring', () => {
  let mockAlertCallback: any;
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    // Reset monitoring state
    circuitBreakerMonitor.reset();
    
    // Setup mock alert callback
    mockAlertCallback = vi.fn();
    circuitBreakerMonitor.onAlert(mockAlertCallback);
    
    // Create circuit breaker for testing
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000, // 1 second for faster tests
      monitoringPeriod: 5000
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('State Change Logging', () => {
    it('should log state changes correctly', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Log a state change
      circuitBreakerMonitor.logStateChange('CLOSED', 'OPEN', {
        failureCount: 3,
        successCount: 0,
        requestCount: 5
      });

      // Verify logging
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('State change: CLOSED → OPEN'),
        expect.objectContaining({
          failureCount: 3,
          successCount: 0,
          requestCount: 5
        })
      );

      // Verify metrics updated
      const metrics = circuitBreakerMonitor.getMetrics();
      expect(metrics.totalStateChanges).toBe(1);
      expect(metrics.openEvents).toBe(1);

      consoleSpy.mockRestore();
    });

    it('should track recovery time when moving from OPEN to CLOSED', () => {
      // Simulate OPEN state
      circuitBreakerMonitor.logStateChange('CLOSED', 'OPEN');
      
      // Wait a bit then close
      setTimeout(() => {
        circuitBreakerMonitor.logStateChange('OPEN', 'CLOSED');
        
        const metrics = circuitBreakerMonitor.getMetrics();
        expect(metrics.averageRecoveryTime).toBeGreaterThan(0);
        expect(metrics.closedEvents).toBe(1);
      }, 10);
    });
  });

  describe('Error Logging', () => {
    it('should log errors with proper categorization', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Log different types of errors
      circuitBreakerMonitor.logError('NETWORK_ERROR', 'Connection failed', {
        failureCount: 1,
        currentState: 'CLOSED'
      });

      circuitBreakerMonitor.logError('SCHEMA_MISMATCH', 'Column not found', {
        failureCount: 1,
        currentState: 'CLOSED'
      });

      // Verify logging
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('NETWORK_ERROR'),
        expect.objectContaining({
          message: 'Connection failed',
          failureCount: 1
        })
      );

      // Verify metrics
      const metrics = circuitBreakerMonitor.getMetrics();
      expect(metrics.totalErrors).toBe(2);
      expect(metrics.errorsByType['NETWORK_ERROR']).toBe(1);
      expect(metrics.errorsByType['SCHEMA_MISMATCH']).toBe(1);

      consoleSpy.mockRestore();
    });

    it('should update reliability metrics correctly', () => {
      // Log some errors and successes
      circuitBreakerMonitor.logError('NETWORK_ERROR', 'Error 1');
      circuitBreakerMonitor.logSuccess();
      circuitBreakerMonitor.logSuccess();
      circuitBreakerMonitor.logError('TIMEOUT_ERROR', 'Error 2');

      const metrics = circuitBreakerMonitor.getMetrics();
      expect(metrics.totalRequests).toBe(4);
      expect(metrics.totalErrors).toBe(2);
      expect(metrics.totalSuccesses).toBe(2);
      expect(metrics.reliability).toBe(50); // 2 successes out of 4 requests
    });
  });

  describe('Success Logging', () => {
    it('should log successes and update metrics', () => {
      circuitBreakerMonitor.logSuccess({
        successCount: 1,
        requestCount: 1,
        currentState: 'CLOSED'
      });

      const metrics = circuitBreakerMonitor.getMetrics();
      expect(metrics.totalSuccesses).toBe(1);
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.reliability).toBe(100);
    });

    it('should log HALF_OPEN successes with more detail', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      circuitBreakerMonitor.logSuccess({
        successCount: 1,
        requestCount: 1,
        currentState: 'HALF_OPEN'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Success in HALF_OPEN state'),
        expect.objectContaining({
          successCount: 1
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Alert System', () => {
    it('should trigger frequent opening alerts', async () => {
      // Configure for immediate alerting
      circuitBreakerMonitor.updateAlertConfig({
        frequentOpeningThreshold: 2,
        frequentOpeningWindow: 1000 // 1 second
      });

      // Trigger multiple state changes to OPEN
      circuitBreakerMonitor.logStateChange('CLOSED', 'OPEN');
      circuitBreakerMonitor.logStateChange('HALF_OPEN', 'OPEN');

      // Wait for alert processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockAlertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'frequent_opening',
          severity: 'high',
          message: expect.stringContaining('opened 2 times')
        })
      );
    });

    it('should trigger low reliability alerts', async () => {
      // Configure for immediate alerting
      circuitBreakerMonitor.updateAlertConfig({
        lowReliabilityThreshold: 60 // 60%
      });

      // Create low reliability scenario (need > 10 requests)
      // Log 8 errors and 4 successes = 12 requests with 33.3% success rate
      for (let i = 0; i < 8; i++) {
        circuitBreakerMonitor.logError('NETWORK_ERROR', `Error ${i}`);
      }
      for (let i = 0; i < 4; i++) {
        circuitBreakerMonitor.logSuccess();
      }

      // Wait for alert processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockAlertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'low_reliability',
          severity: 'medium',
          message: expect.stringContaining('reliability dropped to 33.3%')
        })
      );
    });

    it('should not trigger alerts when disabled', async () => {
      // Disable alerts
      circuitBreakerMonitor.updateAlertConfig({ enabled: false });

      // Trigger conditions that would normally alert
      circuitBreakerMonitor.logStateChange('CLOSED', 'OPEN');
      circuitBreakerMonitor.logStateChange('HALF_OPEN', 'OPEN');
      circuitBreakerMonitor.logStateChange('CLOSED', 'OPEN');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockAlertCallback).not.toHaveBeenCalled();
    });
  });

  describe('Integration with Circuit Breaker', () => {
    it('should monitor circuit breaker operations', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Create operations that will fail
      const failingOperation = () => Promise.reject(new Error('Network error'));
      
      // Execute failing operations to trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Verify monitoring captured the events
      const metrics = circuitBreakerMonitor.getMetrics();
      expect(metrics.totalErrors).toBeGreaterThan(0);
      expect(metrics.openEvents).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });

    it('should track successful operations', async () => {
      const successfulOperation = () => Promise.resolve('success');
      
      // Execute successful operations
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.execute(successfulOperation);
      }

      const metrics = circuitBreakerMonitor.getMetrics();
      expect(metrics.totalSuccesses).toBe(3);
      expect(metrics.reliability).toBe(100);
    });
  });

  describe('Metrics and Reporting', () => {
    it('should provide comprehensive metrics', () => {
      // Generate some activity
      circuitBreakerMonitor.logStateChange('CLOSED', 'OPEN');
      circuitBreakerMonitor.logError('NETWORK_ERROR', 'Error 1');
      circuitBreakerMonitor.logError('SCHEMA_MISMATCH', 'Error 2');
      circuitBreakerMonitor.logSuccess();

      const metrics = circuitBreakerMonitor.getMetrics();
      
      expect(metrics).toMatchObject({
        totalStateChanges: 1,
        openEvents: 1,
        totalErrors: 2,
        totalSuccesses: 1,
        totalRequests: 3,
        errorsByType: {
          'NETWORK_ERROR': 1,
          'SCHEMA_MISMATCH': 1
        }
      });

      expect(metrics.reliability).toBeCloseTo(33.33, 1); // 1 success out of 3 requests
    });

    it('should provide metrics summary', () => {
      // Generate activity
      circuitBreakerMonitor.logError('NETWORK_ERROR', 'Error 1');
      circuitBreakerMonitor.logSuccess();
      circuitBreakerMonitor.logStateChange('CLOSED', 'OPEN');

      const summary = circuitBreakerMonitor.getMetricsSummary();
      
      expect(summary).toMatchObject({
        reliability: '50.0%',
        totalRequests: 2,
        openEvents: 1
      });
    });

    it('should maintain event history', () => {
      // Generate events
      circuitBreakerMonitor.logError('NETWORK_ERROR', 'Error 1');
      circuitBreakerMonitor.logSuccess();
      circuitBreakerMonitor.logStateChange('CLOSED', 'OPEN');

      const events = circuitBreakerMonitor.getEvents();
      expect(events).toHaveLength(3);
      
      expect(events[0]).toMatchObject({
        eventType: 'error',
        errorType: 'NETWORK_ERROR'
      });
      
      expect(events[1]).toMatchObject({
        eventType: 'success'
      });
      
      expect(events[2]).toMatchObject({
        eventType: 'state_change',
        previousState: 'CLOSED',
        newState: 'OPEN'
      });
    });
  });

  describe('Configuration and Control', () => {
    it('should allow updating alert configuration', () => {
      const newConfig = {
        frequentOpeningThreshold: 5,
        longOpenDurationThreshold: 60000
      };

      circuitBreakerMonitor.updateAlertConfig(newConfig);
      
      // Verify configuration was updated by checking that alerts don't trigger
      // with the new higher threshold
      circuitBreakerMonitor.logStateChange('CLOSED', 'OPEN');
      circuitBreakerMonitor.logStateChange('HALF_OPEN', 'OPEN');
      
      expect(mockAlertCallback).not.toHaveBeenCalled();
    });

    it('should allow enabling and disabling monitoring', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Disable monitoring
      circuitBreakerMonitor.disable();
      circuitBreakerMonitor.logStateChange('CLOSED', 'OPEN');
      
      // Should not log state change when disabled (but will log disable message)
      const stateChangeCalls = consoleSpy.mock.calls.filter(call => 
        call[0] && typeof call[0] === 'string' && call[0].includes('State change')
      );
      expect(stateChangeCalls).toHaveLength(0);
      
      // Re-enable monitoring
      circuitBreakerMonitor.enable();
      circuitBreakerMonitor.logStateChange('OPEN', 'CLOSED');
      
      // Should log when enabled - check for the specific call
      const enabledStateCalls = consoleSpy.mock.calls.filter(call => 
        call[0] && typeof call[0] === 'string' && call[0].includes('State change: OPEN → CLOSED')
      );
      expect(enabledStateCalls).toHaveLength(1);

      consoleSpy.mockRestore();
    });

    it('should reset metrics and events', () => {
      // Generate some data
      circuitBreakerMonitor.logError('NETWORK_ERROR', 'Error');
      circuitBreakerMonitor.logSuccess();
      circuitBreakerMonitor.logStateChange('CLOSED', 'OPEN');

      // Verify data exists
      expect(circuitBreakerMonitor.getMetrics().totalRequests).toBe(2);
      expect(circuitBreakerMonitor.getEvents()).toHaveLength(3);

      // Reset
      circuitBreakerMonitor.reset();

      // Verify data cleared
      const metrics = circuitBreakerMonitor.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.totalErrors).toBe(0);
      expect(circuitBreakerMonitor.getEvents()).toHaveLength(0);
    });
  });
});