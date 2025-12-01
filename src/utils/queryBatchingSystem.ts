/**
 * Query Batching System
 * 
 * Implements query batching for similar operations to reduce database
 * connection overhead with batch size optimization and efficiency tracking.
 */

export interface BatchableQuery {
  id: string;
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete';
  filters?: Record<string, any>;
  columns?: string[];
  data?: any;
  timestamp: number;
  query?: () => Promise<any>; // Add query function for testing
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export interface BatchConfig {
  maxBatchSize: number;
  maxWaitTimeMs: number;
  minBatchSize: number;
  enableAdaptiveBatching: boolean;
  batchByTable: boolean;
  batchByOperation: boolean;
}

export interface BatchMetrics {
  totalQueries: number;
  batchedQueries: number;
  totalBatches: number;
  averageBatchSize: number;
  batchingEfficiency: number; // Percentage of queries that were batched
  averageWaitTime: number;
  connectionsSaved: number;
  lastBatchTime?: number;
  batchesByTable: Record<string, number>;
  batchesByOperation: Record<string, number>;
}

export interface BatchGroup {
  key: string;
  table: string;
  operation: string;
  queries: BatchableQuery[];
  createdAt: number;
  scheduledAt?: number;
}

/**
 * Query Batch Optimizer - determines optimal batch sizes
 */
class QueryBatchOptimizer {
  private performanceHistory: Map<string, number[]> = new Map();
  private readonly maxHistorySize = 50;

  /**
   * Record batch performance
   */
  recordBatchPerformance(
    batchKey: string,
    batchSize: number,
    executionTime: number
  ): void {
    if (!this.performanceHistory.has(batchKey)) {
      this.performanceHistory.set(batchKey, []);
    }

    const history = this.performanceHistory.get(batchKey)!;
    const efficiency = batchSize / executionTime; // queries per ms
    
    history.push(efficiency);
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * Get optimal batch size based on performance history
   */
  getOptimalBatchSize(batchKey: string, defaultSize: number): number {
    const history = this.performanceHistory.get(batchKey);
    if (!history || history.length < 5) {
      return defaultSize;
    }

    // Find the batch size that gives best efficiency
    const recentHistory = history.slice(-10);
    const averageEfficiency = recentHistory.reduce((sum, eff) => sum + eff, 0) / recentHistory.length;
    
    // If efficiency is declining, reduce batch size
    if (averageEfficiency < recentHistory[0] * 0.8) {
      return Math.max(1, Math.floor(defaultSize * 0.8));
    }
    
    // If efficiency is good, try slightly larger batches
    if (averageEfficiency > recentHistory[0] * 1.2) {
      return Math.min(100, Math.floor(defaultSize * 1.2));
    }
    
    return defaultSize;
  }

  /**
   * Get performance insights for a batch key
   */
  getPerformanceInsights(batchKey: string): {
    averageEfficiency: number;
    trend: 'improving' | 'stable' | 'declining';
    recommendedBatchSize: number;
  } {
    const history = this.performanceHistory.get(batchKey);
    if (!history || history.length === 0) {
      return {
        averageEfficiency: 0,
        trend: 'stable',
        recommendedBatchSize: 10
      };
    }

    const averageEfficiency = history.reduce((sum, eff) => sum + eff, 0) / history.length;
    
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (history.length >= 3) {
      const recent = history.slice(-3);
      const isImproving = recent[2] > recent[1] && recent[1] > recent[0];
      const isDeclining = recent[2] < recent[1] && recent[1] < recent[0];
      
      if (isImproving) trend = 'improving';
      else if (isDeclining) trend = 'declining';
    }

    const recommendedBatchSize = this.getOptimalBatchSize(batchKey, 10);

    return { averageEfficiency, trend, recommendedBatchSize };
  }
}

/**
 * Query Batch Executor - executes batched queries
 */
class QueryBatchExecutor {
  /**
   * Execute a batch of SELECT queries
   */
  async executeBatchSelect(
    table: string,
    queries: BatchableQuery[]
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    
    try {
      // Group queries by similar filters to optimize execution
      const filterGroups = this.groupQueriesByFilters(queries);
      
      for (const [filterKey, groupQueries] of filterGroups) {
        // Execute queries with similar filters together
        const batchResult = await this.executeSimilarQueries(table, groupQueries);
        
        // Distribute results back to individual queries
        groupQueries.forEach((query, index) => {
          results.set(query.id, batchResult[index] || []);
        });
      }
    } catch (error) {
      // If batch execution fails, mark all queries as failed
      queries.forEach(query => {
        results.set(query.id, { error });
      });
    }
    
    return results;
  }

  /**
   * Execute a batch of INSERT queries
   */
  async executeBatchInsert(
    table: string,
    queries: BatchableQuery[]
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    
    try {
      // Combine all insert data
      const insertData = queries.map(query => query.data).filter(Boolean);
      
      if (insertData.length > 0) {
        // Execute batch insert (implementation depends on database client)
        const batchResult = await this.executeBatchInsertOperation(table, insertData);
        
        // Distribute results back to individual queries
        queries.forEach((query, index) => {
          results.set(query.id, batchResult[index] || { success: true });
        });
      }
    } catch (error) {
      queries.forEach(query => {
        results.set(query.id, { error });
      });
    }
    
    return results;
  }

  /**
   * Execute a batch of UPDATE queries
   */
  async executeBatchUpdate(
    table: string,
    queries: BatchableQuery[]
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    
    try {
      // Group updates by similar operations
      const updateGroups = this.groupUpdateQueries(queries);
      
      for (const [groupKey, groupQueries] of updateGroups) {
        const batchResult = await this.executeBatchUpdateOperation(table, groupQueries);
        
        groupQueries.forEach((query, index) => {
          results.set(query.id, batchResult[index] || { success: true });
        });
      }
    } catch (error) {
      queries.forEach(query => {
        results.set(query.id, { error });
      });
    }
    
    return results;
  }

  /**
   * Group queries by similar filters
   */
  private groupQueriesByFilters(queries: BatchableQuery[]): Map<string, BatchableQuery[]> {
    const groups = new Map<string, BatchableQuery[]>();
    
    queries.forEach(query => {
      const filterKey = JSON.stringify(query.filters || {});
      if (!groups.has(filterKey)) {
        groups.set(filterKey, []);
      }
      groups.get(filterKey)!.push(query);
    });
    
    return groups;
  }

  /**
   * Group update queries by similar operations
   */
  private groupUpdateQueries(queries: BatchableQuery[]): Map<string, BatchableQuery[]> {
    const groups = new Map<string, BatchableQuery[]>();
    
    queries.forEach(query => {
      // Group by the fields being updated
      const updateFields = Object.keys(query.data || {}).sort().join(',');
      const groupKey = updateFields;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(query);
    });
    
    return groups;
  }

  /**
   * Execute similar queries (placeholder - implement based on your database client)
   */
  private async executeSimilarQueries(
    table: string,
    queries: BatchableQuery[]
  ): Promise<any[]> {
    // This is a placeholder implementation
    // In a real implementation, you would use your database client's batch query capabilities
    console.log(`Executing batch of ${queries.length} queries on table ${table}`);
    
    // For testing purposes, execute each query function if available
    const results = [];
    for (const query of queries) {
      if (typeof query.query === 'function') {
        try {
          const result = await query.query();
          results.push(result);
        } catch (error) {
          results.push({ error });
        }
      } else {
        results.push([]);
      }
    }
    
    return results;
  }

  /**
   * Execute batch insert operation (placeholder)
   */
  private async executeBatchInsertOperation(
    table: string,
    data: any[]
  ): Promise<any[]> {
    console.log(`Executing batch insert of ${data.length} records into table ${table}`);
    return data.map(() => ({ success: true }));
  }

  /**
   * Execute batch update operation (placeholder)
   */
  private async executeBatchUpdateOperation(
    table: string,
    queries: BatchableQuery[]
  ): Promise<any[]> {
    console.log(`Executing batch update of ${queries.length} records in table ${table}`);
    return queries.map(() => ({ success: true }));
  }
}

/**
 * Query Batching Manager
 */
export class QueryBatchingManager {
  private static instance: QueryBatchingManager;
  private config: BatchConfig;
  private batchGroups: Map<string, BatchGroup> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private optimizer: QueryBatchOptimizer;
  private executor: QueryBatchExecutor;
  private metrics: BatchMetrics;

  private constructor(config: Partial<BatchConfig> = {}) {
    this.config = {
      maxBatchSize: 50,
      maxWaitTimeMs: 100,
      minBatchSize: 2,
      enableAdaptiveBatching: true,
      batchByTable: true,
      batchByOperation: true,
      ...config
    };

    this.optimizer = new QueryBatchOptimizer();
    this.executor = new QueryBatchExecutor();
    this.metrics = this.initializeMetrics();
  }

  static getInstance(config?: Partial<BatchConfig>): QueryBatchingManager {
    if (!QueryBatchingManager.instance) {
      QueryBatchingManager.instance = new QueryBatchingManager(config);
    }
    return QueryBatchingManager.instance;
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): BatchMetrics {
    return {
      totalQueries: 0,
      batchedQueries: 0,
      totalBatches: 0,
      averageBatchSize: 0,
      batchingEfficiency: 0,
      averageWaitTime: 0,
      connectionsSaved: 0,
      batchesByTable: {},
      batchesByOperation: {}
    };
  }

  /**
   * Add query to batch or execute immediately
   */
  async executeQuery<T>(
    id: string,
    table: string,
    operation: 'select' | 'insert' | 'update' | 'delete',
    queryFn: () => Promise<T>,
    options: {
      filters?: Record<string, any>;
      columns?: string[];
      data?: any;
      forceBatch?: boolean;
      skipBatch?: boolean;
    } = {}
  ): Promise<T> {
    this.metrics.totalQueries++;

    // Skip batching if requested or not batchable
    if (options.skipBatch || !this.isBatchable(operation)) {
      return await queryFn();
    }

    return new Promise<T>((resolve, reject) => {
      const batchableQuery: BatchableQuery = {
        id,
        table,
        operation,
        filters: options.filters,
        columns: options.columns,
        data: options.data,
        timestamp: Date.now(),
        query: queryFn, // Store the query function
        resolve: resolve as (value: any) => void,
        reject
      };

      this.addToBatch(batchableQuery, options.forceBatch);
    });
  }

  /**
   * Check if operation is batchable
   */
  private isBatchable(operation: string): boolean {
    // DELETE operations are typically not safe to batch
    return ['select', 'insert', 'update'].includes(operation);
  }

  /**
   * Add query to appropriate batch
   */
  private addToBatch(query: BatchableQuery, forceBatch: boolean = false): void {
    const batchKey = this.getBatchKey(query);
    
    if (!this.batchGroups.has(batchKey)) {
      this.batchGroups.set(batchKey, {
        key: batchKey,
        table: query.table,
        operation: query.operation,
        queries: [],
        createdAt: Date.now()
      });
    }

    const batch = this.batchGroups.get(batchKey)!;
    batch.queries.push(query);

    // Check if batch should be executed
    const shouldExecute = forceBatch ||
      batch.queries.length >= this.getOptimalBatchSize(batchKey) ||
      batch.queries.length >= this.config.maxBatchSize;

    if (shouldExecute) {
      this.executeBatch(batchKey);
    } else {
      this.scheduleBatchExecution(batchKey);
    }
  }

  /**
   * Generate batch key for grouping queries
   */
  private getBatchKey(query: BatchableQuery): string {
    const parts: string[] = [];
    
    if (this.config.batchByTable) {
      parts.push(`table:${query.table}`);
    }
    
    if (this.config.batchByOperation) {
      parts.push(`op:${query.operation}`);
    }
    
    // For SELECT queries, also group by similar filters
    if (query.operation === 'select' && query.filters) {
      const filterKeys = Object.keys(query.filters).sort().join(',');
      parts.push(`filters:${filterKeys}`);
    }
    
    return parts.join('|');
  }

  /**
   * Get optimal batch size for a batch key
   */
  private getOptimalBatchSize(batchKey: string): number {
    if (!this.config.enableAdaptiveBatching) {
      return Math.floor(this.config.maxBatchSize / 2);
    }
    
    return this.optimizer.getOptimalBatchSize(batchKey, Math.floor(this.config.maxBatchSize / 2));
  }

  /**
   * Schedule batch execution after wait time
   */
  private scheduleBatchExecution(batchKey: string): void {
    if (this.batchTimers.has(batchKey)) {
      return; // Already scheduled
    }

    const timer = setTimeout(() => {
      this.executeBatch(batchKey);
    }, this.config.maxWaitTimeMs);

    this.batchTimers.set(batchKey, timer);
  }

  /**
   * Execute a batch of queries
   */
  private async executeBatch(batchKey: string): Promise<void> {
    const batch = this.batchGroups.get(batchKey);
    if (!batch || batch.queries.length === 0) {
      return;
    }

    // Clear timer if exists
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }

    // Remove batch from groups
    this.batchGroups.delete(batchKey);

    // Check minimum batch size
    if (batch.queries.length < this.config.minBatchSize) {
      // Execute queries individually
      for (const query of batch.queries) {
        try {
          // Execute individual query (placeholder)
          const result = await this.executeIndividualQuery(query);
          query.resolve(result);
        } catch (error) {
          query.reject(error);
        }
      }
      return;
    }

    const startTime = Date.now();
    
    try {
      let results: Map<string, any>;
      
      // Execute batch based on operation type
      switch (batch.operation) {
        case 'select':
          results = await this.executor.executeBatchSelect(batch.table, batch.queries);
          break;
        case 'insert':
          results = await this.executor.executeBatchInsert(batch.table, batch.queries);
          break;
        case 'update':
          results = await this.executor.executeBatchUpdate(batch.table, batch.queries);
          break;
        default:
          throw new Error(`Unsupported batch operation: ${batch.operation}`);
      }

      // Resolve individual query promises
      batch.queries.forEach(query => {
        const result = results.get(query.id);
        if (result && result.error) {
          query.reject(result.error);
        } else {
          query.resolve(result);
        }
      });

      // Record performance metrics
      const executionTime = Date.now() - startTime;
      this.recordBatchExecution(batch, executionTime);
      
      if (this.config.enableAdaptiveBatching) {
        this.optimizer.recordBatchPerformance(batchKey, batch.queries.length, executionTime);
      }

    } catch (error) {
      // If batch execution fails, reject all queries
      batch.queries.forEach(query => {
        query.reject(error);
      });
    }
  }

  /**
   * Execute individual query (fallback)
   */
  private async executeIndividualQuery(query: BatchableQuery): Promise<any> {
    // Placeholder implementation - in real usage, this would call the actual query function
    console.log(`Executing individual query ${query.id} on table ${query.table}`);
    
    // For testing purposes, call the actual query function if available
    if (typeof query.query === 'function') {
      return await query.query();
    }
    
    return [];
  }

  /**
   * Record batch execution metrics
   */
  private recordBatchExecution(batch: BatchGroup, executionTime: number): void {
    this.metrics.totalBatches++;
    this.metrics.batchedQueries += batch.queries.length;
    this.metrics.lastBatchTime = Date.now();
    
    // Calculate average wait time
    const waitTimes = batch.queries.map(q => batch.createdAt - q.timestamp);
    const averageWaitTime = waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length;
    
    this.metrics.averageWaitTime = (this.metrics.averageWaitTime + averageWaitTime) / 2;
    
    // Update batch size average
    this.metrics.averageBatchSize = this.metrics.batchedQueries / this.metrics.totalBatches;
    
    // Calculate efficiency
    this.metrics.batchingEfficiency = this.metrics.batchedQueries / this.metrics.totalQueries;
    
    // Estimate connections saved (each batch saves N-1 connections)
    this.metrics.connectionsSaved += Math.max(0, batch.queries.length - 1);
    
    // Update per-table and per-operation metrics
    this.metrics.batchesByTable[batch.table] = (this.metrics.batchesByTable[batch.table] || 0) + 1;
    this.metrics.batchesByOperation[batch.operation] = (this.metrics.batchesByOperation[batch.operation] || 0) + 1;
  }

  /**
   * Get batching metrics
   */
  getMetrics(): BatchMetrics {
    return { ...this.metrics };
  }

  /**
   * Get detailed batching status
   */
  getStatus(): {
    config: BatchConfig;
    metrics: BatchMetrics;
    activeBatches: number;
    pendingQueries: number;
    performanceInsights: Record<string, ReturnType<QueryBatchOptimizer['getPerformanceInsights']>>;
  } {
    const pendingQueries = Array.from(this.batchGroups.values())
      .reduce((sum, batch) => sum + batch.queries.length, 0);

    const performanceInsights: Record<string, ReturnType<QueryBatchOptimizer['getPerformanceInsights']>> = {};
    
    for (const batchKey of this.batchGroups.keys()) {
      performanceInsights[batchKey] = this.optimizer.getPerformanceInsights(batchKey);
    }

    return {
      config: this.config,
      metrics: this.getMetrics(),
      activeBatches: this.batchGroups.size,
      pendingQueries,
      performanceInsights
    };
  }

  /**
   * Update batching configuration
   */
  updateConfig(updates: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Force execution of all pending batches
   */
  async flushAllBatches(): Promise<void> {
    const batchKeys = Array.from(this.batchGroups.keys());
    
    await Promise.all(
      batchKeys.map(batchKey => this.executeBatch(batchKey))
    );
  }

  /**
   * Get batching recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const status = this.getStatus();
    
    if (status.metrics.batchingEfficiency < 0.3) {
      recommendations.push('Low batching efficiency. Consider increasing maxWaitTimeMs or reducing minBatchSize.');
    }
    
    if (status.metrics.averageWaitTime > this.config.maxWaitTimeMs * 0.8) {
      recommendations.push('High average wait time. Consider reducing maxWaitTimeMs or maxBatchSize.');
    }
    
    if (status.metrics.averageBatchSize < 3) {
      recommendations.push('Small average batch size. Consider increasing maxWaitTimeMs to allow larger batches.');
    }
    
    if (status.pendingQueries > 100) {
      recommendations.push('High number of pending queries. Consider increasing maxBatchSize or reducing maxWaitTimeMs.');
    }
    
    return recommendations;
  }

  /**
   * Reset batching state
   */
  reset(): void {
    // Clear all timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    
    this.batchGroups.clear();
    this.batchTimers.clear();
    this.metrics = this.initializeMetrics();
  }
}

// Export singleton instance
export const queryBatchingManager = QueryBatchingManager.getInstance();