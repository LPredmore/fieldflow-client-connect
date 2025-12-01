/**
 * Network Resilience Manager - Production Implementation
 * Coordinates retry engine and quality monitor with caching and fallback strategies
 */

import { retryEngine, type RetryConfig } from './retryEngine';
import { networkQualityMonitor, type NetworkQuality } from './networkQualityMonitor';

export type DataSource = 'network' | 'cache' | 'fallback';

export interface QueryResult<T> {
  data: T | null;
  source: DataSource;
  retryCount: number;
  timestamp: number;
  error: Error | null;
  networkQuality?: NetworkQuality;
  fromCache?: boolean;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface ResilienceConfig extends RetryConfig {
  enableCache?: boolean;
  cacheTTL?: number;
  fallbackData?: any;
  requireFreshData?: boolean;
}

class NetworkResilienceManager {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultCacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Start monitoring network quality
    networkQualityMonitor.startMonitoring();
  }

  /**
   * Generate cache key from function and arguments
   */
  private generateCacheKey(operation: string, args?: any[]): string {
    const argsStr = args ? JSON.stringify(args) : '';
    return `${operation}_${argsStr}`;
  }

  /**
   * Get data from cache if valid
   */
  private getFromCache<T>(cacheKey: string): T | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    // Check if cache entry is still valid
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Store data in cache
   */
  private storeInCache<T>(cacheKey: string, data: T, ttl: number) {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Check if network is healthy enough to execute query
   */
  isNetworkHealthy(): boolean {
    const quality = networkQualityMonitor.getQuality();
    return quality.status !== 'offline' && quality.status !== 'poor';
  }

  /**
   * Determine if we should use cache based on network quality
   */
  private shouldUseCache(): boolean {
    const quality = networkQualityMonitor.getQuality();
    return quality.status === 'poor' || quality.status === 'offline';
  }

  /**
   * Get retry config adjusted for network quality
   */
  private getAdaptiveRetryConfig(config: ResilienceConfig = {}): RetryConfig {
    const quality = networkQualityMonitor.getQuality();
    const baseConfig = { ...config };

    // Adjust retry strategy based on network quality
    if (quality.status === 'poor') {
      baseConfig.maxRetries = Math.min(config.maxRetries || 2, 2);
      baseConfig.baseDelay = Math.max(config.baseDelay || 2000, 2000);
    } else if (quality.status === 'fair') {
      baseConfig.maxRetries = config.maxRetries || 3;
      baseConfig.baseDelay = config.baseDelay || 1000;
    } else {
      baseConfig.maxRetries = config.maxRetries || 3;
      baseConfig.baseDelay = config.baseDelay || 500;
    }

    return baseConfig;
  }

  /**
   * Execute a query with full resilience features
   */
  async executeQuery<T>(
    fn: () => Promise<T>,
    config: ResilienceConfig = {},
    operationKey: string = 'default'
  ): Promise<QueryResult<T>> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(operationKey);
    const enableCache = config.enableCache !== false;
    const cacheTTL = config.cacheTTL || this.defaultCacheTTL;
    
    networkQualityMonitor.recordRequest();

    // Try cache first if network is poor or cache is preferred
    if (enableCache && this.shouldUseCache()) {
      const cachedData = this.getFromCache<T>(cacheKey);
      if (cachedData !== null) {
        return {
          data: cachedData,
          source: 'cache',
          retryCount: 0,
          timestamp: Date.now(),
          error: null,
          networkQuality: networkQualityMonitor.getQuality().status,
          fromCache: true,
        };
      }
    }

    // Execute with retry logic
    const retryConfig = this.getAdaptiveRetryConfig(config);
    const result = await retryEngine.executeWithRetry(fn, retryConfig, operationKey);

    if (result.success && result.data !== undefined) {
      // Success - cache the result
      networkQualityMonitor.recordSuccess(startTime);
      
      if (enableCache) {
        this.storeInCache(cacheKey, result.data, cacheTTL);
      }

      return {
        data: result.data,
        source: 'network',
        retryCount: result.attempts,
        timestamp: Date.now(),
        error: null,
        networkQuality: networkQualityMonitor.getQuality().status,
      };
    }

    // Failed - try fallback strategies
    networkQualityMonitor.recordFailure(startTime, result.error!);

    // Try cache as fallback
    if (enableCache && !config.requireFreshData) {
      const cachedData = this.getFromCache<T>(cacheKey);
      if (cachedData !== null) {
        return {
          data: cachedData,
          source: 'cache',
          retryCount: result.attempts,
          timestamp: Date.now(),
          error: result.error || null,
          networkQuality: networkQualityMonitor.getQuality().status,
          fromCache: true,
        };
      }
    }

    // Try configured fallback data
    if (config.fallbackData !== undefined) {
      return {
        data: config.fallbackData,
        source: 'fallback',
        retryCount: result.attempts,
        timestamp: Date.now(),
        error: result.error || null,
        networkQuality: networkQualityMonitor.getQuality().status,
      };
    }

    // No fallback available
    return {
      data: null,
      source: 'network',
      retryCount: result.attempts,
      timestamp: Date.now(),
      error: result.error || new Error('Query failed'),
      networkQuality: networkQualityMonitor.getQuality().status,
    };
  }

  /**
   * Invalidate cache for a specific operation
   */
  invalidateCache(operationKey: string) {
    const cacheKey = this.generateCacheKey(operationKey);
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  /**
   * Record successful operation (for manual tracking)
   */
  recordSuccess() {
    // Already handled in executeQuery
  }

  /**
   * Record failed operation (for manual tracking)
   */
  recordFailure() {
    // Already handled in executeQuery
  }

  /**
   * Get system health status
   */
  getHealthStatus() {
    const networkQuality = networkQualityMonitor.getQuality();
    const networkStats = networkQualityMonitor.getStats();
    const retryStats = retryEngine.getStats();

    return {
      network: {
        quality: networkQuality.status,
        metrics: networkQuality.metrics,
        isOnline: networkQualityMonitor.isOnline(),
        stats: networkStats,
      },
      retry: retryStats,
      cache: this.getCacheStats(),
    };
  }
}

// Export singleton instance
export const networkResilienceManager = new NetworkResilienceManager();
