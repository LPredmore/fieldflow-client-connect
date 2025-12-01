/**
 * Query Performance Monitor
 * 
 * Comprehensive real-time performance monitoring system for database queries.
 * Tracks metrics, analyzes trends, and provides automated alerting for performance degradation.
 */

import { enhancedQueryCache } from './enhancedQueryCache';
import { deduplicationManager } from './deduplicationManager';
import { smartSupabaseCircuitBreaker } from './smartCircuitBreakerInstance';

export interface QueryPerformanceMetrics {
  /** Unique identifier for the query execution */
  queryId: string;
  /** Database table being queried */
  table: string;
  /** Query start timestamp */
  startTime: number;
  /** Query end timestamp */
  endTime?: number;
  /** Total query duration in milliseconds */
  duration?: number;
  /** Whether the result came from cache */
  cacheHit: boolean;
  /** Age of cached data in milliseconds */
  cacheAge?: number;
  /** Whether request was deduplicated */
  deduplicationSaved: boolean;
  /** Circuit breaker state during query */
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  /** Authentication delay in milliseconds */
  authenticationDelay?: number;
  /** Network time in milliseconds */
  networkTime?: number;
  /** Processing time in milliseconds */
  processingTime?: number;
  /** Number of results returned */
  resultCount?: number;
  /** Error type if query failed */
  errorType?: string;
  /** Number of retry attempts */
  retryCount: number;
  /** Query priority level */
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  /** User ID who initiated the query */
  userId?: string;
  /** Additional context about the query */
  context?: Record<string, unknown>;
}

export interface AggregatedMetrics {
  /** Average query response time in milliseconds */
  averageQueryTime: number;
  /** Cache hit rate as percentage (0-100) */
  cacheHitRate: number;
  /** Percentage of requests saved by deduplication */
  deduplicationSavings: number;
  /** Number of circuit breaker activations */
  circuitBreakerActivations: number;
  /** Average authentication delay in milliseconds */
  authenticationDelays: number;
  /** Number of queries exceeding 2 second threshold */
  slowQueryCount: number;
  /** Error rate as percentage (0-100) */
  errorRate: number;
  /** Performance trend indicator */
  performanceTrend: 'improving' | 'stable' | 'degrading';
  /** Total number of queries tracked */
  totalQueries: number;
  /** Metrics by table */
  tableMetrics: Record<string, TablePerformanceMetrics>;
  /** Time window for these metrics */
  timeWindow: {
    start: number;
    end: number;
    durationMs: number;
  };
}

export interface TablePerformanceMetrics {
  /** Table name */
  table: string;
  /** Average query time for this table */
  averageTime: number;
  /** Cache hit rate for this table */
  cacheHitRate: number;
  /** Number of queries to this table */
  queryCount: number;
  /** Error rate for this table */
  errorRate: number;
  /** Slowest query time */
  maxTime: number;
  /** Fastest query time */
  minTime: number;
}

export interface PerformanceAlert {
  /** Alert severity level */
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** Alert type */
  type: 'SLOW_QUERY' | 'HIGH_ERROR_RATE' | 'LOW_CACHE_HIT_RATE' | 'CIRCUIT_BREAKER_ACTIVE' | 'PERFORMANCE_DEGRADATION';
  /** Human-readable alert message */
  message: string;
  /** Timestamp when alert was triggered */
  timestamp: number;
  /** Affected table or component */
  target?: string;
  /** Current metric value that triggered alert */
  currentValue: number;
  /** Threshold that was exceeded */
  threshold: number;
  /** Suggested actions to resolve the issue */
  suggestions: string[];
  /** Additional context data */
  context?: Record<string, unknown>;
}

export interface PerformanceThresholds {
  /** Maximum acceptable query time in milliseconds */
  maxQueryTime: number;
  /** Minimum acceptable cache hit rate (0-100) */
  minCacheHitRate: number;
  /** Maximum acceptable error rate (0-100) */
  maxErrorRate: number;
  /** Maximum circuit breaker activations per minute */
  maxCircuitBreakerActivations: number;
  /** Maximum authentication delay in milliseconds */
  maxAuthenticationDelay: number;
  /** Performance degradation threshold (percentage change) */
  performanceDegradationThreshold: number;
}

export class QueryPerformanceMonitor {
  private metrics: QueryPerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private activeQueries = new Map<string, QueryPerformanceMetrics>();
  private performanceHistory: AggregatedMetrics[] = [];
  private alertCallbacks: ((alert: PerformanceAlert) => void)[] = [];
  
  private thresholds: PerformanceThresholds = {
    maxQueryTime: 2000,
    minCacheHitRate: 70,
    maxErrorRate: 1,
    maxCircuitBreakerActivations: 5,
    maxAuthenticationDelay: 500,
    performanceDegradationThreshold: 20
  };

  private readonly MAX_METRICS_HISTORY = 10000;
  private readonly MAX_ALERTS_HISTORY = 1000;
  private readonly AGGREGATION_INTERVAL = 60000; // 1 minute
  private aggregationTimer?: NodeJS.Timeout;

  constructor() {
    this.startAggregationTimer();
  }

  /**
   * Start tracking a new query execution
   */
  startQuery(queryId: string, table: string, priority: QueryPerformanceMetrics['priority'], context?: Record<string, unknown>): void {
    const metric: QueryPerformanceMetrics = {
      queryId,
      table,
      startTime: Date.now(),
      cacheHit: false,
      deduplicationSaved: false,
      circuitBreakerState: smartSupabaseCircuitBreaker.getState().state as QueryPerformanceMetrics['circuitBreakerState'],
      retryCount: 0,
      priority,
      context
    };

    this.activeQueries.set(queryId, metric);
  }

  /**
   * Complete query tracking with results
   */
  endQuery(
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
  ): void {
    const metric = this.activeQueries.get(queryId);
    if (!metric) return;

    const endTime = Date.now();
    const duration = endTime - metric.startTime;

    // Update metric with completion data
    Object.assign(metric, {
      endTime,
      duration,
      ...options
    });

    // Move from active to completed metrics
    this.activeQueries.delete(queryId);
    this.addMetric(metric);

    // Check for immediate alerts
    this.checkForAlerts(metric);
  }

  /**
   * Add a completed metric to the history
   */
  private addMetric(metric: QueryPerformanceMetrics): void {
    this.metrics.push(metric);

    // Maintain maximum history size
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_HISTORY);
    }
  }

  /**
   * Get current aggregated metrics
   */
  getAggregatedMetrics(timeWindowMs: number = 300000): AggregatedMetrics {
    const now = Date.now();
    const windowStart = now - timeWindowMs;
    const windowMetrics = this.metrics.filter(m => m.startTime >= windowStart);

    if (windowMetrics.length === 0) {
      return this.getEmptyAggregatedMetrics(windowStart, now);
    }

    // Calculate basic metrics
    const totalQueries = windowMetrics.length;
    const cacheHits = windowMetrics.filter(m => m.cacheHit).length;
    const deduplicationSaved = windowMetrics.filter(m => m.deduplicationSaved).length;
    const errors = windowMetrics.filter(m => m.errorType).length;
    const slowQueries = windowMetrics.filter(m => m.duration && m.duration > this.thresholds.maxQueryTime).length;

    const durations = windowMetrics.filter(m => m.duration).map(m => m.duration!);
    const averageQueryTime = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const authDelays = windowMetrics.filter(m => m.authenticationDelay).map(m => m.authenticationDelay!);
    const authenticationDelays = authDelays.length > 0 ? authDelays.reduce((a, b) => a + b, 0) / authDelays.length : 0;

    // Calculate circuit breaker activations
    const circuitBreakerActivations = windowMetrics.filter(m => m.circuitBreakerState === 'OPEN').length;

    // Calculate table-specific metrics
    const tableMetrics = this.calculateTableMetrics(windowMetrics);

    // Determine performance trend
    const performanceTrend = this.calculatePerformanceTrend();

    return {
      averageQueryTime,
      cacheHitRate: totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0,
      deduplicationSavings: totalQueries > 0 ? (deduplicationSaved / totalQueries) * 100 : 0,
      circuitBreakerActivations,
      authenticationDelays,
      slowQueryCount: slowQueries,
      errorRate: totalQueries > 0 ? (errors / totalQueries) * 100 : 0,
      performanceTrend,
      totalQueries,
      tableMetrics,
      timeWindow: {
        start: windowStart,
        end: now,
        durationMs: timeWindowMs
      }
    };
  }

  /**
   * Calculate performance metrics by table
   */
  private calculateTableMetrics(metrics: QueryPerformanceMetrics[]): Record<string, TablePerformanceMetrics> {
    const tableGroups = new Map<string, QueryPerformanceMetrics[]>();
    
    // Group metrics by table
    metrics.forEach(metric => {
      const existing = tableGroups.get(metric.table) || [];
      existing.push(metric);
      tableGroups.set(metric.table, existing);
    });

    const result: Record<string, TablePerformanceMetrics> = {};

    tableGroups.forEach((tableMetrics, table) => {
      const durations = tableMetrics.filter(m => m.duration).map(m => m.duration!);
      const cacheHits = tableMetrics.filter(m => m.cacheHit).length;
      const errors = tableMetrics.filter(m => m.errorType).length;

      result[table] = {
        table,
        averageTime: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        cacheHitRate: tableMetrics.length > 0 ? (cacheHits / tableMetrics.length) * 100 : 0,
        queryCount: tableMetrics.length,
        errorRate: tableMetrics.length > 0 ? (errors / tableMetrics.length) * 100 : 0,
        maxTime: durations.length > 0 ? Math.max(...durations) : 0,
        minTime: durations.length > 0 ? Math.min(...durations) : 0
      };
    });

    return result;
  }

  /**
   * Calculate performance trend based on recent history
   */
  private calculatePerformanceTrend(): 'improving' | 'stable' | 'degrading' {
    if (this.performanceHistory.length < 2) return 'stable';

    const recent = this.performanceHistory.slice(-3);
    const older = this.performanceHistory.slice(-6, -3);

    if (recent.length === 0 || older.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, m) => sum + m.averageQueryTime, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.averageQueryTime, 0) / older.length;

    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (changePercent > this.thresholds.performanceDegradationThreshold) {
      return 'degrading';
    } else if (changePercent < -this.thresholds.performanceDegradationThreshold) {
      return 'improving';
    } else {
      return 'stable';
    }
  }

  /**
   * Check for performance alerts based on a completed query
   */
  private checkForAlerts(metric: QueryPerformanceMetrics): void {
    const alerts: PerformanceAlert[] = [];

    // Check for slow query
    if (metric.duration && metric.duration > this.thresholds.maxQueryTime) {
      alerts.push({
        severity: metric.duration > this.thresholds.maxQueryTime * 2 ? 'HIGH' : 'MEDIUM',
        type: 'SLOW_QUERY',
        message: `Query to ${metric.table} took ${metric.duration}ms (threshold: ${this.thresholds.maxQueryTime}ms)`,
        timestamp: Date.now(),
        target: metric.table,
        currentValue: metric.duration,
        threshold: this.thresholds.maxQueryTime,
        suggestions: [
          'Check database indexes for the queried table',
          'Consider increasing cache staleTime',
          'Review query complexity and filters',
          'Monitor database server performance'
        ],
        context: { queryId: metric.queryId, priority: metric.priority }
      });
    }

    // Check for circuit breaker activation
    if (metric.circuitBreakerState === 'OPEN') {
      alerts.push({
        severity: 'HIGH',
        type: 'CIRCUIT_BREAKER_ACTIVE',
        message: `Circuit breaker is OPEN during query to ${metric.table}`,
        timestamp: Date.now(),
        target: metric.table,
        currentValue: 1,
        threshold: 0,
        suggestions: [
          'Check database connectivity',
          'Review recent error patterns',
          'Consider increasing circuit breaker thresholds',
          'Monitor system resources'
        ],
        context: { queryId: metric.queryId }
      });
    }

    // Add alerts and notify callbacks
    alerts.forEach(alert => {
      this.addAlert(alert);
      this.notifyAlertCallbacks(alert);
    });
  }

  /**
   * Check aggregated metrics for performance issues
   */
  private checkAggregatedAlerts(metrics: AggregatedMetrics): void {
    const alerts: PerformanceAlert[] = [];

    // Check cache hit rate
    if (metrics.cacheHitRate < this.thresholds.minCacheHitRate) {
      alerts.push({
        severity: metrics.cacheHitRate < this.thresholds.minCacheHitRate / 2 ? 'HIGH' : 'MEDIUM',
        type: 'LOW_CACHE_HIT_RATE',
        message: `Cache hit rate is ${metrics.cacheHitRate.toFixed(1)}% (threshold: ${this.thresholds.minCacheHitRate}%)`,
        timestamp: Date.now(),
        currentValue: metrics.cacheHitRate,
        threshold: this.thresholds.minCacheHitRate,
        suggestions: [
          'Increase staleTime for frequently accessed tables',
          'Review cache eviction policies',
          'Check for excessive cache invalidation',
          'Consider increasing cache size limits'
        ]
      });
    }

    // Check error rate
    if (metrics.errorRate > this.thresholds.maxErrorRate) {
      alerts.push({
        severity: metrics.errorRate > this.thresholds.maxErrorRate * 5 ? 'CRITICAL' : 'HIGH',
        type: 'HIGH_ERROR_RATE',
        message: `Error rate is ${metrics.errorRate.toFixed(1)}% (threshold: ${this.thresholds.maxErrorRate}%)`,
        timestamp: Date.now(),
        currentValue: metrics.errorRate,
        threshold: this.thresholds.maxErrorRate,
        suggestions: [
          'Review recent error logs',
          'Check database connectivity',
          'Verify authentication and permissions',
          'Monitor system resources'
        ]
      });
    }

    // Check performance degradation
    if (metrics.performanceTrend === 'degrading') {
      alerts.push({
        severity: 'MEDIUM',
        type: 'PERFORMANCE_DEGRADATION',
        message: `Performance is degrading - average query time: ${metrics.averageQueryTime.toFixed(0)}ms`,
        timestamp: Date.now(),
        currentValue: metrics.averageQueryTime,
        threshold: this.thresholds.maxQueryTime,
        suggestions: [
          'Review recent changes to queries or database',
          'Check system resource usage',
          'Consider optimizing slow queries',
          'Monitor database performance metrics'
        ]
      });
    }

    // Add alerts and notify callbacks
    alerts.forEach(alert => {
      this.addAlert(alert);
      this.notifyAlertCallbacks(alert);
    });
  }

  /**
   * Add an alert to the history
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);

    // Maintain maximum alert history
    if (this.alerts.length > this.MAX_ALERTS_HISTORY) {
      this.alerts = this.alerts.slice(-this.MAX_ALERTS_HISTORY);
    }
  }

  /**
   * Notify all registered alert callbacks
   */
  private notifyAlertCallbacks(alert: PerformanceAlert): void {
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    });
  }

  /**
   * Register a callback for performance alerts
   */
  onAlert(callback: (alert: PerformanceAlert) => void): () => void {
    this.alertCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index > -1) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get recent alerts
   */
  getAlerts(timeWindowMs: number = 3600000): PerformanceAlert[] {
    const cutoff = Date.now() - timeWindowMs;
    return this.alerts.filter(alert => alert.timestamp >= cutoff);
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  /**
   * Get current performance thresholds
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Start the aggregation timer for periodic metric calculation
   */
  private startAggregationTimer(): void {
    this.aggregationTimer = setInterval(() => {
      const aggregated = this.getAggregatedMetrics();
      this.performanceHistory.push(aggregated);

      // Maintain history size
      if (this.performanceHistory.length > 100) {
        this.performanceHistory = this.performanceHistory.slice(-100);
      }

      // Check for aggregated alerts
      this.checkAggregatedAlerts(aggregated);
    }, this.AGGREGATION_INTERVAL);
  }

  /**
   * Stop the aggregation timer
   */
  private stopAggregationTimer(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = undefined;
    }
  }

  /**
   * Get empty aggregated metrics for when no data is available
   */
  private getEmptyAggregatedMetrics(start: number, end: number): AggregatedMetrics {
    return {
      averageQueryTime: 0,
      cacheHitRate: 0,
      deduplicationSavings: 0,
      circuitBreakerActivations: 0,
      authenticationDelays: 0,
      slowQueryCount: 0,
      errorRate: 0,
      performanceTrend: 'stable',
      totalQueries: 0,
      tableMetrics: {},
      timeWindow: {
        start,
        end,
        durationMs: end - start
      }
    };
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(): AggregatedMetrics[] {
    return [...this.performanceHistory];
  }

  /**
   * Clear all metrics and alerts (useful for testing)
   */
  clear(): void {
    this.metrics = [];
    this.alerts = [];
    this.activeQueries.clear();
    this.performanceHistory = [];
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAggregationTimer();
    this.clear();
    this.alertCallbacks = [];
  }
}

// Export singleton instance
export const queryPerformanceMonitor = new QueryPerformanceMonitor();