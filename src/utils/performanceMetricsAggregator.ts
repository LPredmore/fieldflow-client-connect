/**
 * Performance Metrics Aggregator
 * 
 * Advanced metrics aggregation service that processes raw performance data
 * and provides statistical analysis, trend detection, and comparative metrics.
 */

import { QueryPerformanceMetrics, AggregatedMetrics, TablePerformanceMetrics } from './queryPerformanceMonitor';
import { enhancedQueryCache } from './enhancedQueryCache';
import { deduplicationManager } from './deduplicationManager';

export interface MetricsTimeWindow {
  /** Start timestamp of the window */
  start: number;
  /** End timestamp of the window */
  end: number;
  /** Duration in milliseconds */
  duration: number;
  /** Human-readable label */
  label: string;
}

export interface PerformanceComparison {
  /** Current period metrics */
  current: AggregatedMetrics;
  /** Previous period metrics for comparison */
  previous: AggregatedMetrics;
  /** Percentage changes between periods */
  changes: {
    averageQueryTime: number;
    cacheHitRate: number;
    errorRate: number;
    totalQueries: number;
  };
  /** Statistical significance of changes */
  significance: {
    averageQueryTime: 'significant' | 'minor' | 'negligible';
    cacheHitRate: 'significant' | 'minor' | 'negligible';
    errorRate: 'significant' | 'minor' | 'negligible';
  };
}

export interface PerformancePercentiles {
  /** 50th percentile (median) */
  p50: number;
  /** 75th percentile */
  p75: number;
  /** 90th percentile */
  p90: number;
  /** 95th percentile */
  p95: number;
  /** 99th percentile */
  p99: number;
}

export interface DetailedTableMetrics extends TablePerformanceMetrics {
  /** Query time percentiles */
  percentiles: PerformancePercentiles;
  /** Cache effectiveness score (0-100) */
  cacheEffectiveness: number;
  /** Query frequency (queries per minute) */
  queryFrequency: number;
  /** Error patterns */
  errorPatterns: Record<string, number>;
  /** Performance trend over time */
  trend: {
    direction: 'improving' | 'stable' | 'degrading';
    confidence: number;
    changeRate: number;
  };
}

export interface SystemHealthMetrics {
  /** Overall system health score (0-100) */
  healthScore: number;
  /** Component health breakdown */
  components: {
    cache: {
      score: number;
      status: 'healthy' | 'warning' | 'critical';
      issues: string[];
    };
    queries: {
      score: number;
      status: 'healthy' | 'warning' | 'critical';
      issues: string[];
    };
    circuitBreaker: {
      score: number;
      status: 'healthy' | 'warning' | 'critical';
      issues: string[];
    };
    deduplication: {
      score: number;
      status: 'healthy' | 'warning' | 'critical';
      issues: string[];
    };
  };
  /** Recommendations for improvement */
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    action: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
  }[];
}

export class PerformanceMetricsAggregator {
  private readonly SIGNIFICANCE_THRESHOLD = 10; // 10% change considered significant
  private readonly MINOR_THRESHOLD = 5; // 5% change considered minor

  /**
   * Create predefined time windows for analysis
   */
  createTimeWindows(): Record<string, MetricsTimeWindow> {
    const now = Date.now();
    
    return {
      last5Minutes: {
        start: now - 5 * 60 * 1000,
        end: now,
        duration: 5 * 60 * 1000,
        label: 'Last 5 Minutes'
      },
      last15Minutes: {
        start: now - 15 * 60 * 1000,
        end: now,
        duration: 15 * 60 * 1000,
        label: 'Last 15 Minutes'
      },
      lastHour: {
        start: now - 60 * 60 * 1000,
        end: now,
        duration: 60 * 60 * 1000,
        label: 'Last Hour'
      },
      last6Hours: {
        start: now - 6 * 60 * 60 * 1000,
        end: now,
        duration: 6 * 60 * 60 * 1000,
        label: 'Last 6 Hours'
      },
      last24Hours: {
        start: now - 24 * 60 * 60 * 1000,
        end: now,
        duration: 24 * 60 * 60 * 1000,
        label: 'Last 24 Hours'
      }
    };
  }

  /**
   * Aggregate metrics for a specific time window
   */
  aggregateMetrics(metrics: QueryPerformanceMetrics[], timeWindow: MetricsTimeWindow): AggregatedMetrics {
    const windowMetrics = metrics.filter(m => 
      m.startTime >= timeWindow.start && m.startTime <= timeWindow.end
    );

    if (windowMetrics.length === 0) {
      return this.createEmptyMetrics(timeWindow);
    }

    // Basic calculations
    const totalQueries = windowMetrics.length;
    const cacheHits = windowMetrics.filter(m => m.cacheHit).length;
    const deduplicationSaved = windowMetrics.filter(m => m.deduplicationSaved).length;
    const errors = windowMetrics.filter(m => m.errorType).length;
    const slowQueries = windowMetrics.filter(m => m.duration && m.duration > 2000).length;
    const circuitBreakerActivations = windowMetrics.filter(m => m.circuitBreakerState === 'OPEN').length;

    // Duration calculations
    const durations = windowMetrics.filter(m => m.duration).map(m => m.duration!);
    const averageQueryTime = durations.length > 0 ? 
      durations.reduce((sum, duration) => sum + duration, 0) / durations.length : 0;

    // Authentication delay calculations
    const authDelays = windowMetrics.filter(m => m.authenticationDelay).map(m => m.authenticationDelay!);
    const authenticationDelays = authDelays.length > 0 ?
      authDelays.reduce((sum, delay) => sum + delay, 0) / authDelays.length : 0;

    // Table-specific metrics
    const tableMetrics = this.calculateDetailedTableMetrics(windowMetrics);

    // Performance trend calculation
    const performanceTrend = this.calculateTrendFromMetrics(windowMetrics);

    return {
      averageQueryTime,
      cacheHitRate: (cacheHits / totalQueries) * 100,
      deduplicationSavings: (deduplicationSaved / totalQueries) * 100,
      circuitBreakerActivations,
      authenticationDelays,
      slowQueryCount: slowQueries,
      errorRate: (errors / totalQueries) * 100,
      performanceTrend,
      totalQueries,
      tableMetrics: this.convertToBasicTableMetrics(tableMetrics),
      timeWindow: {
        start: timeWindow.start,
        end: timeWindow.end,
        durationMs: timeWindow.duration
      }
    };
  }

  /**
   * Calculate detailed table-specific metrics with advanced analytics
   */
  calculateDetailedTableMetrics(metrics: QueryPerformanceMetrics[]): Record<string, DetailedTableMetrics> {
    const tableGroups = new Map<string, QueryPerformanceMetrics[]>();
    
    // Group metrics by table
    metrics.forEach(metric => {
      const existing = tableGroups.get(metric.table) || [];
      existing.push(metric);
      tableGroups.set(metric.table, existing);
    });

    const result: Record<string, DetailedTableMetrics> = {};

    tableGroups.forEach((tableMetrics, table) => {
      const durations = tableMetrics.filter(m => m.duration).map(m => m.duration!);
      const cacheHits = tableMetrics.filter(m => m.cacheHit).length;
      const errors = tableMetrics.filter(m => m.errorType).length;
      
      // Calculate percentiles
      const percentiles = this.calculatePercentiles(durations);
      
      // Calculate cache effectiveness (considers both hit rate and performance impact)
      const cacheEffectiveness = this.calculateCacheEffectiveness(tableMetrics);
      
      // Calculate query frequency (queries per minute)
      const timeSpan = Math.max(...tableMetrics.map(m => m.startTime)) - Math.min(...tableMetrics.map(m => m.startTime));
      const queryFrequency = timeSpan > 0 ? (tableMetrics.length / (timeSpan / 60000)) : 0;
      
      // Analyze error patterns
      const errorPatterns: Record<string, number> = {};
      tableMetrics.forEach(m => {
        if (m.errorType) {
          errorPatterns[m.errorType] = (errorPatterns[m.errorType] || 0) + 1;
        }
      });
      
      // Calculate performance trend
      const trend = this.calculateTableTrend(tableMetrics);

      result[table] = {
        table,
        averageTime: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        cacheHitRate: tableMetrics.length > 0 ? (cacheHits / tableMetrics.length) * 100 : 0,
        queryCount: tableMetrics.length,
        errorRate: tableMetrics.length > 0 ? (errors / tableMetrics.length) * 100 : 0,
        maxTime: durations.length > 0 ? Math.max(...durations) : 0,
        minTime: durations.length > 0 ? Math.min(...durations) : 0,
        percentiles,
        cacheEffectiveness,
        queryFrequency,
        errorPatterns,
        trend
      };
    });

    return result;
  }

  /**
   * Calculate performance percentiles from duration array
   */
  calculatePercentiles(durations: number[]): PerformancePercentiles {
    if (durations.length === 0) {
      return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    return {
      p50: getPercentile(50),
      p75: getPercentile(75),
      p90: getPercentile(90),
      p95: getPercentile(95),
      p99: getPercentile(99)
    };
  }

  /**
   * Calculate cache effectiveness score
   */
  private calculateCacheEffectiveness(metrics: QueryPerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;

    const cacheHits = metrics.filter(m => m.cacheHit).length;
    const hitRate = (cacheHits / metrics.length) * 100;

    // Calculate performance improvement from cache
    const cachedDurations = metrics.filter(m => m.cacheHit && m.duration).map(m => m.duration!);
    const uncachedDurations = metrics.filter(m => !m.cacheHit && m.duration).map(m => m.duration!);

    let performanceImprovement = 0;
    if (cachedDurations.length > 0 && uncachedDurations.length > 0) {
      const avgCached = cachedDurations.reduce((a, b) => a + b, 0) / cachedDurations.length;
      const avgUncached = uncachedDurations.reduce((a, b) => a + b, 0) / uncachedDurations.length;
      performanceImprovement = Math.max(0, ((avgUncached - avgCached) / avgUncached) * 100);
    }

    // Combine hit rate and performance improvement (weighted)
    return (hitRate * 0.6) + (performanceImprovement * 0.4);
  }

  /**
   * Calculate performance trend for a specific table
   */
  private calculateTableTrend(metrics: QueryPerformanceMetrics[]): DetailedTableMetrics['trend'] {
    if (metrics.length < 5) {
      return { direction: 'stable', confidence: 0, changeRate: 0 };
    }

    // Sort by time and split into two halves
    const sorted = [...metrics].sort((a, b) => a.startTime - b.startTime);
    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);

    // Calculate average durations for each half
    const firstHalfDurations = firstHalf.filter(m => m.duration).map(m => m.duration!);
    const secondHalfDurations = secondHalf.filter(m => m.duration).map(m => m.duration!);

    if (firstHalfDurations.length === 0 || secondHalfDurations.length === 0) {
      return { direction: 'stable', confidence: 0, changeRate: 0 };
    }

    const firstAvg = firstHalfDurations.reduce((a, b) => a + b, 0) / firstHalfDurations.length;
    const secondAvg = secondHalfDurations.reduce((a, b) => a + b, 0) / secondHalfDurations.length;

    const changeRate = ((secondAvg - firstAvg) / firstAvg) * 100;
    const confidence = Math.min(100, Math.abs(changeRate) * 2); // Simple confidence calculation

    let direction: 'improving' | 'stable' | 'degrading' = 'stable';
    if (Math.abs(changeRate) > 10) {
      direction = changeRate > 0 ? 'degrading' : 'improving';
    }

    return { direction, confidence, changeRate };
  }

  /**
   * Compare performance between two time periods
   */
  comparePerformance(current: AggregatedMetrics, previous: AggregatedMetrics): PerformanceComparison {
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const getSignificance = (change: number): 'significant' | 'minor' | 'negligible' => {
      const absChange = Math.abs(change);
      if (absChange >= this.SIGNIFICANCE_THRESHOLD) return 'significant';
      if (absChange >= this.MINOR_THRESHOLD) return 'minor';
      return 'negligible';
    };

    const changes = {
      averageQueryTime: calculateChange(current.averageQueryTime, previous.averageQueryTime),
      cacheHitRate: calculateChange(current.cacheHitRate, previous.cacheHitRate),
      errorRate: calculateChange(current.errorRate, previous.errorRate),
      totalQueries: calculateChange(current.totalQueries, previous.totalQueries)
    };

    return {
      current,
      previous,
      changes,
      significance: {
        averageQueryTime: getSignificance(changes.averageQueryTime),
        cacheHitRate: getSignificance(changes.cacheHitRate),
        errorRate: getSignificance(changes.errorRate)
      }
    };
  }

  /**
   * Calculate overall system health metrics
   */
  calculateSystemHealth(metrics: AggregatedMetrics): SystemHealthMetrics {
    const recommendations: SystemHealthMetrics['recommendations'] = [];

    // Cache health assessment
    const cacheScore = Math.max(0, Math.min(100, metrics.cacheHitRate));
    const cacheStatus = cacheScore >= 70 ? 'healthy' : cacheScore >= 50 ? 'warning' : 'critical';
    const cacheIssues: string[] = [];
    
    if (cacheScore < 70) {
      cacheIssues.push(`Low cache hit rate: ${metrics.cacheHitRate.toFixed(1)}%`);
      recommendations.push({
        priority: 'high',
        action: 'Increase cache staleTime for frequently accessed tables',
        impact: 'Improve response times and reduce database load',
        effort: 'low'
      });
    }

    // Query performance health
    const queryScore = Math.max(0, Math.min(100, 100 - (metrics.averageQueryTime / 50))); // 5000ms = 0 score
    const queryStatus = queryScore >= 70 ? 'healthy' : queryScore >= 50 ? 'warning' : 'critical';
    const queryIssues: string[] = [];
    
    if (metrics.averageQueryTime > 2000) {
      queryIssues.push(`Slow average query time: ${metrics.averageQueryTime.toFixed(0)}ms`);
      recommendations.push({
        priority: 'high',
        action: 'Optimize slow queries and database indexes',
        impact: 'Significantly improve user experience',
        effort: 'medium'
      });
    }

    if (metrics.slowQueryCount > metrics.totalQueries * 0.1) {
      queryIssues.push(`High number of slow queries: ${metrics.slowQueryCount}`);
    }

    // Circuit breaker health
    const circuitBreakerScore = Math.max(0, 100 - (metrics.circuitBreakerActivations * 10));
    const circuitBreakerStatus = circuitBreakerScore >= 90 ? 'healthy' : circuitBreakerScore >= 70 ? 'warning' : 'critical';
    const circuitBreakerIssues: string[] = [];
    
    if (metrics.circuitBreakerActivations > 0) {
      circuitBreakerIssues.push(`Circuit breaker activations: ${metrics.circuitBreakerActivations}`);
      recommendations.push({
        priority: 'medium',
        action: 'Investigate and resolve underlying connectivity issues',
        impact: 'Prevent service disruptions',
        effort: 'medium'
      });
    }

    // Deduplication health
    const deduplicationScore = Math.min(100, metrics.deduplicationSavings * 2); // 50% savings = 100 score
    const deduplicationStatus = deduplicationScore >= 30 ? 'healthy' : deduplicationScore >= 15 ? 'warning' : 'critical';
    const deduplicationIssues: string[] = [];
    
    if (metrics.deduplicationSavings < 20) {
      deduplicationIssues.push(`Low deduplication savings: ${metrics.deduplicationSavings.toFixed(1)}%`);
      recommendations.push({
        priority: 'low',
        action: 'Review component query patterns for optimization opportunities',
        impact: 'Reduce redundant database requests',
        effort: 'low'
      });
    }

    // Calculate overall health score
    const healthScore = (cacheScore + queryScore + circuitBreakerScore + deduplicationScore) / 4;

    return {
      healthScore,
      components: {
        cache: { score: cacheScore, status: cacheStatus, issues: cacheIssues },
        queries: { score: queryScore, status: queryStatus, issues: queryIssues },
        circuitBreaker: { score: circuitBreakerScore, status: circuitBreakerStatus, issues: circuitBreakerIssues },
        deduplication: { score: deduplicationScore, status: deduplicationStatus, issues: deduplicationIssues }
      },
      recommendations
    };
  }

  /**
   * Convert detailed table metrics to basic format
   */
  private convertToBasicTableMetrics(detailed: Record<string, DetailedTableMetrics>): Record<string, TablePerformanceMetrics> {
    const result: Record<string, TablePerformanceMetrics> = {};
    
    Object.entries(detailed).forEach(([table, metrics]) => {
      result[table] = {
        table: metrics.table,
        averageTime: metrics.averageTime,
        cacheHitRate: metrics.cacheHitRate,
        queryCount: metrics.queryCount,
        errorRate: metrics.errorRate,
        maxTime: metrics.maxTime,
        minTime: metrics.minTime
      };
    });

    return result;
  }

  /**
   * Calculate trend from metrics array
   */
  private calculateTrendFromMetrics(metrics: QueryPerformanceMetrics[]): 'improving' | 'stable' | 'degrading' {
    if (metrics.length < 10) return 'stable';

    // Sort by time and calculate moving averages
    const sorted = [...metrics].sort((a, b) => a.startTime - b.startTime);
    const durations = sorted.filter(m => m.duration).map(m => m.duration!);
    
    if (durations.length < 10) return 'stable';

    // Compare first and last thirds
    const thirdSize = Math.floor(durations.length / 3);
    const firstThird = durations.slice(0, thirdSize);
    const lastThird = durations.slice(-thirdSize);

    const firstAvg = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
    const lastAvg = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;

    const changePercent = ((lastAvg - firstAvg) / firstAvg) * 100;

    if (changePercent > 15) return 'degrading';
    if (changePercent < -15) return 'improving';
    return 'stable';
  }

  /**
   * Create empty metrics for when no data is available
   */
  private createEmptyMetrics(timeWindow: MetricsTimeWindow): AggregatedMetrics {
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
        start: timeWindow.start,
        end: timeWindow.end,
        durationMs: timeWindow.duration
      }
    };
  }
}

// Export singleton instance
export const performanceMetricsAggregator = new PerformanceMetricsAggregator();