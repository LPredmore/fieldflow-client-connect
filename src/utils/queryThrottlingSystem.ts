/**
 * Query Throttling System
 * 
 * Implements request rate limiting and throttling for non-critical queries
 * during high load conditions with comprehensive metrics and monitoring.
 */

import { QueryPriority } from './queryPrioritySystem';

export interface ThrottleConfig {
  maxRequestsPerSecond: number;
  burstLimit: number;
  throttleNonCritical: boolean;
  adaptiveThrottling: boolean;
  windowSizeMs: number;
}

export interface ThrottleMetrics {
  totalRequests: number;
  throttledRequests: number;
  currentRate: number;
  averageRate: number;
  throttleRatio: number;
  lastThrottleTime?: number;
  windowStart: number;
  windowEnd: number;
  requestsByPriority: Record<QueryPriority, number>;
  throttledByPriority: Record<QueryPriority, number>;
}

export interface RequestInfo {
  id: string;
  timestamp: number;
  priority: QueryPriority;
  table: string;
  throttled: boolean;
}

/**
 * Token Bucket implementation for rate limiting
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume tokens from bucket
   */
  tryConsume(tokens: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Get current token count
   */
  getTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Get bucket status
   */
  getStatus(): { tokens: number; capacity: number; refillRate: number } {
    return {
      tokens: this.getTokens(),
      capacity: this.capacity,
      refillRate: this.refillRate
    };
  }
}

/**
 * Sliding Window Rate Limiter
 */
class SlidingWindowRateLimiter {
  private requests: number[] = [];
  private readonly windowSizeMs: number;
  private readonly maxRequests: number;

  constructor(maxRequests: number, windowSizeMs: number) {
    this.maxRequests = maxRequests;
    this.windowSizeMs = windowSizeMs;
  }

  /**
   * Check if request is allowed
   */
  isAllowed(): boolean {
    const now = Date.now();
    this.cleanOldRequests(now);
    
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    
    return false;
  }

  /**
   * Remove requests outside the window
   */
  private cleanOldRequests(now: number): void {
    const cutoff = now - this.windowSizeMs;
    this.requests = this.requests.filter(timestamp => timestamp > cutoff);
  }

  /**
   * Get current request count in window
   */
  getCurrentCount(): number {
    this.cleanOldRequests(Date.now());
    return this.requests.length;
  }

  /**
   * Get rate (requests per second)
   */
  getCurrentRate(): number {
    const count = this.getCurrentCount();
    return (count / this.windowSizeMs) * 1000;
  }
}

/**
 * Adaptive Throttling Manager
 */
class AdaptiveThrottlingManager {
  private systemLoadHistory: number[] = [];
  private readonly maxHistorySize = 60; // 1 minute of history
  private baseThrottleThreshold = 0.7; // 70% system load

  /**
   * Update system load metrics
   */
  updateSystemLoad(
    activeQueries: number,
    queueSize: number,
    averageResponseTime: number
  ): void {
    // Calculate normalized system load (0-1)
    const queryLoad = Math.min(1, activeQueries / 10); // Normalize to max 10 concurrent
    const queueLoad = Math.min(1, queueSize / 50); // Normalize to max 50 queued
    const responseLoad = Math.min(1, averageResponseTime / 5000); // Normalize to 5s max
    
    const systemLoad = (queryLoad + queueLoad + responseLoad) / 3;
    
    this.systemLoadHistory.push(systemLoad);
    if (this.systemLoadHistory.length > this.maxHistorySize) {
      this.systemLoadHistory.shift();
    }
  }

  /**
   * Determine if throttling should be more aggressive
   */
  shouldIncreaseThrottling(): boolean {
    if (this.systemLoadHistory.length < 5) return false;
    
    const recentLoad = this.systemLoadHistory.slice(-5);
    const averageLoad = recentLoad.reduce((sum, load) => sum + load, 0) / recentLoad.length;
    
    return averageLoad > this.baseThrottleThreshold;
  }

  /**
   * Get adaptive throttle multiplier
   */
  getThrottleMultiplier(): number {
    if (this.systemLoadHistory.length === 0) return 1;
    
    const currentLoad = this.systemLoadHistory[this.systemLoadHistory.length - 1];
    
    if (currentLoad < 0.5) return 0.5; // Less throttling when load is low
    if (currentLoad > 0.8) return 2.0; // More throttling when load is high
    
    return 1.0; // Normal throttling
  }

  /**
   * Get system load status
   */
  getSystemLoadStatus(): {
    currentLoad: number;
    averageLoad: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  } {
    if (this.systemLoadHistory.length === 0) {
      return { currentLoad: 0, averageLoad: 0, trend: 'stable' };
    }

    const currentLoad = this.systemLoadHistory[this.systemLoadHistory.length - 1];
    const averageLoad = this.systemLoadHistory.reduce((sum, load) => sum + load, 0) / this.systemLoadHistory.length;
    
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (this.systemLoadHistory.length >= 3) {
      const recent = this.systemLoadHistory.slice(-3);
      const isIncreasing = recent[2] > recent[1] && recent[1] > recent[0];
      const isDecreasing = recent[2] < recent[1] && recent[1] < recent[0];
      
      if (isIncreasing) trend = 'increasing';
      else if (isDecreasing) trend = 'decreasing';
    }

    return { currentLoad, averageLoad, trend };
  }
}

/**
 * Query Throttling Manager
 */
export class QueryThrottlingManager {
  private static instance: QueryThrottlingManager;
  private config: ThrottleConfig;
  private tokenBucket: TokenBucket;
  private slidingWindow: SlidingWindowRateLimiter;
  private adaptiveManager: AdaptiveThrottlingManager;
  private metrics: ThrottleMetrics;
  private requestHistory: RequestInfo[] = [];
  private readonly maxHistorySize = 1000;

  private constructor(config: Partial<ThrottleConfig> = {}) {
    this.config = {
      maxRequestsPerSecond: 10,
      burstLimit: 20,
      throttleNonCritical: true,
      adaptiveThrottling: true,
      windowSizeMs: 1000,
      ...config
    };

    this.tokenBucket = new TokenBucket(
      this.config.burstLimit,
      this.config.maxRequestsPerSecond
    );

    this.slidingWindow = new SlidingWindowRateLimiter(
      this.config.maxRequestsPerSecond,
      this.config.windowSizeMs
    );

    this.adaptiveManager = new AdaptiveThrottlingManager();

    this.metrics = this.initializeMetrics();
  }

  static getInstance(config?: Partial<ThrottleConfig>): QueryThrottlingManager {
    if (!QueryThrottlingManager.instance) {
      QueryThrottlingManager.instance = new QueryThrottlingManager(config);
    }
    return QueryThrottlingManager.instance;
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): ThrottleMetrics {
    const now = Date.now();
    return {
      totalRequests: 0,
      throttledRequests: 0,
      currentRate: 0,
      averageRate: 0,
      throttleRatio: 0,
      windowStart: now,
      windowEnd: now + this.config.windowSizeMs,
      requestsByPriority: {
        [QueryPriority.CRITICAL]: 0,
        [QueryPriority.HIGH]: 0,
        [QueryPriority.MEDIUM]: 0,
        [QueryPriority.LOW]: 0,
      },
      throttledByPriority: {
        [QueryPriority.CRITICAL]: 0,
        [QueryPriority.HIGH]: 0,
        [QueryPriority.MEDIUM]: 0,
        [QueryPriority.LOW]: 0,
      }
    };
  }

  /**
   * Check if request should be throttled
   */
  shouldThrottle(
    requestId: string,
    priority: QueryPriority,
    table: string
  ): { throttled: boolean; reason?: string; retryAfter?: number } {
    const now = Date.now();
    
    // Never throttle CRITICAL priority requests
    if (priority === QueryPriority.CRITICAL) {
      this.recordRequest(requestId, priority, table, false);
      return { throttled: false };
    }

    // Check token bucket (burst protection)
    const tokensAvailable = this.tokenBucket.tryConsume(1);
    if (!tokensAvailable) {
      this.recordRequest(requestId, priority, table, true);
      return {
        throttled: true,
        reason: 'Rate limit exceeded (burst protection)',
        retryAfter: 100 // 100ms
      };
    }

    // Check sliding window rate limit
    const windowAllowed = this.slidingWindow.isAllowed();
    if (!windowAllowed) {
      this.recordRequest(requestId, priority, table, true);
      return {
        throttled: true,
        reason: 'Rate limit exceeded (sliding window)',
        retryAfter: Math.ceil(this.config.windowSizeMs / this.config.maxRequestsPerSecond)
      };
    }

    // Adaptive throttling for non-critical requests
    if (this.config.adaptiveThrottling && priority >= QueryPriority.MEDIUM) {
      const throttleMultiplier = this.adaptiveManager.getThrottleMultiplier();
      
      if (throttleMultiplier > 1.5 && Math.random() < (throttleMultiplier - 1)) {
        this.recordRequest(requestId, priority, table, true);
        return {
          throttled: true,
          reason: 'Adaptive throttling (high system load)',
          retryAfter: Math.ceil(200 * throttleMultiplier)
        };
      }
    }

    // Throttle LOW priority requests more aggressively
    if (priority === QueryPriority.LOW && this.config.throttleNonCritical) {
      const currentRate = this.slidingWindow.getCurrentRate();
      const maxRate = this.config.maxRequestsPerSecond;
      
      if (currentRate > maxRate * 0.7) { // 70% of max rate
        this.recordRequest(requestId, priority, table, true);
        return {
          throttled: true,
          reason: 'Low priority throttling',
          retryAfter: 500
        };
      }
    }

    this.recordRequest(requestId, priority, table, false);
    return { throttled: false };
  }

  /**
   * Record request for metrics
   */
  private recordRequest(
    requestId: string,
    priority: QueryPriority,
    table: string,
    throttled: boolean
  ): void {
    const now = Date.now();
    
    const requestInfo: RequestInfo = {
      id: requestId,
      timestamp: now,
      priority,
      table,
      throttled
    };

    this.requestHistory.push(requestInfo);
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory.shift();
    }

    // Update metrics
    this.metrics.totalRequests++;
    this.metrics.requestsByPriority[priority]++;
    
    if (throttled) {
      this.metrics.throttledRequests++;
      this.metrics.throttledByPriority[priority]++;
      this.metrics.lastThrottleTime = now;
    }

    this.updateMetrics();
  }

  /**
   * Update calculated metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowSizeMs;
    
    // Filter requests in current window
    const windowRequests = this.requestHistory.filter(
      req => req.timestamp > windowStart
    );

    this.metrics.currentRate = (windowRequests.length / this.config.windowSizeMs) * 1000;
    this.metrics.averageRate = this.requestHistory.length > 0 
      ? (this.requestHistory.length / (now - this.requestHistory[0].timestamp)) * 1000
      : 0;
    
    this.metrics.throttleRatio = this.metrics.totalRequests > 0
      ? this.metrics.throttledRequests / this.metrics.totalRequests
      : 0;

    this.metrics.windowStart = windowStart;
    this.metrics.windowEnd = now;
  }

  /**
   * Update system load for adaptive throttling
   */
  updateSystemLoad(
    activeQueries: number,
    queueSize: number,
    averageResponseTime: number
  ): void {
    this.adaptiveManager.updateSystemLoad(activeQueries, queueSize, averageResponseTime);
  }

  /**
   * Get throttling metrics
   */
  getMetrics(): ThrottleMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get detailed throttling status
   */
  getStatus(): {
    config: ThrottleConfig;
    metrics: ThrottleMetrics;
    tokenBucket: ReturnType<TokenBucket['getStatus']>;
    systemLoad: ReturnType<AdaptiveThrottlingManager['getSystemLoadStatus']>;
    recentRequests: RequestInfo[];
  } {
    const recentRequests = this.requestHistory
      .filter(req => req.timestamp > Date.now() - 10000) // Last 10 seconds
      .slice(-20); // Last 20 requests

    return {
      config: this.config,
      metrics: this.getMetrics(),
      tokenBucket: this.tokenBucket.getStatus(),
      systemLoad: this.adaptiveManager.getSystemLoadStatus(),
      recentRequests
    };
  }

  /**
   * Update throttling configuration
   */
  updateConfig(updates: Partial<ThrottleConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Recreate token bucket if rate limits changed
    if (updates.maxRequestsPerSecond || updates.burstLimit) {
      this.tokenBucket = new TokenBucket(
        this.config.burstLimit,
        this.config.maxRequestsPerSecond
      );
    }

    // Recreate sliding window if window size changed
    if (updates.windowSizeMs || updates.maxRequestsPerSecond) {
      this.slidingWindow = new SlidingWindowRateLimiter(
        this.config.maxRequestsPerSecond,
        this.config.windowSizeMs
      );
    }
  }

  /**
   * Reset throttling state
   */
  reset(): void {
    this.tokenBucket = new TokenBucket(
      this.config.burstLimit,
      this.config.maxRequestsPerSecond
    );
    
    this.slidingWindow = new SlidingWindowRateLimiter(
      this.config.maxRequestsPerSecond,
      this.config.windowSizeMs
    );
    
    this.metrics = this.initializeMetrics();
    this.requestHistory = [];
  }

  /**
   * Get throttling recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const status = this.getStatus();
    
    if (status.metrics.throttleRatio > 0.2) {
      recommendations.push('High throttle ratio detected. Consider increasing rate limits or optimizing queries.');
    }
    
    if (status.systemLoad.currentLoad > 0.8) {
      recommendations.push('High system load detected. Consider implementing query batching or caching.');
    }
    
    if (status.metrics.throttledByPriority[QueryPriority.HIGH] > 0) {
      recommendations.push('High priority queries are being throttled. Review system capacity.');
    }
    
    const lowPriorityRatio = status.metrics.throttledByPriority[QueryPriority.LOW] / 
      Math.max(1, status.metrics.requestsByPriority[QueryPriority.LOW]);
    
    if (lowPriorityRatio < 0.1) {
      recommendations.push('Low priority throttling is minimal. Consider more aggressive throttling for better resource allocation.');
    }
    
    return recommendations;
  }
}

// Export singleton instance
export const queryThrottlingManager = QueryThrottlingManager.getInstance();