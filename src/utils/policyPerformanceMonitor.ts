import React from 'react';

/**
 * Policy Performance Monitoring Utilities
 * 
 * Provides logging, alerting, and metrics collection for RLS policy performance
 * to help identify slow policy execution and potential issues.
 */

interface PolicyMetrics {
  policyName: string;
  tableName: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  executionTime: number;
  timestamp: Date;
  userId?: string;
  success: boolean;
  errorMessage?: string;
}

interface PolicyAlert {
  type: 'SLOW_EXECUTION' | 'HIGH_ERROR_RATE' | 'POLICY_FAILURE';
  policyName: string;
  tableName: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

class PolicyPerformanceMonitor {
  private metrics: PolicyMetrics[] = [];
  private alertThresholds = {
    slowExecutionMs: 2000, // Alert if policy takes > 2 seconds
    errorRatePercent: 10,   // Alert if error rate > 10%
    maxMetricsHistory: 1000 // Keep last 1000 metrics
  };

  /**
   * Log policy execution metrics
   */
  logPolicyExecution(
    policyName: string,
    tableName: string,
    operation: PolicyMetrics['operation'],
    executionTime: number,
    success: boolean,
    userId?: string,
    errorMessage?: string
  ): void {
    const metric: PolicyMetrics = {
      policyName,
      tableName,
      operation,
      executionTime,
      timestamp: new Date(),
      userId,
      success,
      errorMessage
    };

    this.metrics.push(metric);

    // Keep only recent metrics to prevent memory issues
    if (this.metrics.length > this.alertThresholds.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.alertThresholds.maxMetricsHistory);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Policy Monitor] ${policyName} on ${tableName}: ${executionTime}ms`, {
        operation,
        success,
        userId,
        errorMessage
      });
    }

    // Check for alerts
    this.checkForAlerts(metric);
  }

  /**
   * Check if current metric triggers any alerts
   */
  private checkForAlerts(metric: PolicyMetrics): void {
    // Check for slow execution
    if (metric.executionTime > this.alertThresholds.slowExecutionMs) {
      this.triggerAlert({
        type: 'SLOW_EXECUTION',
        policyName: metric.policyName,
        tableName: metric.tableName,
        threshold: this.alertThresholds.slowExecutionMs,
        currentValue: metric.executionTime,
        timestamp: new Date(),
        severity: metric.executionTime > 5000 ? 'CRITICAL' : 'HIGH'
      });
    }

    // Check for policy failure
    if (!metric.success) {
      this.triggerAlert({
        type: 'POLICY_FAILURE',
        policyName: metric.policyName,
        tableName: metric.tableName,
        threshold: 0,
        currentValue: 1,
        timestamp: new Date(),
        severity: 'HIGH'
      });
    }

    // Check error rate for this policy (last 10 executions)
    const recentMetrics = this.getRecentMetricsForPolicy(metric.policyName, 10);
    if (recentMetrics.length >= 5) { // Only check if we have enough data
      const errorRate = (recentMetrics.filter(m => !m.success).length / recentMetrics.length) * 100;
      
      if (errorRate > this.alertThresholds.errorRatePercent) {
        this.triggerAlert({
          type: 'HIGH_ERROR_RATE',
          policyName: metric.policyName,
          tableName: metric.tableName,
          threshold: this.alertThresholds.errorRatePercent,
          currentValue: errorRate,
          timestamp: new Date(),
          severity: errorRate > 50 ? 'CRITICAL' : 'HIGH'
        });
      }
    }
  }

  /**
   * Trigger an alert for policy issues
   */
  private triggerAlert(alert: PolicyAlert): void {
    console.warn(`[Policy Alert] ${alert.type}: ${alert.policyName}`, alert);

    // In production, this would integrate with your alerting system
    // For now, we'll log to console and could extend to send to monitoring services
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with alerting service (e.g., Sentry, DataDog, etc.)
      this.sendToAlertingService(alert);
    }
  }

  /**
   * Send alert to external monitoring service
   */
  private sendToAlertingService(alert: PolicyAlert): void {
    // Placeholder for integration with external alerting services
    // This could be Sentry, DataDog, CloudWatch, etc.
    console.error(`[Production Alert] ${alert.type}:`, alert);
  }

  /**
   * Get recent metrics for a specific policy
   */
  private getRecentMetricsForPolicy(policyName: string, limit: number): PolicyMetrics[] {
    return this.metrics
      .filter(m => m.policyName === policyName)
      .slice(-limit);
  }

  /**
   * Get performance metrics for dashboard
   */
  getDashboardMetrics(): {
    totalExecutions: number;
    averageExecutionTime: number;
    errorRate: number;
    slowQueries: number;
    topSlowPolicies: Array<{ policyName: string; avgTime: number; executions: number }>;
    recentAlerts: PolicyAlert[];
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Filter to recent metrics (last hour)
    const recentMetrics = this.metrics.filter(m => m.timestamp >= oneHourAgo);

    const totalExecutions = recentMetrics.length;
    const successfulExecutions = recentMetrics.filter(m => m.success);
    const averageExecutionTime = totalExecutions > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalExecutions 
      : 0;
    const errorRate = totalExecutions > 0 
      ? ((totalExecutions - successfulExecutions.length) / totalExecutions) * 100 
      : 0;
    const slowQueries = recentMetrics.filter(m => m.executionTime > this.alertThresholds.slowExecutionMs).length;

    // Calculate top slow policies
    const policyStats = new Map<string, { totalTime: number; count: number }>();
    recentMetrics.forEach(m => {
      const existing = policyStats.get(m.policyName) || { totalTime: 0, count: 0 };
      policyStats.set(m.policyName, {
        totalTime: existing.totalTime + m.executionTime,
        count: existing.count + 1
      });
    });

    const topSlowPolicies = Array.from(policyStats.entries())
      .map(([policyName, stats]) => ({
        policyName,
        avgTime: stats.totalTime / stats.count,
        executions: stats.count
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 5);

    return {
      totalExecutions,
      averageExecutionTime: Math.round(averageExecutionTime),
      errorRate: Math.round(errorRate * 100) / 100,
      slowQueries,
      topSlowPolicies,
      recentAlerts: [] // Would store recent alerts in production
    };
  }

  /**
   * Update alert thresholds
   */
  updateThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
  }

  /**
   * Clear metrics history
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(): PolicyMetrics[] {
    return [...this.metrics];
  }
}

// Singleton instance for global use
export const policyPerformanceMonitor = new PolicyPerformanceMonitor();

/**
 * Decorator function to monitor policy execution time
 */
export function monitorPolicyExecution<T extends (...args: any[]) => Promise<any>>(
  policyName: string,
  tableName: string,
  operation: PolicyMetrics['operation']
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      let success = true;
      let errorMessage: string | undefined;

      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } catch (error) {
        success = false;
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw error;
      } finally {
        const executionTime = Date.now() - startTime;
        policyPerformanceMonitor.logPolicyExecution(
          policyName,
          tableName,
          operation,
          executionTime,
          success,
          undefined, // userId would be extracted from context in real implementation
          errorMessage
        );
      }
    };

    return descriptor;
  };
}

/**
 * Hook for React components to access policy performance metrics
 */
export function usePolicyPerformanceMetrics() {
  const [metrics, setMetrics] = React.useState(policyPerformanceMonitor.getDashboardMetrics());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(policyPerformanceMonitor.getDashboardMetrics());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return metrics;
}

export type { PolicyMetrics, PolicyAlert };