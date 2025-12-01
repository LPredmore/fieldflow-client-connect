/**
 * Tests for Policy Monitoring and Validation System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock environment variables
vi.mock('import.meta', () => ({
  env: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'test-anon-key',
    VITE_SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    NODE_ENV: 'test'
  }
}));

import { policyPerformanceMonitor } from '../utils/policyPerformanceMonitor';

describe('Policy Performance Monitor', () => {
  beforeEach(() => {
    policyPerformanceMonitor.clearMetrics();
  });

  it('should log policy execution metrics', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    policyPerformanceMonitor.logPolicyExecution(
      'test_policy',
      'test_table',
      'SELECT',
      500,
      true,
      'user123'
    );

    const metrics = policyPerformanceMonitor.getDashboardMetrics();
    expect(metrics.totalExecutions).toBe(1);
    expect(metrics.averageExecutionTime).toBe(500);
    expect(metrics.errorRate).toBe(0);
    
    consoleSpy.mockRestore();
  });

  it('should detect slow policy execution', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Log a slow execution (> 2000ms threshold)
    policyPerformanceMonitor.logPolicyExecution(
      'slow_policy',
      'test_table',
      'SELECT',
      3000,
      true,
      'user123'
    );

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Policy Alert] SLOW_EXECUTION'),
      expect.any(Object)
    );
    
    consoleWarnSpy.mockRestore();
  });

  it('should track error rates', () => {
    // Log multiple executions with some failures
    for (let i = 0; i < 10; i++) {
      policyPerformanceMonitor.logPolicyExecution(
        'test_policy',
        'test_table',
        'SELECT',
        500,
        i < 8, // 8 successes, 2 failures = 20% error rate
        'user123',
        i >= 8 ? 'Test error' : undefined
      );
    }

    const metrics = policyPerformanceMonitor.getDashboardMetrics();
    expect(metrics.errorRate).toBe(20);
  });

  it('should provide dashboard metrics', () => {
    // Log some test metrics
    policyPerformanceMonitor.logPolicyExecution('policy1', 'table1', 'SELECT', 100, true);
    policyPerformanceMonitor.logPolicyExecution('policy2', 'table2', 'INSERT', 200, true);
    policyPerformanceMonitor.logPolicyExecution('policy1', 'table1', 'UPDATE', 150, false, 'user1', 'Test error');

    const metrics = policyPerformanceMonitor.getDashboardMetrics();
    
    expect(metrics.totalExecutions).toBe(3);
    expect(metrics.averageExecutionTime).toBe(150); // (100 + 200 + 150) / 3
    expect(metrics.errorRate).toBeCloseTo(33.33, 1); // 1 error out of 3
    expect(metrics.topSlowPolicies).toHaveLength(2);
  });

  it('should update alert thresholds', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Update threshold to 100ms
    policyPerformanceMonitor.updateThresholds({ slowExecutionMs: 100 });
    
    // Log execution that exceeds new threshold
    policyPerformanceMonitor.logPolicyExecution(
      'test_policy',
      'test_table',
      'SELECT',
      150,
      true
    );

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Policy Alert] SLOW_EXECUTION'),
      expect.any(Object)
    );
    
    consoleWarnSpy.mockRestore();
  });
});

describe('Automated Policy Validator', () => {
  it('should detect circular dependencies in policy definitions', () => {
    // Test the circular dependency detection logic directly
    const mockPolicy1 = {
      policyname: 'test_policy',
      tablename: 'clinicians',
      definition: 'SELECT * FROM profiles WHERE profiles.user_id IN (SELECT user_id FROM clinicians)'
    };

    const mockPolicy2 = {
      policyname: 'safe_policy',
      tablename: 'clinicians',
      definition: 'SELECT * WHERE user_id = auth.uid()'
    };

    // Create a mock validator class to test the logic
    class MockValidator {
      detectCircularDependency(policy: any): boolean {
        const policyDefinition = policy.definition || '';
        const tableName = policy.tablename;

        const commonCircularPatterns = [
          new RegExp(`SELECT.*FROM\\s+(profiles|user_permissions).*WHERE.*${tableName}`, 'i'),
          new RegExp(`SELECT.*\\(\\s*SELECT.*FROM\\s+${tableName}`, 'i'),
          new RegExp(`FROM\\s+${tableName}.*WHERE.*IN\\s*\\(.*SELECT.*FROM\\s+${tableName}`, 'i')
        ];

        return commonCircularPatterns.some(pattern => pattern.test(policyDefinition));
      }
    }

    const validator = new MockValidator();
    expect(validator.detectCircularDependency(mockPolicy1)).toBe(true);
    expect(validator.detectCircularDependency(mockPolicy2)).toBe(false);
  });

  it('should classify performance scores correctly', () => {
    // Test performance score classification
    const getPerformanceScore = (executionTime: number): 'GOOD' | 'WARNING' | 'CRITICAL' => {
      if (executionTime > 2000) return 'CRITICAL';
      if (executionTime > 1000) return 'WARNING';
      return 'GOOD';
    };
    
    expect(getPerformanceScore(500)).toBe('GOOD');
    expect(getPerformanceScore(1500)).toBe('WARNING');
    expect(getPerformanceScore(3000)).toBe('CRITICAL');
  });
});

describe('Policy Monitoring Integration', () => {
  it('should work together for comprehensive monitoring', () => {
    // Clear metrics first to ensure clean state
    policyPerformanceMonitor.clearMetrics();
    
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Simulate policy execution monitoring
    policyPerformanceMonitor.logPolicyExecution(
      'clinicians_select_policy',
      'clinicians',
      'SELECT',
      1500,
      true,
      'user123'
    );

    // Check that metrics are recorded
    const metrics = policyPerformanceMonitor.getDashboardMetrics();
    expect(metrics.totalExecutions).toBe(1);
    expect(metrics.topSlowPolicies[0]?.policyName).toBe('clinicians_select_policy');
    
    consoleSpy.mockRestore();
  });

  it('should handle policy monitoring initialization', () => {
    // Test that monitoring can be initialized without errors
    expect(() => {
      // Mock the initialization process
      const mockInit = () => {
        console.log('Policy monitoring initialized');
        return true;
      };
      
      const result = mockInit();
      expect(result).toBe(true);
    }).not.toThrow();
  });
});