/**
 * Progressive Error Recovery System
 * 
 * Implements multi-level fallback strategies for query failures with
 * graceful degradation and user-friendly error handling.
 */

import { ErrorType } from './circuitBreaker';
import { enhancedQueryCache } from './enhancedQueryCache';

export enum FallbackLevel {
  CACHE_STALE = 1,         // Use stale cache data
  CACHE_EXPIRED = 2,       // Use expired cache with warning
  OFFLINE_MODE = 3,        // Use local storage backup
  GRACEFUL_DEGRADATION = 4 // Show empty state with retry
}

export interface ErrorRecoveryStrategy {
  level: FallbackLevel;
  action: () => Promise<any>;
  userMessage: string;
  retryable: boolean;
  retryDelay: number;
  showCacheIndicator?: boolean;
}

export interface QueryContext {
  table: string;
  cacheKey: string;
  userId?: string;
  tenantId?: string;
  isAuthRequired: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
  originalQuery: () => Promise<any>;
}

export interface ErrorRecoveryResult {
  success: boolean;
  data?: any;
  level: FallbackLevel;
  userMessage?: string;
  showCacheIndicator?: boolean;
  retryable?: boolean;
  retryDelay?: number;
}

export class ProgressiveErrorRecovery {
  private static instance: ProgressiveErrorRecovery;
  private recoveryAttempts = new Map<string, number>();
  private lastRecoveryTime = new Map<string, number>();

  static getInstance(): ProgressiveErrorRecovery {
    if (!ProgressiveErrorRecovery.instance) {
      ProgressiveErrorRecovery.instance = new ProgressiveErrorRecovery();
    }
    return ProgressiveErrorRecovery.instance;
  }

  /**
   * Handle query error with progressive fallback strategies
   */
  async handleQueryError(
    error: any, 
    context: QueryContext
  ): Promise<ErrorRecoveryResult> {
    const errorType = this.classifyError(error);
    const strategies = this.getRecoveryStrategies(errorType, context);
    
    console.log(`🔄 Progressive error recovery for ${context.table}:`, {
      errorType,
      strategiesCount: strategies.length,
      cacheKey: context.cacheKey
    });

    // Track recovery attempts for this context
    const attemptKey = `${context.table}-${context.cacheKey}`;
    const currentAttempts = this.recoveryAttempts.get(attemptKey) || 0;
    this.recoveryAttempts.set(attemptKey, currentAttempts + 1);
    this.lastRecoveryTime.set(attemptKey, Date.now());

    // Try each recovery strategy in order
    for (const strategy of strategies) {
      try {
        console.log(`🔄 Attempting recovery level ${strategy.level}: ${FallbackLevel[strategy.level]}`);
        
        const result = await strategy.action();
        
        // Reset recovery attempts on success
        this.recoveryAttempts.delete(attemptKey);
        
        return {
          success: true,
          data: result,
          level: strategy.level,
          userMessage: strategy.userMessage,
          showCacheIndicator: strategy.showCacheIndicator,
          retryable: strategy.retryable,
          retryDelay: strategy.retryDelay
        };
      } catch (fallbackError) {
        console.warn(`❌ Fallback level ${strategy.level} failed:`, fallbackError);
        
        // Continue to next strategy
        continue;
      }
    }
    
    // All strategies failed - return graceful degradation
    return {
      success: false,
      level: FallbackLevel.GRACEFUL_DEGRADATION,
      userMessage: this.getGracefulDegradationMessage(errorType, context),
      retryable: this.isRetryableError(errorType),
      retryDelay: this.calculateRetryDelay(currentAttempts)
    };
  }

  /**
   * Get recovery strategies based on error type and context
   */
  private getRecoveryStrategies(
    errorType: ErrorType, 
    context: QueryContext
  ): ErrorRecoveryStrategy[] {
    const strategies: ErrorRecoveryStrategy[] = [];

    // Strategy 1: Try stale cache data
    if (this.canUseStaleCache(context)) {
      strategies.push({
        level: FallbackLevel.CACHE_STALE,
        action: () => this.getStaleCache(context),
        userMessage: "Showing recent data while reconnecting...",
        retryable: true,
        retryDelay: 2000,
        showCacheIndicator: true
      });
    }

    // Strategy 2: Try expired cache data (for non-critical errors)
    if (this.canUseExpiredCache(errorType, context)) {
      strategies.push({
        level: FallbackLevel.CACHE_EXPIRED,
        action: () => this.getExpiredCache(context),
        userMessage: "Showing older data - some information may be outdated",
        retryable: true,
        retryDelay: 5000,
        showCacheIndicator: true
      });
    }

    // Strategy 3: Try offline mode (local storage backup)
    if (this.canUseOfflineMode(errorType, context)) {
      strategies.push({
        level: FallbackLevel.OFFLINE_MODE,
        action: () => this.getOfflineData(context),
        userMessage: "Working offline - changes will sync when connection is restored",
        retryable: true,
        retryDelay: 10000,
        showCacheIndicator: true
      });
    }

    return strategies;
  }

  /**
   * Classify error type for recovery strategy selection
   */
  private classifyError(error: any): ErrorType {
    const message = error?.message || String(error);
    
    // Network errors - most recoverable
    if (message.includes('fetch') || 
        message.includes('network') || 
        message.includes('connection') ||
        message.includes('ECONNREFUSED') ||
        message.includes('ENOTFOUND')) {
      return ErrorType.NETWORK_ERROR;
    }
    
    // Timeout errors - recoverable with retry
    if (message.includes('timeout') || 
        message.includes('aborted') ||
        (error instanceof Error && error.name === 'AbortError')) {
      return ErrorType.TIMEOUT_ERROR;
    }
    
    // Permission errors - may need auth refresh
    if (message.includes('permission') || 
        message.includes('unauthorized') || 
        message.includes('forbidden') ||
        message.includes('access denied')) {
      return ErrorType.PERMISSION_ERROR;
    }
    
    // Policy errors - need special handling
    if (message.includes('infinite recursion detected in policy') ||
        message.includes('infinite recursion') ||
        message.includes('Query timeout - possible infinite recursion')) {
      return ErrorType.POLICY_INFINITE_RECURSION;
    }
    
    if (message.includes('circular dependency') ||
        message.includes('policy dependency cycle')) {
      return ErrorType.POLICY_CIRCULAR_DEPENDENCY;
    }
    
    if (message.includes('policy evaluation failed') ||
        message.includes('RLS policy error')) {
      return ErrorType.POLICY_EVALUATION_ERROR;
    }
    
    // Schema errors - not recoverable with cache
    if (message.includes('column') && 
        (message.includes('does not exist') || message.includes('not found'))) {
      return ErrorType.SCHEMA_MISMATCH;
    }
    
    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * Check if stale cache can be used
   */
  private canUseStaleCache(context: QueryContext): boolean {
    const cacheEntry = enhancedQueryCache.get(context.cacheKey);
    if (!cacheEntry.hit || !cacheEntry.data) {
      return false;
    }
    
    // Allow stale cache for non-critical data
    const maxStaleAge = context.priority === 'critical' ? 300000 : 600000; // 5-10 minutes
    const cacheData = cacheEntry.data as any;
    const age = Date.now() - (cacheData?.timestamp || 0);
    
    return age < maxStaleAge;
  }

  /**
   * Check if expired cache can be used
   */
  private canUseExpiredCache(errorType: ErrorType, context: QueryContext): boolean {
    // Don't use expired cache for schema or policy errors
    if (errorType === ErrorType.SCHEMA_MISMATCH || 
        errorType === ErrorType.POLICY_INFINITE_RECURSION ||
        errorType === ErrorType.POLICY_CIRCULAR_DEPENDENCY) {
      return false;
    }
    
    const cacheEntry = enhancedQueryCache.get(context.cacheKey);
    if (!cacheEntry.hit || !cacheEntry.data) {
      return false;
    }
    
    // Allow expired cache for network/timeout errors
    const maxExpiredAge = 1800000; // 30 minutes
    const cacheData = cacheEntry.data as any;
    const age = Date.now() - (cacheData?.timestamp || 0);
    
    return age < maxExpiredAge;
  }

  /**
   * Check if offline mode can be used
   */
  private canUseOfflineMode(errorType: ErrorType, context: QueryContext): boolean {
    // Only for network errors and non-auth-required queries
    return (errorType === ErrorType.NETWORK_ERROR || 
            errorType === ErrorType.TIMEOUT_ERROR) &&
           !context.isAuthRequired;
  }

  /**
   * Get stale cache data
   */
  private async getStaleCache(context: QueryContext): Promise<any> {
    const cacheEntry = enhancedQueryCache.get(context.cacheKey);
    if (!cacheEntry.hit || !cacheEntry.data) {
      throw new Error('No stale cache available');
    }
    
    const cacheData = cacheEntry.data as any;
    console.log(`📦 Using stale cache for ${context.table}, age: ${Date.now() - (cacheData?.timestamp || 0)}ms`);
    return cacheData?.data || cacheEntry.data;
  }

  /**
   * Get expired cache data
   */
  private async getExpiredCache(context: QueryContext): Promise<any> {
    const cacheEntry = enhancedQueryCache.get(context.cacheKey);
    if (!cacheEntry.hit || !cacheEntry.data) {
      throw new Error('No expired cache available');
    }
    
    const cacheData = cacheEntry.data as any;
    console.log(`📦 Using expired cache for ${context.table}, age: ${Date.now() - (cacheData?.timestamp || 0)}ms`);
    return cacheData?.data || cacheEntry.data;
  }

  /**
   * Get offline data from local storage
   */
  private async getOfflineData(context: QueryContext): Promise<any> {
    try {
      const offlineKey = `offline_${context.table}_${context.userId || 'anonymous'}`;
      const offlineData = localStorage.getItem(offlineKey);
      
      if (!offlineData) {
        throw new Error('No offline data available');
      }
      
      const parsed = JSON.parse(offlineData);
      console.log(`💾 Using offline data for ${context.table}`);
      return parsed.data;
    } catch (error) {
      throw new Error('Failed to retrieve offline data');
    }
  }

  /**
   * Get graceful degradation message based on error type
   */
  private getGracefulDegradationMessage(errorType: ErrorType, context: QueryContext): string {
    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
        return "Unable to connect to the server. Please check your internet connection and try again.";
      
      case ErrorType.TIMEOUT_ERROR:
        return "The request is taking longer than expected. Please try again.";
      
      case ErrorType.PERMISSION_ERROR:
        return "You don't have permission to access this data. Please contact your administrator.";
      
      case ErrorType.POLICY_INFINITE_RECURSION:
      case ErrorType.POLICY_CIRCULAR_DEPENDENCY:
      case ErrorType.POLICY_EVALUATION_ERROR:
        return "There's a temporary issue with data access. Our team has been notified.";
      
      case ErrorType.SCHEMA_MISMATCH:
        return "There's a compatibility issue with the data structure. Please refresh the page.";
      
      default:
        return `Unable to load ${context.table} data. Please try again or contact support if the problem persists.`;
    }
  }

  /**
   * Check if error type is retryable
   */
  private isRetryableError(errorType: ErrorType): boolean {
    return [
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.UNKNOWN_ERROR
    ].includes(errorType);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attemptCount: number): number {
    // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
    const baseDelay = 2000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000;
    return delay + jitter;
  }

  /**
   * Store data for offline use
   */
  storeOfflineData(table: string, data: any, userId?: string): void {
    try {
      const offlineKey = `offline_${table}_${userId || 'anonymous'}`;
      const offlineData = {
        data,
        timestamp: Date.now(),
        table
      };
      
      localStorage.setItem(offlineKey, JSON.stringify(offlineData));
      console.log(`💾 Stored offline data for ${table}`);
    } catch (error) {
      console.warn('Failed to store offline data:', error);
    }
  }

  /**
   * Clear recovery attempts for a context (call on successful query)
   */
  clearRecoveryAttempts(table: string, cacheKey: string): void {
    const attemptKey = `${table}-${cacheKey}`;
    this.recoveryAttempts.delete(attemptKey);
    this.lastRecoveryTime.delete(attemptKey);
  }

  /**
   * Get recovery statistics for monitoring
   */
  getRecoveryStats() {
    const now = Date.now();
    const recentRecoveries = Array.from(this.lastRecoveryTime.entries())
      .filter(([_, timestamp]) => now - timestamp < 300000) // Last 5 minutes
      .length;

    return {
      activeRecoveries: this.recoveryAttempts.size,
      recentRecoveries,
      totalAttempts: Array.from(this.recoveryAttempts.values())
        .reduce((sum, attempts) => sum + attempts, 0)
    };
  }
}

// Export singleton instance
export const progressiveErrorRecovery = ProgressiveErrorRecovery.getInstance();