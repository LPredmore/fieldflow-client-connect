/**
 * Query Prioritization and Throttling Integration
 * 
 * Unified interface that combines priority-based execution, request throttling,
 * and query batching to optimize database query performance.
 */

import { 
  QueryPriority, 
  PriorityQuery, 
  priorityQueryExecutor,
  QueryPriorityManager 
} from './queryPrioritySystem';

import { 
  queryThrottlingManager,
  QueryThrottlingManager,
  ThrottleConfig 
} from './queryThrottlingSystem';

import { 
  queryBatchingManager,
  QueryBatchingManager,
  BatchConfig 
} from './queryBatchingSystem';

export interface QueryExecutionOptions {
  priority?: QueryPriority;
  table: string;
  operation?: 'select' | 'insert' | 'update' | 'delete';
  userContext?: {
    userId: string;
    role: string;
    permissions: string[];
  };
  authRequired?: boolean;
  enableBatching?: boolean;
  enableThrottling?: boolean;
  filters?: Record<string, any>;
  data?: any;
  columns?: string[];
}

export interface QueryExecutionResult<T> {
  data: T;
  metadata: {
    executionTime: number;
    wasBatched: boolean;
    wasThrottled: boolean;
    priority: QueryPriority;
    cacheHit?: boolean;
    retryCount?: number;
  };
}

export interface SystemPerformanceMetrics {
  prioritySystem: {
    queueStatus: ReturnType<typeof priorityQueryExecutor.getStatus>;
  };
  throttlingSystem: {
    metrics: ReturnType<QueryThrottlingManager['getMetrics']>;
    status: ReturnType<QueryThrottlingManager['getStatus']>;
  };
  batchingSystem: {
    metrics: ReturnType<QueryBatchingManager['getMetrics']>;
    status: ReturnType<QueryBatchingManager['getStatus']>;
  };
  overall: {
    totalQueries: number;
    averageExecutionTime: number;
    systemLoad: number;
    recommendations: string[];
  };
}

/**
 * Unified Query Performance Manager
 */
export class QueryPerformanceManager {
  private static instance: QueryPerformanceManager;
  private priorityManager: QueryPriorityManager;
  private executionHistory: Array<{
    timestamp: number;
    executionTime: number;
    priority: QueryPriority;
    wasBatched: boolean;
    wasThrottled: boolean;
  }> = [];
  private readonly maxHistorySize = 1000;

  private constructor() {
    this.priorityManager = QueryPriorityManager.getInstance();
  }

  static getInstance(): QueryPerformanceManager {
    if (!QueryPerformanceManager.instance) {
      QueryPerformanceManager.instance = new QueryPerformanceManager();
    }
    return QueryPerformanceManager.instance;
  }

  /**
   * Execute query with integrated prioritization, throttling, and batching
   */
  async executeQuery<T>(
    queryId: string,
    queryFn: () => Promise<T>,
    options: QueryExecutionOptions
  ): Promise<QueryExecutionResult<T>> {
    const startTime = Date.now();
    let wasBatched = false;
    let wasThrottled = false;

    // Determine priority
    const priority = options.priority || this.priorityManager.calculatePriority(
      options.table,
      options.userContext,
      options.authRequired
    );

    // Check throttling (unless disabled or critical priority)
    if (options.enableThrottling !== false && priority !== QueryPriority.CRITICAL) {
      const throttleResult = queryThrottlingManager.shouldThrottle(
        queryId,
        priority,
        options.table
      );

      if (throttleResult.throttled) {
        wasThrottled = true;
        
        // Wait for retry delay if specified
        if (throttleResult.retryAfter) {
          await this.delay(throttleResult.retryAfter);
        } else {
          throw new Error(`Query throttled: ${throttleResult.reason}`);
        }
      }
    }

    let result: T;

    // Execute with batching if enabled and applicable
    if (options.enableBatching !== false && options.operation && 
        ['select', 'insert', 'update'].includes(options.operation)) {
      
      result = await queryBatchingManager.executeQuery(
        queryId,
        options.table,
        options.operation,
        queryFn,
        {
          filters: options.filters,
          columns: options.columns,
          data: options.data,
          skipBatch: !options.enableBatching
        }
      );
      wasBatched = true;
    } else if (options.enableBatching !== false) {
      // Execute with priority system
      result = await priorityQueryExecutor.executeQuery(
        queryId,
        options.table,
        queryFn,
        options.userContext,
        options.authRequired
      );
    }

    const executionTime = Date.now() - startTime;

    // Record execution history
    this.recordExecution({
      timestamp: Date.now(),
      executionTime,
      priority,
      wasBatched,
      wasThrottled
    });

    // Update system load for adaptive throttling
    this.updateSystemLoad();

    return {
      data: result,
      metadata: {
        executionTime,
        wasBatched,
        wasThrottled,
        priority
      }
    };
  }

  /**
   * Execute multiple queries with optimal coordination
   */
  async executeQueries<T>(
    queries: Array<{
      id: string;
      queryFn: () => Promise<T>;
      options: QueryExecutionOptions;
    }>
  ): Promise<Array<QueryExecutionResult<T>>> {
    // Sort queries by priority
    const sortedQueries = queries.sort((a, b) => {
      const priorityA = a.options.priority || this.priorityManager.calculatePriority(
        a.options.table,
        a.options.userContext,
        a.options.authRequired
      );
      const priorityB = b.options.priority || this.priorityManager.calculatePriority(
        b.options.table,
        b.options.userContext,
        b.options.authRequired
      );
      return priorityA - priorityB;
    });

    // Execute queries with appropriate concurrency limits
    const results: Array<QueryExecutionResult<T>> = [];
    const concurrencyLimit = this.calculateOptimalConcurrency();
    
    for (let i = 0; i < sortedQueries.length; i += concurrencyLimit) {
      const batch = sortedQueries.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(
        batch.map(query => this.executeQuery(query.id, query.queryFn, query.options))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Calculate optimal concurrency based on system performance
   */
  private calculateOptimalConcurrency(): number {
    const recentHistory = this.executionHistory.slice(-50);
    if (recentHistory.length === 0) return 3;

    const averageExecutionTime = recentHistory.reduce(
      (sum, record) => sum + record.executionTime, 0
    ) / recentHistory.length;

    // Adjust concurrency based on performance
    if (averageExecutionTime < 500) return 5; // Fast queries, higher concurrency
    if (averageExecutionTime < 1000) return 3; // Medium queries, moderate concurrency
    return 2; // Slow queries, lower concurrency
  }

  /**
   * Record execution for performance tracking
   */
  private recordExecution(record: {
    timestamp: number;
    executionTime: number;
    priority: QueryPriority;
    wasBatched: boolean;
    wasThrottled: boolean;
  }): void {
    this.executionHistory.push(record);
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift();
    }
  }

  /**
   * Update system load metrics for adaptive throttling
   */
  private updateSystemLoad(): void {
    const priorityStatus = priorityQueryExecutor.getStatus();
    const batchingStatus = queryBatchingManager.getStatus();
    
    const recentHistory = this.executionHistory.slice(-10);
    const averageResponseTime = recentHistory.length > 0
      ? recentHistory.reduce((sum, record) => sum + record.executionTime, 0) / recentHistory.length
      : 0;

    queryThrottlingManager.updateSystemLoad(
      priorityStatus.activeQueries,
      priorityStatus.queueStatus.total,
      averageResponseTime
    );
  }

  /**
   * Get comprehensive system performance metrics
   */
  getPerformanceMetrics(): SystemPerformanceMetrics {
    const recentHistory = this.executionHistory.slice(-100);
    const totalQueries = recentHistory.length;
    const averageExecutionTime = totalQueries > 0
      ? recentHistory.reduce((sum, record) => sum + record.executionTime, 0) / totalQueries
      : 0;

    // Calculate system load based on recent performance
    const systemLoad = Math.min(1, averageExecutionTime / 2000); // Normalize to 2s max

    // Gather recommendations from all systems
    const recommendations = [
      ...queryThrottlingManager.getRecommendations(),
      ...queryBatchingManager.getRecommendations(),
      ...this.getPerformanceRecommendations()
    ];

    return {
      prioritySystem: {
        queueStatus: priorityQueryExecutor.getStatus()
      },
      throttlingSystem: {
        metrics: queryThrottlingManager.getMetrics(),
        status: queryThrottlingManager.getStatus()
      },
      batchingSystem: {
        metrics: queryBatchingManager.getMetrics(),
        status: queryBatchingManager.getStatus()
      },
      overall: {
        totalQueries,
        averageExecutionTime,
        systemLoad,
        recommendations
      }
    };
  }

  /**
   * Get performance recommendations based on execution history
   */
  private getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const recentHistory = this.executionHistory.slice(-100);
    
    if (recentHistory.length === 0) return recommendations;

    const averageExecutionTime = recentHistory.reduce(
      (sum, record) => sum + record.executionTime, 0
    ) / recentHistory.length;

    const throttledRatio = recentHistory.filter(r => r.wasThrottled).length / recentHistory.length;
    const batchedRatio = recentHistory.filter(r => r.wasBatched).length / recentHistory.length;

    if (averageExecutionTime > 2000) {
      recommendations.push('High average execution time detected. Consider optimizing queries or increasing caching.');
    }

    if (throttledRatio > 0.2) {
      recommendations.push('High throttling rate detected. Consider increasing rate limits or optimizing query patterns.');
    }

    if (batchedRatio < 0.3) {
      recommendations.push('Low batching efficiency. Consider enabling batching for more query types.');
    }

    const criticalQueries = recentHistory.filter(r => r.priority === QueryPriority.CRITICAL);
    if (criticalQueries.some(q => q.executionTime > 1000)) {
      recommendations.push('Critical queries are taking too long. Review and optimize critical query paths.');
    }

    return recommendations;
  }

  /**
   * Configure system performance settings
   */
  configureSystem(config: {
    throttling?: Partial<ThrottleConfig>;
    batching?: Partial<BatchConfig>;
    maxConcurrentQueries?: number;
  }): void {
    if (config.throttling) {
      queryThrottlingManager.updateConfig(config.throttling);
    }

    if (config.batching) {
      queryBatchingManager.updateConfig(config.batching);
    }

    if (config.maxConcurrentQueries) {
      priorityQueryExecutor.setMaxConcurrentQueries(config.maxConcurrentQueries);
    }
  }

  /**
   * Cancel queries matching criteria
   */
  cancelQueries(predicate: (query: { table: string; priority: QueryPriority }) => boolean): number {
    return priorityQueryExecutor.cancelQueries((query: PriorityQuery) => 
      predicate({ table: query.table, priority: query.priority })
    );
  }

  /**
   * Flush all pending batches and process priority queue
   */
  async flushPendingOperations(): Promise<void> {
    await queryBatchingManager.flushAllBatches();
    // Priority queue processes automatically, no manual flush needed
  }

  /**
   * Reset all system state (useful for testing)
   */
  reset(): void {
    queryThrottlingManager.reset();
    queryBatchingManager.reset();
    this.executionHistory = [];
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance and utilities
export const queryPerformanceManager = QueryPerformanceManager.getInstance();

// Export types and enums for external use
export { QueryPriority } from './queryPrioritySystem';
export type { ThrottleConfig, BatchConfig };

// Convenience function for simple query execution
export async function executeOptimizedQuery<T>(
  queryId: string,
  table: string,
  queryFn: () => Promise<T>,
  options: Partial<QueryExecutionOptions> = {}
): Promise<T> {
  const result = await queryPerformanceManager.executeQuery(queryId, queryFn, {
    table,
    ...options
  });
  return result.data;
}