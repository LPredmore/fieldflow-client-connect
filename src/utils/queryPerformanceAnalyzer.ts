/**
 * Query Performance Analyzer
 * 
 * Provides utilities for analyzing query performance patterns,
 * identifying bottlenecks, and generating optimization recommendations.
 */

import { QueryLogEntry, QueryMetrics } from './queryLogger';

export interface PerformanceAnalysis {
  summary: {
    totalQueries: number;
    averageResponseTime: number;
    slowQueryCount: number;
    errorRate: number;
    cacheEfficiency: number;
  };
  bottlenecks: {
    slowestTables: Array<{ table: string; avgDuration: number; queryCount: number }>;
    mostErrorProneTables: Array<{ table: string; errorRate: number; totalQueries: number }>;
    complexQueries: QueryLogEntry[];
    cacheMisses: Array<{ table: string; missRate: number; totalQueries: number }>;
  };
  recommendations: string[];
  trends: {
    performanceOverTime: Array<{ timestamp: Date; avgDuration: number }>;
    errorRateOverTime: Array<{ timestamp: Date; errorRate: number }>;
  };
}

export interface QueryOptimizationSuggestion {
  queryId: string;
  table: string;
  issue: 'slow_query' | 'complex_select' | 'many_filters' | 'no_cache' | 'frequent_errors';
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
  estimatedImpact: 'low' | 'medium' | 'high';
}

class QueryPerformanceAnalyzer {
  private slowQueryThreshold = 2000; // 2 seconds
  private complexSelectThreshold = 5; // 5+ joins or nested selects
  private highErrorRateThreshold = 0.1; // 10%

  /**
   * Analyze query performance from logs
   */
  analyzePerformance(logs: QueryLogEntry[]): PerformanceAnalysis {
    if (logs.length === 0) {
      return this.getEmptyAnalysis();
    }

    const summary = this.calculateSummary(logs);
    const bottlenecks = this.identifyBottlenecks(logs);
    const recommendations = this.generateRecommendations(logs, bottlenecks);
    const trends = this.analyzeTrends(logs);

    return {
      summary,
      bottlenecks,
      recommendations,
      trends
    };
  }

  /**
   * Generate optimization suggestions for specific queries
   */
  generateOptimizationSuggestions(logs: QueryLogEntry[]): QueryOptimizationSuggestion[] {
    const suggestions: QueryOptimizationSuggestion[] = [];

    logs.forEach(log => {
      // Check for slow queries
      if (log.duration && log.duration > this.slowQueryThreshold) {
        suggestions.push({
          queryId: log.id,
          table: log.table,
          issue: 'slow_query',
          severity: log.duration > this.slowQueryThreshold * 2 ? 'high' : 'medium',
          suggestion: `Query took ${log.duration}ms. Consider adding indexes, optimizing joins, or reducing selected columns.`,
          estimatedImpact: log.duration > this.slowQueryThreshold * 3 ? 'high' : 'medium'
        });
      }

      // Check for complex selects
      const joinCount = (log.select.match(/!/g) || []).length;
      const nestedSelectCount = (log.select.match(/\(/g) || []).length;
      if (joinCount > 3 || nestedSelectCount > 2) {
        suggestions.push({
          queryId: log.id,
          table: log.table,
          issue: 'complex_select',
          severity: 'medium',
          suggestion: `Complex query with ${joinCount} joins and ${nestedSelectCount} nested selects. Consider breaking into multiple simpler queries.`,
          estimatedImpact: 'medium'
        });
      }

      // Check for many filters
      const filterCount = Object.keys(log.filters).length;
      if (filterCount > 5) {
        suggestions.push({
          queryId: log.id,
          table: log.table,
          issue: 'many_filters',
          severity: 'low',
          suggestion: `Query has ${filterCount} filters. Ensure proper indexing on filtered columns.`,
          estimatedImpact: 'low'
        });
      }

      // Check for cache misses on repeated queries
      if (!log.cacheHit && log.queryComplexity !== 'simple') {
        suggestions.push({
          queryId: log.id,
          table: log.table,
          issue: 'no_cache',
          severity: 'low',
          suggestion: 'Query not served from cache. Consider increasing cache duration for stable data.',
          estimatedImpact: 'low'
        });
      }

      // Check for frequent errors
      if (!log.success && log.error) {
        suggestions.push({
          queryId: log.id,
          table: log.table,
          issue: 'frequent_errors',
          severity: log.error.type === 'schema_mismatch' ? 'high' : 'medium',
          suggestion: `Query failed with ${log.error.type}: ${log.error.message}. Requires immediate attention.`,
          estimatedImpact: 'high'
        });
      }
    });

    // Sort by severity and estimated impact
    return suggestions.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      const impactOrder = { high: 3, medium: 2, low: 1 };
      
      const aScore = severityOrder[a.severity] + impactOrder[a.estimatedImpact];
      const bScore = severityOrder[b.severity] + impactOrder[b.estimatedImpact];
      
      return bScore - aScore;
    });
  }

  /**
   * Analyze query patterns to identify optimization opportunities
   */
  analyzeQueryPatterns(logs: QueryLogEntry[]): {
    duplicateQueries: Array<{ pattern: string; count: number; avgDuration: number }>;
    tableUsageStats: Array<{ table: string; queryCount: number; avgDuration: number; errorRate: number }>;
    timeBasedPatterns: Array<{ hour: number; queryCount: number; avgDuration: number }>;
  } {
    // Group duplicate queries
    const queryPatterns = new Map<string, QueryLogEntry[]>();
    logs.forEach(log => {
      const pattern = `${log.table}:${log.select}:${JSON.stringify(log.filters)}`;
      if (!queryPatterns.has(pattern)) {
        queryPatterns.set(pattern, []);
      }
      queryPatterns.get(pattern)!.push(log);
    });

    const duplicateQueries = Array.from(queryPatterns.entries())
      .filter(([_, queries]) => queries.length > 1)
      .map(([pattern, queries]) => ({
        pattern,
        count: queries.length,
        avgDuration: queries.reduce((sum, q) => sum + (q.duration || 0), 0) / queries.length
      }))
      .sort((a, b) => b.count - a.count);

    // Table usage statistics
    const tableStats = new Map<string, { queries: QueryLogEntry[]; errors: number }>();
    logs.forEach(log => {
      if (!tableStats.has(log.table)) {
        tableStats.set(log.table, { queries: [], errors: 0 });
      }
      const stats = tableStats.get(log.table)!;
      stats.queries.push(log);
      if (!log.success) stats.errors++;
    });

    const tableUsageStats = Array.from(tableStats.entries())
      .map(([table, stats]) => ({
        table,
        queryCount: stats.queries.length,
        avgDuration: stats.queries.reduce((sum, q) => sum + (q.duration || 0), 0) / stats.queries.length,
        errorRate: stats.errors / stats.queries.length
      }))
      .sort((a, b) => b.queryCount - a.queryCount);

    // Time-based patterns
    const hourlyStats = new Map<number, { queries: QueryLogEntry[]; totalDuration: number }>();
    logs.forEach(log => {
      const hour = log.timestamp.getHours();
      if (!hourlyStats.has(hour)) {
        hourlyStats.set(hour, { queries: [], totalDuration: 0 });
      }
      const stats = hourlyStats.get(hour)!;
      stats.queries.push(log);
      stats.totalDuration += log.duration || 0;
    });

    const timeBasedPatterns = Array.from(hourlyStats.entries())
      .map(([hour, stats]) => ({
        hour,
        queryCount: stats.queries.length,
        avgDuration: stats.totalDuration / stats.queries.length
      }))
      .sort((a, b) => a.hour - b.hour);

    return {
      duplicateQueries,
      tableUsageStats,
      timeBasedPatterns
    };
  }

  private calculateSummary(logs: QueryLogEntry[]) {
    const totalQueries = logs.length;
    const successfulQueries = logs.filter(log => log.success).length;
    const completedQueries = logs.filter(log => log.duration !== undefined);
    const slowQueries = logs.filter(log => log.duration && log.duration > this.slowQueryThreshold);
    const cacheHits = logs.filter(log => log.cacheHit).length;

    return {
      totalQueries,
      averageResponseTime: completedQueries.length > 0
        ? Math.round(completedQueries.reduce((sum, log) => sum + (log.duration || 0), 0) / completedQueries.length)
        : 0,
      slowQueryCount: slowQueries.length,
      errorRate: totalQueries > 0 ? (totalQueries - successfulQueries) / totalQueries : 0,
      cacheEfficiency: totalQueries > 0 ? cacheHits / totalQueries : 0
    };
  }

  private identifyBottlenecks(logs: QueryLogEntry[]) {
    // Slowest tables
    const tablePerformance = new Map<string, { durations: number[]; count: number }>();
    logs.forEach(log => {
      if (log.duration) {
        if (!tablePerformance.has(log.table)) {
          tablePerformance.set(log.table, { durations: [], count: 0 });
        }
        const perf = tablePerformance.get(log.table)!;
        perf.durations.push(log.duration);
        perf.count++;
      }
    });

    const slowestTables = Array.from(tablePerformance.entries())
      .map(([table, perf]) => ({
        table,
        avgDuration: Math.round(perf.durations.reduce((sum, d) => sum + d, 0) / perf.durations.length),
        queryCount: perf.count
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5);

    // Most error-prone tables
    const tableErrors = new Map<string, { total: number; errors: number }>();
    logs.forEach(log => {
      if (!tableErrors.has(log.table)) {
        tableErrors.set(log.table, { total: 0, errors: 0 });
      }
      const errors = tableErrors.get(log.table)!;
      errors.total++;
      if (!log.success) errors.errors++;
    });

    const mostErrorProneTables = Array.from(tableErrors.entries())
      .map(([table, stats]) => ({
        table,
        errorRate: stats.errors / stats.total,
        totalQueries: stats.total
      }))
      .filter(item => item.errorRate > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5);

    // Complex queries
    const complexQueries = logs
      .filter(log => log.queryComplexity === 'complex' || (log.duration && log.duration > this.slowQueryThreshold))
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);

    // Cache misses by table
    const tableCacheStats = new Map<string, { total: number; hits: number }>();
    logs.forEach(log => {
      if (!tableCacheStats.has(log.table)) {
        tableCacheStats.set(log.table, { total: 0, hits: 0 });
      }
      const stats = tableCacheStats.get(log.table)!;
      stats.total++;
      if (log.cacheHit) stats.hits++;
    });

    const cacheMisses = Array.from(tableCacheStats.entries())
      .map(([table, stats]) => ({
        table,
        missRate: 1 - (stats.hits / stats.total),
        totalQueries: stats.total
      }))
      .filter(item => item.missRate > 0.5 && item.totalQueries > 5)
      .sort((a, b) => b.missRate - a.missRate)
      .slice(0, 5);

    return {
      slowestTables,
      mostErrorProneTables,
      complexQueries,
      cacheMisses
    };
  }

  private generateRecommendations(logs: QueryLogEntry[], bottlenecks: any): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (bottlenecks.slowestTables.length > 0) {
      const slowest = bottlenecks.slowestTables[0];
      recommendations.push(
        `Consider optimizing queries for table '${slowest.table}' - average response time is ${slowest.avgDuration}ms`
      );
    }

    // Error recommendations
    if (bottlenecks.mostErrorProneTables.length > 0) {
      const errorProne = bottlenecks.mostErrorProneTables[0];
      recommendations.push(
        `Table '${errorProne.table}' has a ${Math.round(errorProne.errorRate * 100)}% error rate - investigate schema or permission issues`
      );
    }

    // Cache recommendations
    if (bottlenecks.cacheMisses.length > 0) {
      const lowCache = bottlenecks.cacheMisses[0];
      recommendations.push(
        `Table '${lowCache.table}' has a ${Math.round(lowCache.missRate * 100)}% cache miss rate - consider increasing cache duration`
      );
    }

    // Complex query recommendations
    if (bottlenecks.complexQueries.length > 0) {
      recommendations.push(
        `${bottlenecks.complexQueries.length} complex queries detected - consider breaking them into simpler operations`
      );
    }

    // General recommendations based on overall stats
    const summary = this.calculateSummary(logs);
    if (summary.errorRate > 0.05) {
      recommendations.push(
        `High error rate detected (${Math.round(summary.errorRate * 100)}%) - review query structure and database schema`
      );
    }

    if (summary.cacheEfficiency < 0.3) {
      recommendations.push(
        `Low cache efficiency (${Math.round(summary.cacheEfficiency * 100)}%) - review caching strategy and stale time settings`
      );
    }

    return recommendations;
  }

  private analyzeTrends(logs: QueryLogEntry[]) {
    // Group by time intervals (e.g., every 5 minutes)
    const intervalMs = 5 * 60 * 1000; // 5 minutes
    const intervals = new Map<number, { durations: number[]; total: number; errors: number }>();

    logs.forEach(log => {
      const intervalStart = Math.floor(log.timestamp.getTime() / intervalMs) * intervalMs;
      if (!intervals.has(intervalStart)) {
        intervals.set(intervalStart, { durations: [], total: 0, errors: 0 });
      }
      const interval = intervals.get(intervalStart)!;
      interval.total++;
      if (log.duration) interval.durations.push(log.duration);
      if (!log.success) interval.errors++;
    });

    const performanceOverTime = Array.from(intervals.entries())
      .map(([timestamp, data]) => ({
        timestamp: new Date(timestamp),
        avgDuration: data.durations.length > 0
          ? Math.round(data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length)
          : 0
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const errorRateOverTime = Array.from(intervals.entries())
      .map(([timestamp, data]) => ({
        timestamp: new Date(timestamp),
        errorRate: data.total > 0 ? data.errors / data.total : 0
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      performanceOverTime,
      errorRateOverTime
    };
  }

  private getEmptyAnalysis(): PerformanceAnalysis {
    return {
      summary: {
        totalQueries: 0,
        averageResponseTime: 0,
        slowQueryCount: 0,
        errorRate: 0,
        cacheEfficiency: 0
      },
      bottlenecks: {
        slowestTables: [],
        mostErrorProneTables: [],
        complexQueries: [],
        cacheMisses: []
      },
      recommendations: ['No query data available for analysis'],
      trends: {
        performanceOverTime: [],
        errorRateOverTime: []
      }
    };
  }
}

// Export singleton instance
export const queryPerformanceAnalyzer = new QueryPerformanceAnalyzer();