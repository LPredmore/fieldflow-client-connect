/**
 * Query Logger and Monitoring System
 * 
 * Provides comprehensive logging and monitoring for database queries including:
 * - Query structure logging
 * - Performance timing measurements
 * - Detailed error logging with context
 * - Query success/failure tracking
 * - Performance metrics collection
 */

export interface QueryLogEntry {
  id: string;
  timestamp: Date;
  table: string;
  select: string;
  filters: Record<string, any>;
  orderBy?: { column: string; ascending?: boolean };
  userId?: string;
  tenantId?: string;
  cacheKey: string;
  duration?: number;
  success: boolean;
  error?: {
    message: string;
    type: string;
    code?: string;
    details?: any;
  };
  cacheHit: boolean;
  cacheAge?: number;
  circuitBreakerOpen: boolean;
  retryCount?: number;
  resultCount?: number;
  queryComplexity: 'simple' | 'medium' | 'complex';
  performanceMetrics: {
    networkTime?: number;
    processingTime?: number;
    cacheTime?: number;
  };
}

export interface QueryMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageResponseTime: number;
  cacheHitRate: number;
  circuitBreakerActivations: number;
  errorsByType: Record<string, number>;
  slowQueries: QueryLogEntry[];
  recentErrors: QueryLogEntry[];
}

class QueryLogger {
  private logs: QueryLogEntry[] = [];
  private maxLogEntries = 1000; // Keep last 1000 entries
  private slowQueryThreshold = 2000; // 2 seconds
  private metricsWindow = 300000; // 5 minutes for metrics calculation

  /**
   * Generate a unique query ID for tracking
   */
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Determine query complexity based on structure
   */
  private assessQueryComplexity(
    table: string,
    select: string,
    filters: Record<string, any>,
    orderBy?: { column: string; ascending?: boolean }
  ): 'simple' | 'medium' | 'complex' {
    let complexity = 0;
    
    // Count select fields
    const selectFields = select.split(',').length;
    if (selectFields > 5) complexity += 1;
    if (selectFields > 10) complexity += 1;
    
    // Count filters
    const filterCount = Object.keys(filters).length;
    if (filterCount > 3) complexity += 1;
    if (filterCount > 6) complexity += 1;
    
    // Check for joins (indicated by ! in select)
    if (select.includes('!')) complexity += 2;
    
    // Check for nested selects
    if (select.includes('(') && select.includes(')')) complexity += 1;
    
    // Order by adds slight complexity
    if (orderBy) complexity += 0.5;
    
    if (complexity <= 1) return 'simple';
    if (complexity <= 3) return 'medium';
    return 'complex';
  }

  /**
   * Start logging a query
   */
  startQuery(
    table: string,
    select: string,
    filters: Record<string, any>,
    orderBy?: { column: string; ascending?: boolean },
    userId?: string,
    tenantId?: string,
    cacheKey?: string,
    cacheHit = false,
    cacheAge?: number,
    circuitBreakerOpen = false
  ): string {
    const queryId = this.generateQueryId();
    const timestamp = new Date();
    
    const logEntry: QueryLogEntry = {
      id: queryId,
      timestamp,
      table,
      select,
      filters: { ...filters }, // Clone to avoid mutations
      orderBy,
      userId,
      tenantId,
      cacheKey: cacheKey || `${table}-${select}-${JSON.stringify(filters)}`,
      success: false, // Will be updated when query completes
      cacheHit,
      cacheAge,
      circuitBreakerOpen,
      queryComplexity: this.assessQueryComplexity(table, select, filters, orderBy),
      performanceMetrics: {}
    };

    // Log query start (dev only)
    if (import.meta.env.DEV) {
      console.group(`🔍 [QueryLogger] Starting Query ${queryId}`);
      console.log('📊 Query Details:', {
        table,
        select: select.length > 100 ? `${select.substring(0, 100)}...` : select,
        filters,
        orderBy,
        complexity: logEntry.queryComplexity,
        cacheHit,
        cacheAge: cacheAge ? `${cacheAge}ms` : 'N/A',
        circuitBreakerOpen
      });
      
      if (cacheHit) {
        console.log('💾 Cache Hit - returning cached data');
      } else if (circuitBreakerOpen) {
        console.warn('🚫 Circuit Breaker Open - query blocked');
      } else {
        console.log('🚀 Executing fresh query...');
      }
    }

    this.logs.push(logEntry);
    this.trimLogs();
    
    return queryId;
  }

  /**
   * Complete a query with success
   */
  completeQuery(
    queryId: string,
    duration: number,
    resultCount: number,
    performanceMetrics: {
      networkTime?: number;
      processingTime?: number;
      cacheTime?: number;
    } = {}
  ): void {
    const logEntry = this.logs.find(log => log.id === queryId);
    if (!logEntry) {
      if (import.meta.env.DEV) {
        console.warn(`[QueryLogger] Query ${queryId} not found for completion`);
      }
      return;
    }

    // If this was a cache hit, use actual cache time instead of total elapsed time
    const actualDuration = logEntry.cacheHit && performanceMetrics.cacheTime !== undefined
      ? 0 // Cache hits should report ~0ms since they're instant
      : duration;

    logEntry.success = true;
    logEntry.duration = actualDuration;
    logEntry.resultCount = resultCount;
    logEntry.performanceMetrics = performanceMetrics;

    // Log completion (dev only)
    if (import.meta.env.DEV) {
      console.log('✅ Query Completed Successfully:', {
        duration: `${actualDuration}ms`,
        resultCount,
        performanceMetrics,
        isSlowQuery: actualDuration > this.slowQueryThreshold
      });
      
      if (actualDuration > this.slowQueryThreshold) {
        console.warn(`🐌 Slow Query Detected (${actualDuration}ms > ${this.slowQueryThreshold}ms)`);
      }
      
      console.groupEnd();
    }

    // Emit performance event for monitoring
    this.emitPerformanceEvent('query_completed', {
      queryId,
      table: logEntry.table,
      duration: actualDuration,
      resultCount,
      complexity: logEntry.queryComplexity,
      cacheHit: logEntry.cacheHit
    });
  }

  /**
   * Complete a query with error
   */
  failQuery(
    queryId: string,
    duration: number,
    error: {
      message: string;
      type: string;
      code?: string;
      details?: any;
    },
    retryCount = 0
  ): void {
    const logEntry = this.logs.find(log => log.id === queryId);
    if (!logEntry) {
      if (import.meta.env.DEV) {
        console.warn(`[QueryLogger] Query ${queryId} not found for failure`);
      }
      return;
    }

    logEntry.success = false;
    logEntry.duration = duration;
    logEntry.error = error;
    logEntry.retryCount = retryCount;

    // Log failure with detailed context (dev only)
    if (import.meta.env.DEV) {
      console.error('❌ Query Failed:', {
        queryId,
        duration: `${duration}ms`,
        error: {
          type: error.type,
          message: error.message,
          code: error.code
        },
        retryCount,
        context: {
          table: logEntry.table,
          filters: logEntry.filters,
          complexity: logEntry.queryComplexity,
          circuitBreakerOpen: logEntry.circuitBreakerOpen
        }
      });
      
      console.groupEnd();
    }

    // Emit error event for monitoring
    this.emitPerformanceEvent('query_failed', {
      queryId,
      table: logEntry.table,
      duration,
      errorType: error.type,
      errorMessage: error.message,
      retryCount,
      complexity: logEntry.queryComplexity
    });
  }

  /**
   * Get current query metrics
   */
  getMetrics(): QueryMetrics {
    const now = Date.now();
    const windowStart = now - this.metricsWindow;
    
    // Filter logs to metrics window
    const recentLogs = this.logs.filter(
      log => log.timestamp.getTime() >= windowStart
    );

    const totalQueries = recentLogs.length;
    const successfulQueries = recentLogs.filter(log => log.success).length;
    const failedQueries = totalQueries - successfulQueries;
    
    // Calculate average response time (only for completed queries)
    const completedQueries = recentLogs.filter(log => log.duration !== undefined);
    const averageResponseTime = completedQueries.length > 0
      ? completedQueries.reduce((sum, log) => sum + (log.duration || 0), 0) / completedQueries.length
      : 0;

    // Calculate cache hit rate
    const cacheHitRate = totalQueries > 0
      ? recentLogs.filter(log => log.cacheHit).length / totalQueries
      : 0;

    // Count circuit breaker activations
    const circuitBreakerActivations = recentLogs.filter(
      log => log.circuitBreakerOpen
    ).length;

    // Group errors by type
    const errorsByType: Record<string, number> = {};
    recentLogs.filter(log => !log.success && log.error).forEach(log => {
      const errorType = log.error!.type;
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
    });

    // Get slow queries (sorted by duration)
    const slowQueries = recentLogs
      .filter(log => log.duration && log.duration > this.slowQueryThreshold)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10); // Top 10 slowest

    // Get recent errors (last 10)
    const recentErrors = recentLogs
      .filter(log => !log.success)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      totalQueries,
      successfulQueries,
      failedQueries,
      averageResponseTime: Math.round(averageResponseTime),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      circuitBreakerActivations,
      errorsByType,
      slowQueries,
      recentErrors
    };
  }

  /**
   * Get detailed logs for debugging
   */
  getLogs(limit = 100): QueryLogEntry[] {
    return this.logs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    if (import.meta.env.DEV) {
      console.log('[QueryLogger] All logs cleared');
    }
  }

  /**
   * Export logs for analysis
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Trim logs to prevent memory issues
   */
  private trimLogs(): void {
    if (this.logs.length > this.maxLogEntries) {
      const excess = this.logs.length - this.maxLogEntries;
      this.logs.splice(0, excess);
      if (import.meta.env.DEV) {
        console.log(`[QueryLogger] Trimmed ${excess} old log entries`);
      }
    }
  }

  /**
   * Emit performance events for external monitoring
   */
  private emitPerformanceEvent(eventType: string, data: any): void {
    // Emit custom event for external monitoring systems
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('query-performance', {
        detail: {
          type: eventType,
          timestamp: new Date().toISOString(),
          data
        }
      }));
    }
  }

  /**
   * Log query structure for debugging
   */
  logQueryStructure(
    table: string,
    select: string,
    filters: Record<string, any>,
    orderBy?: { column: string; ascending?: boolean }
  ): void {
    if (!import.meta.env.DEV) return;
    
    console.group('🔍 [QueryLogger] Query Structure Analysis');
    console.log('📋 Table:', table);
    console.log('📝 Select:', select);
    console.log('🔍 Filters:', filters);
    console.log('📊 Order By:', orderBy || 'None');
    console.log('🧮 Complexity:', this.assessQueryComplexity(table, select, filters, orderBy));
    
    // Analyze potential issues
    const issues: string[] = [];
    
    if (select === '*') {
      issues.push('Using SELECT * - consider specifying exact columns for better performance');
    }
    
    if (select.length > 200) {
      issues.push('Very long SELECT clause - consider breaking into multiple queries');
    }
    
    if (Object.keys(filters).length > 5) {
      issues.push('Many filters applied - ensure proper indexing');
    }
    
    if (select.includes('!') && select.split('!').length > 3) {
      issues.push('Multiple joins detected - consider query optimization');
    }
    
    if (issues.length > 0) {
      console.warn('⚠️ Potential Issues:', issues);
    } else {
      console.log('✅ Query structure looks good');
    }
    
    console.groupEnd();
  }
}

// Export singleton instance
export const queryLogger = new QueryLogger();
