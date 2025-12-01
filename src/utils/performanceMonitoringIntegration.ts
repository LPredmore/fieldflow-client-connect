/**
 * Performance Monitoring Integration
 * 
 * Provides easy integration points for the performance monitoring system
 * with existing query hooks and components.
 */

import { queryPerformanceMonitor, PerformanceAlert } from './queryPerformanceMonitor';
import { performanceMetricsAggregator } from './performanceMetricsAggregator';

/**
 * Hook to integrate performance monitoring with useSupabaseQuery
 */
export function useQueryPerformanceTracking() {
  const startTracking = (
    table: string, 
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM',
    context?: Record<string, unknown>
  ) => {
    const queryId = `${table}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    queryPerformanceMonitor.startQuery(queryId, table, priority, context);
    return queryId;
  };

  const endTracking = (
    queryId: string,
    options: {
      cacheHit?: boolean;
      cacheAge?: number;
      deduplicationSaved?: boolean;
      resultCount?: number;
      errorType?: string;
      retryCount?: number;
      authenticationDelay?: number;
      networkTime?: number;
      processingTime?: number;
      userId?: string;
    } = {}
  ) => {
    queryPerformanceMonitor.endQuery(queryId, options);
  };

  return { startTracking, endTracking };
}

/**
 * Get current performance metrics for display
 */
export function getCurrentPerformanceMetrics(timeWindowMs: number = 300000) {
  return queryPerformanceMonitor.getAggregatedMetrics(timeWindowMs);
}

/**
 * Get system health information
 */
export function getSystemHealth(timeWindowMs: number = 300000) {
  const metrics = queryPerformanceMonitor.getAggregatedMetrics(timeWindowMs);
  return performanceMetricsAggregator.calculateSystemHealth(metrics);
}

/**
 * Get recent performance alerts
 */
export function getPerformanceAlerts(timeWindowMs: number = 3600000) {
  return queryPerformanceMonitor.getAlerts(timeWindowMs);
}

/**
 * Subscribe to performance alerts
 */
export function subscribeToPerformanceAlerts(
  callback: (alert: PerformanceAlert) => void
) {
  return queryPerformanceMonitor.onAlert(callback);
}

/**
 * Update performance monitoring thresholds
 */
export function updatePerformanceThresholds(thresholds: Partial<{
  maxQueryTime: number;
  minCacheHitRate: number;
  maxErrorRate: number;
  maxCircuitBreakerActivations: number;
  maxAuthenticationDelay: number;
  performanceDegradationThreshold: number;
}>) {
  queryPerformanceMonitor.updateThresholds(thresholds);
}

/**
 * Clear all performance monitoring data (useful for testing)
 */
export function clearPerformanceData() {
  queryPerformanceMonitor.clear();
}

/**
 * Performance monitoring utilities for development
 */
export const performanceMonitoringUtils = {
  monitor: queryPerformanceMonitor,
  aggregator: performanceMetricsAggregator,
  getCurrentMetrics: getCurrentPerformanceMetrics,
  getSystemHealth,
  getAlerts: getPerformanceAlerts,
  subscribe: subscribeToPerformanceAlerts,
  updateThresholds: updatePerformanceThresholds,
  clear: clearPerformanceData
};

// Export the main components for direct use
export { queryPerformanceMonitor, performanceMetricsAggregator };