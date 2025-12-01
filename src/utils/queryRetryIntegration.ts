/**
 * Query Retry Integration
 * 
 * Integrates automatic retry manager with the existing query system,
 * progressive error recovery, and circuit breaker.
 */

import { automaticRetryManager, executeWithRetry, RetryResult } from './automaticRetryManager';
import { progressiveErrorRecovery, QueryContext, ErrorRecoveryResult } from './progressiveErrorRecovery';
import { supabaseCircuitBreaker } from './circuitBreaker';
import { enhancedQueryCache, CachePriority } from './enhancedQueryCache';

export interface QueryRetryOptions {
  /** Retry scenario configuration */
  retryScenario?: 'fast' | 'standard' | 'patient' | 'critical';
  /** Whether to use progressive error recovery */
  useProgressiveRecovery?: boolean;
  /** Maximum total time to spend on retries (ms) */
  maxRetryTime?: number;
  /** Whether to store successful results in cache */
  cacheResults?: boolean;
  /** Custom operation identifier for deduplication */
  operationId?: string;
}

export interface EnhancedQueryResult<T> {
  /** Whether the query succeeded (including recovery) */
  success: boolean;
  /** Query result data */
  data?: T[];
  /** Error if query failed completely */
  error?: Error;
  /** Error recovery result if recovery was attempted */
  recoveryResult?: ErrorRecoveryResult;
  /** Retry statistics */
  retryResult?: RetryResult<T[]>;
  /** Whether data came from cache */
  fromCache?: boolean;
  /** Cache age if data came from cache */
  cacheAge?: number;
  /** Total query duration including retries */
  totalDuration: number;
}

export class QueryRetryIntegration {
  private static instance: QueryRetryIntegration;
  private queryStartTimes = new Map<string, number>();

  static getInstance(): QueryRetryIntegration {
    if (!QueryRetryIntegration.instance) {
      QueryRetryIntegration.instance = new QueryRetryIntegration();
    }
    return QueryRetryIntegration.instance;
  }

  /**
   * Execute query with integrated retry and recovery
   */
  async executeQuery<T>(
    queryOperation: () => Promise<T[]>,
    context: QueryContext,
    options: QueryRetryOptions = {}
  ): Promise<EnhancedQueryResult<T>> {
    const startTime = Date.now();
    const operationId = options.operationId || `${context.table}-${context.cacheKey}`;
    
    this.queryStartTimes.set(operationId, startTime);

    const {
      retryScenario = 'standard',
      useProgressiveRecovery = true,
      maxRetryTime = 60000,
      cacheResults = true
    } = options;

    console.log(`🚀 Starting enhanced query for ${context.table}`, {
      operationId,
      retryScenario,
      useProgressiveRecovery
    });

    try {
      // First, try the query with automatic retry
      const retryResult = await this.executeWithTimeLimit(
        () => executeWithRetry(queryOperation, retryScenario, operationId),
        maxRetryTime
      );

      if (retryResult.success && retryResult.data) {
        // Success - cache results if enabled
        if (cacheResults) {
          this.cacheSuccessfulResult(context, retryResult.data);
        }

        // Clear any previous recovery attempts
        progressiveErrorRecovery.clearRecoveryAttempts(context.table, context.cacheKey);

        return {
          success: true,
          data: retryResult.data,
          retryResult,
          totalDuration: Date.now() - startTime
        };
      }

      // Query failed after retries - attempt progressive recovery
      if (useProgressiveRecovery) {
        console.log(`🔄 Query failed after retries, attempting progressive recovery`);
        
        const recoveryResult = await progressiveErrorRecovery.handleQueryError(
          retryResult.error,
          context
        );

        if (recoveryResult.success) {
          return {
            success: true,
            data: recoveryResult.data,
            recoveryResult,
            retryResult,
            fromCache: true,
            cacheAge: this.calculateCacheAge(context),
            totalDuration: Date.now() - startTime
          };
        }

        // Recovery also failed
        return {
          success: false,
          error: retryResult.error,
          recoveryResult,
          retryResult,
          totalDuration: Date.now() - startTime
        };
      }

      // No recovery - return failure
      return {
        success: false,
        error: retryResult.error,
        retryResult,
        totalDuration: Date.now() - startTime
      };

    } catch (error) {
      // Unexpected error during retry/recovery process
      console.error(`💥 Unexpected error in query retry integration:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        totalDuration: Date.now() - startTime
      };
    } finally {
      this.queryStartTimes.delete(operationId);
    }
  }

  /**
   * Execute operation with time limit
   */
  private async executeWithTimeLimit<T>(
    operation: () => Promise<T>,
    timeLimit: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Query timeout after ${timeLimit}ms`)), timeLimit)
      )
    ]);
  }

  /**
   * Cache successful query result
   */
  private cacheSuccessfulResult<T>(context: QueryContext, data: T[]): void {
    try {
      // Create proper metadata for caching
      const metadata = {
        table: context.table,
        select: '*',
        filters: {},
        userId: context.userId || 'anonymous',
        tenantId: context.tenantId
      };

      const cacheConfig = {
        staleTime: 30000,
        maxAge: 300000,
        priority: 2 as CachePriority, // CachePriority.MEDIUM
        backgroundRefresh: true
      };

      const queryMetadata = {
        ...metadata,
        select: metadata.select || '*',
        filters: metadata.filters || {},
        userId: metadata.userId
      };
      enhancedQueryCache.set(context.cacheKey, data, cacheConfig, queryMetadata);
      
      console.log(`📦 Cached successful result for ${context.table}`);
    } catch (error) {
      console.warn('Failed to cache successful result:', error);
    }
  }

  /**
   * Calculate cache age for recovered data
   */
  private calculateCacheAge(context: QueryContext): number {
    const cacheEntry = enhancedQueryCache.get(context.cacheKey);
    if (cacheEntry.hit && cacheEntry.data && 'timestamp' in cacheEntry.data) {
      return Date.now() - (cacheEntry.data as { timestamp: number }).timestamp;
    }
    return 0;
  }

  /**
   * Get query performance metrics
   */
  getQueryMetrics(operationId?: string) {
    const retryStats = automaticRetryManager.getRetryStats(operationId);
    const recoveryStats = progressiveErrorRecovery.getRecoveryStats();
    const circuitBreakerState = supabaseCircuitBreaker.getState();

    return {
      retryStats,
      recoveryStats,
      circuitBreakerState,
      activeQueries: this.queryStartTimes.size,
      longestRunningQuery: this.getLongestRunningQueryDuration()
    };
  }

  /**
   * Get duration of longest running query
   */
  private getLongestRunningQueryDuration(): number {
    const now = Date.now();
    let maxDuration = 0;

    for (const startTime of this.queryStartTimes.values()) {
      const duration = now - startTime;
      maxDuration = Math.max(maxDuration, duration);
    }

    return maxDuration;
  }

  /**
   * Cancel query by operation ID
   */
  cancelQuery(operationId: string): boolean {
    const cancelled = automaticRetryManager.cancelRetry(operationId);
    this.queryStartTimes.delete(operationId);
    return cancelled;
  }

  /**
   * Clear all query history and metrics
   */
  clearMetrics(): void {
    this.queryStartTimes.clear();
    // Note: Individual managers handle their own cleanup
  }
}

// Export singleton instance
export const queryRetryIntegration = QueryRetryIntegration.getInstance();

/**
 * Enhanced query executor function
 * Convenience function that wraps the full retry and recovery logic
 */
export async function executeEnhancedQuery<T>(
  queryOperation: () => Promise<T[]>,
  context: QueryContext,
  options: QueryRetryOptions = {}
): Promise<EnhancedQueryResult<T>> {
  return queryRetryIntegration.executeQuery(queryOperation, context, options);
}

/**
 * React hook for enhanced queries with retry and recovery
 * Note: Import React in the component that uses this hook
 */
export function useEnhancedQuery<T>(
  queryOperation: () => Promise<T[]>,
  context: QueryContext,
  options: QueryRetryOptions = {},
  dependencies: any[] = []
) {
  // This hook should be used in React components where React is already imported
  const React = (globalThis as any).React;
  if (!React) {
    throw new Error('useEnhancedQuery must be used in a React component');
  }

  const [result, setResult] = (React as any).useState(null);
  const [isLoading, setIsLoading] = (React as any).useState(false);
  const [loadingDuration, setLoadingDuration] = (React as any).useState(0);

  const execute = React.useCallback(async () => {
    setIsLoading(true);
    const startTime = Date.now();
    
    // Update loading duration periodically
    const durationInterval = setInterval(() => {
      setLoadingDuration(Date.now() - startTime);
    }, 100);

    try {
      const queryResult = await executeEnhancedQuery(queryOperation, context, options);
      setResult(queryResult);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        totalDuration: Date.now() - startTime
      });
    } finally {
      clearInterval(durationInterval);
      setIsLoading(false);
      setLoadingDuration(0);
    }
  }, [queryOperation, context, options, ...dependencies]);

  // Auto-execute on mount and dependency changes
  React.useEffect(() => {
    execute();
  }, [execute]);

  return {
    result,
    isLoading,
    loadingDuration,
    execute,
    retry: execute
  };
}