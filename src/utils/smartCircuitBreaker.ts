/**
 * Smart Circuit Breaker with Performance Optimization
 * 
 * Extends the basic circuit breaker with cache-aware logic, progressive timeouts,
 * and adaptive thresholds based on performance history.
 */

import { CircuitBreaker, ErrorType } from './circuitBreaker';
import { circuitBreakerMonitor } from './circuitBreakerMonitor';
import { enhancedQueryCache, CacheResult } from './enhancedQueryCache';

export interface SmartCircuitBreakerConfig {
  /** Base failure threshold before opening circuit */
  failureThreshold: number;
  /** Base reset timeout in milliseconds */
  resetTimeout: number;
  /** Monitoring period for performance metrics */
  monitoringPeriod: number;
  /** Enable progressive timeout adjustments */
  progressiveTimeouts: boolean;
  /** Grace period for serving cached data when circuit is open */
  cacheGracePeriod: number;
  /** Weights for different error types in failure calculation */
  errorTypeWeights: Record<ErrorType, number>;
  /** Enable adaptive threshold adjustments */
  adaptiveThresholds: boolean;
  /** Maximum timeout multiplier for progressive timeouts */
  maxTimeoutMultiplier: number;
  /** Minimum performance threshold for adaptive adjustments */
  performanceThreshold: number;
  /** Progressive timeout configuration */
  progressiveTimeoutConfig: ProgressiveTimeoutConfig;
  /** System load monitoring configuration */
  loadMonitoringConfig: LoadMonitoringConfig;
}

export interface PerformanceMetric {
  /** Timestamp of the metric */
  timestamp: number;
  /** Query duration in milliseconds */
  duration: number;
  /** Whether the operation was successful */
  success: boolean;
  /** Error type if operation failed */
  errorType?: ErrorType;
  /** Whether cache was available for this operation */
  cacheAvailable: boolean;
  /** Cache age if cache was used */
  cacheAge?: number;
  /** Table name for the query */
  table?: string;
}

export interface AdaptiveThresholds {
  /** Current failure threshold (may be adjusted) */
  currentFailureThreshold: number;
  /** Current reset timeout (may be adjusted) */
  currentResetTimeout: number;
  /** Performance trend indicator */
  performanceTrend: 'improving' | 'stable' | 'degrading';
  /** Last adjustment timestamp */
  lastAdjustment: number;
  /** Number of adjustments made */
  adjustmentCount: number;
}

export interface ProgressiveTimeoutConfig {
  /** Enable progressive timeout increases */
  enabled: boolean;
  /** Base timeout multiplier steps */
  timeoutSteps: number[];
  /** Performance thresholds for each step */
  performanceThresholds: number[];
  /** Maximum consecutive failures before max timeout */
  maxConsecutiveFailures: number;
  /** Cooldown period before reducing timeout */
  cooldownPeriod: number;
}

export interface LoadMonitoringConfig {
  /** Enable system load monitoring */
  enabled: boolean;
  /** CPU usage threshold for load detection */
  cpuThreshold: number;
  /** Memory usage threshold for load detection */
  memoryThreshold: number;
  /** Active query count threshold */
  activeQueryThreshold: number;
  /** Load monitoring interval in ms */
  monitoringInterval: number;
}

export interface SystemLoadMetrics {
  /** Current CPU usage percentage (estimated) */
  cpuUsage: number;
  /** Current memory usage percentage (estimated) */
  memoryUsage: number;
  /** Number of active queries */
  activeQueries: number;
  /** Average query duration in last minute */
  avgQueryDuration: number;
  /** System load level */
  loadLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Timestamp of last measurement */
  timestamp: number;
}

/**
 * Smart Circuit Breaker that serves cached data when open and adapts to performance
 */
export class SmartCircuitBreaker extends CircuitBreaker {
  private performanceHistory: PerformanceMetric[] = [];
  private adaptiveThresholds: AdaptiveThresholds;
  private config: SmartCircuitBreakerConfig;
  private maxPerformanceHistory = 100;
  private systemLoadMetrics: SystemLoadMetrics;
  private consecutiveFailures = 0;
  private lastSuccessTime = Date.now();
  private currentTimeoutStep = 0;
  private loadMonitoringInterval?: NodeJS.Timeout;

  constructor(config: SmartCircuitBreakerConfig) {
    // Initialize base circuit breaker with initial config
    super({
      failureThreshold: config.failureThreshold,
      resetTimeout: config.resetTimeout,
      monitoringPeriod: config.monitoringPeriod
    });

    this.config = config;
    this.adaptiveThresholds = {
      currentFailureThreshold: config.failureThreshold,
      currentResetTimeout: config.resetTimeout,
      performanceTrend: 'stable',
      lastAdjustment: Date.now(),
      adjustmentCount: 0
    };

    this.systemLoadMetrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      activeQueries: 0,
      avgQueryDuration: 0,
      loadLevel: 'low',
      timestamp: Date.now()
    };

    // Start load monitoring if enabled
    if (config.loadMonitoringConfig.enabled) {
      this.startLoadMonitoring();
    }

    console.log('🧠 Smart Circuit Breaker initialized with adaptive features', {
      progressiveTimeouts: config.progressiveTimeouts,
      adaptiveThresholds: config.adaptiveThresholds,
      cacheGracePeriod: config.cacheGracePeriod,
      loadMonitoring: config.loadMonitoringConfig.enabled
    });
  }

  /**
   * Execute operation with smart circuit breaker logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    cacheKey?: string,
    table?: string,
    bypassCircuitBreaker?: boolean
  ): Promise<T> {
    const startTime = performance.now();
    const cacheResult = cacheKey ? enhancedQueryCache.get<T>(cacheKey) : null;
    const cacheAvailable = cacheResult?.hit || false;

    // Bypass circuit breaker for critical operations (like authentication)
    if (bypassCircuitBreaker) {
      console.log(`🔓 Smart Circuit Breaker: Bypassing circuit breaker for critical operation`, { table, cacheKey });
      try {
        const result = await operation();
        const duration = performance.now() - startTime;
        this.updatePerformanceMetrics(duration, true, undefined, cacheAvailable, cacheResult?.age, table);
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        const errorInfo = CircuitBreaker.classifyError(error);
        this.updatePerformanceMetrics(duration, false, errorInfo.type, cacheAvailable, cacheResult?.age, table);
        throw error;
      }
    }

    // Check if we should allow the request or serve from cache
    if (!this.shouldAllowRequest(cacheAvailable)) {
      if (this.shouldServeCache(cacheResult)) {
        console.log(`🔄 Smart Circuit Breaker: Serving cached data while circuit is open`, {
          cacheKey,
          cacheAge: cacheResult?.age,
          isStale: cacheResult?.isStale
        });

        // Record cache-served metric
        this.updatePerformanceMetrics(
          performance.now() - startTime,
          true,
          undefined,
          cacheAvailable,
          cacheResult?.age,
          table
        );

        return cacheResult!.data as T;
      } else {
        throw new Error('Smart Circuit breaker is OPEN - no cache available for graceful degradation');
      }
    }

    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      
      // Record successful operation
      this.updatePerformanceMetrics(duration, true, undefined, cacheAvailable, cacheResult?.age, table);
      this.onSmartSuccess();
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorInfo = CircuitBreaker.classifyError(error);
      
      // Record failed operation
      this.updatePerformanceMetrics(duration, false, errorInfo.type, cacheAvailable, cacheResult?.age, table);
      this.onSmartFailure(errorInfo);
      
      throw error;
    }
  }

  /**
   * Determine if request should be allowed based on circuit state and cache availability
   */
  shouldAllowRequest(cacheAvailable: boolean): boolean {
    const state = this.getState();
    
    if (state.state === 'CLOSED') {
      return true;
    }
    
    if (state.state === 'HALF_OPEN') {
      return true;
    }
    
    if (state.state === 'OPEN') {
      // Check if we should transition to half-open
      const adaptiveTimeout = this.getAdaptiveTimeout();
      if (Date.now() - (state as any).lastFailureTime >= adaptiveTimeout) {
        return true; // Allow transition to half-open
      }
      
      // If cache is available, we might still serve from cache instead of blocking
      return false;
    }
    
    return false;
  }

  /**
   * Determine if we should serve cached data when circuit is open
   */
  shouldServeCache(cacheResult?: CacheResult<any> | null): boolean {
    if (!cacheResult?.hit) {
      return false;
    }

    const cacheAge = cacheResult.age || 0;
    
    // Serve cache if it's within the grace period, even if stale
    if (cacheAge <= this.config.cacheGracePeriod) {
      return true;
    }

    // For critical data, extend grace period
    if (cacheResult.metadata?.table && this.isCriticalTable(cacheResult.metadata.table)) {
      return cacheAge <= this.config.cacheGracePeriod * 2;
    }

    return false;
  }

  /**
   * Update performance metrics and trigger adaptive adjustments
   */
  updatePerformanceMetrics(
    duration: number,
    success: boolean,
    errorType?: ErrorType,
    cacheAvailable = false,
    cacheAge?: number,
    table?: string
  ): void {
    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      duration,
      success,
      errorType,
      cacheAvailable,
      cacheAge,
      table
    };

    this.performanceHistory.push(metric);
    
    // Keep only recent history
    if (this.performanceHistory.length > this.maxPerformanceHistory) {
      this.performanceHistory = this.performanceHistory.slice(-this.maxPerformanceHistory);
    }

    // Trigger adaptive adjustments if enabled
    if (this.config.adaptiveThresholds) {
      this.adjustAdaptiveThresholds();
    }

    // Log performance metrics
    if (!success || duration > 2000) {
      console.log(`📊 Smart Circuit Breaker: Performance metric recorded`, {
        duration: `${duration.toFixed(1)}ms`,
        success,
        errorType,
        cacheAvailable,
        table,
        performanceTrend: this.adaptiveThresholds.performanceTrend
      });
    }
  }

  /**
   * Calculate adaptive timeout based on recent performance and system load
   */
  getAdaptiveTimeout(): number {
    let baseTimeout = this.adaptiveThresholds.currentResetTimeout;

    // Apply progressive timeout if enabled
    if (this.config.progressiveTimeouts && this.config.progressiveTimeoutConfig.enabled) {
      baseTimeout = this.calculateProgressiveTimeout();
    }

    // Apply system load adjustments
    if (this.config.loadMonitoringConfig.enabled) {
      baseTimeout = this.adjustTimeoutForSystemLoad(baseTimeout);
    }

    console.log(`🎯 Smart Circuit Breaker: Adaptive timeout calculated`, {
      baseTimeout: this.adaptiveThresholds.currentResetTimeout,
      progressiveTimeout: this.config.progressiveTimeouts,
      systemLoadAdjustment: this.config.loadMonitoringConfig.enabled,
      finalTimeout: baseTimeout,
      consecutiveFailures: this.consecutiveFailures,
      systemLoad: this.systemLoadMetrics.loadLevel
    });

    return baseTimeout;
  }

  /**
   * Calculate progressive timeout based on consecutive failures and performance
   */
  private calculateProgressiveTimeout(): number {
    const config = this.config.progressiveTimeoutConfig;
    const baseTimeout = this.adaptiveThresholds.currentResetTimeout;

    // Check if we should reduce timeout step due to cooldown
    const timeSinceLastSuccess = Date.now() - this.lastSuccessTime;
    if (timeSinceLastSuccess > config.cooldownPeriod && this.currentTimeoutStep > 0) {
      this.currentTimeoutStep = Math.max(0, this.currentTimeoutStep - 1);
      console.log(`⏰ Progressive timeout step reduced due to cooldown: ${this.currentTimeoutStep}`);
    }

    // Determine timeout step based on consecutive failures
    const failureBasedStep = Math.min(
      Math.floor(this.consecutiveFailures / 2), // Increase step every 2 failures
      config.timeoutSteps.length - 1
    );

    // Use the higher of failure-based step or current step
    this.currentTimeoutStep = Math.max(this.currentTimeoutStep, failureBasedStep);

    // Get multiplier for current step
    const timeoutMultiplier = config.timeoutSteps[this.currentTimeoutStep] || 1;

    // Apply performance-based adjustments
    const recentMetrics = this.getRecentMetrics(2 * 60 * 1000); // Last 2 minutes
    if (recentMetrics.length > 0) {
      const avgDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length;
      
      // Find appropriate performance threshold
      for (let i = 0; i < config.performanceThresholds.length; i++) {
        if (avgDuration > config.performanceThresholds[i]) {
          const performanceMultiplier = 1 + (i * 0.5); // Increase timeout for poor performance
          return baseTimeout * timeoutMultiplier * performanceMultiplier;
        }
      }
    }

    return baseTimeout * timeoutMultiplier;
  }

  /**
   * Adjust timeout based on current system load
   */
  private adjustTimeoutForSystemLoad(baseTimeout: number): number {
    const loadMetrics = this.systemLoadMetrics;
    let loadMultiplier = 1;

    switch (loadMetrics.loadLevel) {
      case 'critical':
        loadMultiplier = 3; // Much longer timeout under critical load
        break;
      case 'high':
        loadMultiplier = 2; // Longer timeout under high load
        break;
      case 'medium':
        loadMultiplier = 1.5; // Slightly longer timeout under medium load
        break;
      case 'low':
        loadMultiplier = 0.8; // Shorter timeout under low load
        break;
    }

    // Additional adjustment for high query duration
    if (loadMetrics.avgQueryDuration > 3000) {
      loadMultiplier *= 1.5;
    }

    return baseTimeout * loadMultiplier;
  }

  /**
   * Start system load monitoring
   */
  private startLoadMonitoring(): void {
    const config = this.config.loadMonitoringConfig;
    
    this.loadMonitoringInterval = setInterval(() => {
      this.updateSystemLoadMetrics();
    }, config.monitoringInterval);

    console.log('📊 System load monitoring started', {
      interval: config.monitoringInterval,
      cpuThreshold: config.cpuThreshold,
      memoryThreshold: config.memoryThreshold
    });
  }

  /**
   * Update system load metrics
   */
  private updateSystemLoadMetrics(): void {
    const config = this.config.loadMonitoringConfig;
    const recentMetrics = this.getRecentMetrics(60 * 1000); // Last minute

    // Estimate CPU usage based on query performance
    const avgDuration = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length 
      : 0;
    
    // Simple heuristic: higher query duration suggests higher CPU usage
    const estimatedCpuUsage = Math.min(100, (avgDuration / 1000) * 20);

    // Estimate memory usage based on cache size and active queries
    const cacheSize = enhancedQueryCache.getSize();
    const estimatedMemoryUsage = Math.min(100, (cacheSize.bytes / (50 * 1024 * 1024)) * 100);

    // Count active queries (queries in progress)
    const activeQueries = recentMetrics.filter(m => 
      Date.now() - m.timestamp < 30000 // Active in last 30 seconds
    ).length;

    // Determine load level
    let loadLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (estimatedCpuUsage > config.cpuThreshold * 1.5 || 
        estimatedMemoryUsage > config.memoryThreshold * 1.5 ||
        activeQueries > config.activeQueryThreshold * 2) {
      loadLevel = 'critical';
    } else if (estimatedCpuUsage > config.cpuThreshold || 
               estimatedMemoryUsage > config.memoryThreshold ||
               activeQueries > config.activeQueryThreshold) {
      loadLevel = 'high';
    } else if (estimatedCpuUsage > config.cpuThreshold * 0.7 || 
               estimatedMemoryUsage > config.memoryThreshold * 0.7 ||
               activeQueries > config.activeQueryThreshold * 0.7) {
      loadLevel = 'medium';
    }

    const previousLoadLevel = this.systemLoadMetrics.loadLevel;
    
    this.systemLoadMetrics = {
      cpuUsage: estimatedCpuUsage,
      memoryUsage: estimatedMemoryUsage,
      activeQueries,
      avgQueryDuration: avgDuration,
      loadLevel,
      timestamp: Date.now()
    };

    // Log load level changes
    if (loadLevel !== previousLoadLevel) {
      console.log(`📊 System load level changed: ${previousLoadLevel} → ${loadLevel}`, {
        cpuUsage: `${estimatedCpuUsage.toFixed(1)}%`,
        memoryUsage: `${estimatedMemoryUsage.toFixed(1)}%`,
        activeQueries,
        avgQueryDuration: `${avgDuration.toFixed(1)}ms`
      });
    }
  }

  /**
   * Adjust adaptive thresholds based on performance trends
   */
  private adjustAdaptiveThresholds(): void {
    const now = Date.now();
    
    // Only adjust every 2 minutes to avoid thrashing
    if (now - this.adaptiveThresholds.lastAdjustment < 2 * 60 * 1000) {
      return;
    }

    const recentMetrics = this.getRecentMetrics(10 * 60 * 1000); // Last 10 minutes
    if (recentMetrics.length < 10) {
      return; // Need sufficient data
    }

    // Analyze performance trend
    const oldMetrics = recentMetrics.slice(0, Math.floor(recentMetrics.length / 2));
    const newMetrics = recentMetrics.slice(Math.floor(recentMetrics.length / 2));

    const oldAvgDuration = oldMetrics.reduce((sum, m) => sum + m.duration, 0) / oldMetrics.length;
    const newAvgDuration = newMetrics.reduce((sum, m) => sum + m.duration, 0) / newMetrics.length;

    const oldSuccessRate = oldMetrics.filter(m => m.success).length / oldMetrics.length;
    const newSuccessRate = newMetrics.filter(m => m.success).length / newMetrics.length;

    // Determine trend
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    
    if (newAvgDuration < oldAvgDuration * 0.8 && newSuccessRate > oldSuccessRate * 1.1) {
      trend = 'improving';
    } else if (newAvgDuration > oldAvgDuration * 1.2 || newSuccessRate < oldSuccessRate * 0.8) {
      trend = 'degrading';
    }

    const previousTrend = this.adaptiveThresholds.performanceTrend;
    this.adaptiveThresholds.performanceTrend = trend;

    // Adjust thresholds based on trend
    if (trend === 'improving' && previousTrend !== 'improving') {
      // Performance is improving - be more tolerant
      this.adaptiveThresholds.currentFailureThreshold = Math.min(
        this.config.failureThreshold * 1.5,
        this.config.failureThreshold + 3
      );
      this.adaptiveThresholds.currentResetTimeout = Math.max(
        this.config.resetTimeout * 0.7,
        15000 // Minimum 15 seconds
      );
      
      console.log(`📈 Smart Circuit Breaker: Performance improving - relaxing thresholds`, {
        failureThreshold: this.adaptiveThresholds.currentFailureThreshold,
        resetTimeout: this.adaptiveThresholds.currentResetTimeout
      });
      
    } else if (trend === 'degrading' && previousTrend !== 'degrading') {
      // Performance is degrading - be more strict
      this.adaptiveThresholds.currentFailureThreshold = Math.max(
        this.config.failureThreshold * 0.7,
        2 // Minimum threshold
      );
      this.adaptiveThresholds.currentResetTimeout = Math.min(
        this.config.resetTimeout * 1.5,
        60000 // Maximum 60 seconds
      );
      
      console.log(`📉 Smart Circuit Breaker: Performance degrading - tightening thresholds`, {
        failureThreshold: this.adaptiveThresholds.currentFailureThreshold,
        resetTimeout: this.adaptiveThresholds.currentResetTimeout
      });
    }

    this.adaptiveThresholds.lastAdjustment = now;
    this.adaptiveThresholds.adjustmentCount++;
  }

  /**
   * Get recent performance metrics within time window
   */
  private getRecentMetrics(timeWindow: number): PerformanceMetric[] {
    const cutoff = Date.now() - timeWindow;
    return this.performanceHistory.filter(metric => metric.timestamp >= cutoff);
  }

  /**
   * Check if table is considered critical for extended cache grace period
   */
  private isCriticalTable(table: string): boolean {
    const criticalTables = ['settings', 'profiles', 'clinicians', 'permissions'];
    return criticalTables.includes(table.toLowerCase());
  }

  /**
   * Handle successful operations with progressive timeout management
   */
  private onSmartSuccess(): void {
    // Reset consecutive failures on success
    this.consecutiveFailures = 0;
    this.lastSuccessTime = Date.now();

    // Gradually reduce timeout step on sustained success
    if (this.config.progressiveTimeouts && this.config.progressiveTimeoutConfig.enabled) {
      const timeSinceLastFailure = Date.now() - this.lastSuccessTime;
      if (timeSinceLastFailure > this.config.progressiveTimeoutConfig.cooldownPeriod) {
        this.currentTimeoutStep = Math.max(0, this.currentTimeoutStep - 1);
      }
    }

    // Track success but don't call parent - we'll manage our own state
    this.consecutiveFailures = 0;
    this.lastSuccessTime = Date.now();
  }

  /**
   * Handle failures with progressive timeout and weighted error analysis
   */
  private onSmartFailure(errorInfo: any): void {
    // Track consecutive failures for progressive timeout
    this.consecutiveFailures++;

    // Calculate weighted failure impact
    const errorWeight = this.config.errorTypeWeights[errorInfo.type] || 1;
    const weightedFailureCount = this.getWeightedFailureCount() + errorWeight;

    // Use adaptive threshold instead of fixed threshold
    const currentThreshold = this.adaptiveThresholds.currentFailureThreshold;

    // Adjust failure threshold based on system load
    let adjustedThreshold = currentThreshold;
    if (this.config.loadMonitoringConfig.enabled) {
      adjustedThreshold = this.adjustThresholdForSystemLoad(currentThreshold);
    }

    console.log(`⚠️ Smart Circuit Breaker: Progressive failure analysis`, {
      errorType: errorInfo.type,
      errorWeight,
      consecutiveFailures: this.consecutiveFailures,
      weightedFailureCount,
      currentThreshold,
      adjustedThreshold,
      systemLoad: this.systemLoadMetrics.loadLevel,
      timeoutStep: this.currentTimeoutStep
    });

    // Update timeout step based on failure pattern
    if (this.config.progressiveTimeouts && this.config.progressiveTimeoutConfig.enabled) {
      const maxStep = this.config.progressiveTimeoutConfig.timeoutSteps.length - 1;
      this.currentTimeoutStep = Math.min(maxStep, Math.floor(this.consecutiveFailures / 2));
    }

    // Track failure internally
    if (weightedFailureCount >= adjustedThreshold) {
      this.consecutiveFailures++;
      
      console.warn(
        `⚠️ Smart Circuit Breaker threshold exceeded: ${weightedFailureCount.toFixed(1)} >= ${adjustedThreshold}`
      );
    }
  }

  /**
   * Adjust failure threshold based on system load
   */
  private adjustThresholdForSystemLoad(baseThreshold: number): number {
    const loadMetrics = this.systemLoadMetrics;
    
    switch (loadMetrics.loadLevel) {
      case 'critical':
        return Math.max(1, Math.floor(baseThreshold * 0.5)); // More sensitive under critical load
      case 'high':
        return Math.max(2, Math.floor(baseThreshold * 0.7)); // More sensitive under high load
      case 'medium':
        return Math.max(3, Math.floor(baseThreshold * 0.85)); // Slightly more sensitive
      case 'low':
        return Math.min(baseThreshold * 1.2, baseThreshold + 2); // Less sensitive under low load
      default:
        return baseThreshold;
    }
  }

  /**
   * Calculate weighted failure count based on error types
   */
  private getWeightedFailureCount(): number {
    const recentMetrics = this.getRecentMetrics(this.config.monitoringPeriod);
    
    return recentMetrics
      .filter(metric => !metric.success && metric.errorType)
      .reduce((sum, metric) => {
        const weight = this.config.errorTypeWeights[metric.errorType!] || 1;
        return sum + weight;
      }, 0);
  }

  /**
   * Get enhanced state information including performance metrics
   */
  getEnhancedState() {
    const baseState = this.getState();
    const recentMetrics = this.getRecentMetrics(5 * 60 * 1000);
    
    const avgDuration = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length 
      : 0;
    
    const successRate = recentMetrics.length > 0
      ? recentMetrics.filter(m => m.success).length / recentMetrics.length
      : 1;

    const cacheUtilization = recentMetrics.length > 0
      ? recentMetrics.filter(m => m.cacheAvailable).length / recentMetrics.length
      : 0;

    return {
      ...baseState,
      adaptiveThresholds: { ...this.adaptiveThresholds },
      performanceMetrics: {
        avgDuration,
        successRate,
        cacheUtilization,
        recentOperations: recentMetrics.length
      },
      config: {
        progressiveTimeouts: this.config.progressiveTimeouts,
        adaptiveThresholds: this.config.adaptiveThresholds,
        cacheGracePeriod: this.config.cacheGracePeriod
      }
    };
  }

  /**
   * Reset adaptive thresholds to default values
   */
  resetAdaptiveThresholds(): void {
    this.adaptiveThresholds = {
      currentFailureThreshold: this.config.failureThreshold,
      currentResetTimeout: this.config.resetTimeout,
      performanceTrend: 'stable',
      lastAdjustment: Date.now(),
      adjustmentCount: 0
    };
    
    this.performanceHistory = [];
    this.consecutiveFailures = 0;
    this.currentTimeoutStep = 0;
    this.lastSuccessTime = Date.now();
    
    console.log('🔄 Smart Circuit Breaker: Adaptive thresholds and progressive state reset to defaults');
  }

  /**
   * Get system load metrics
   */
  getSystemLoadMetrics(): SystemLoadMetrics {
    return { ...this.systemLoadMetrics };
  }

  /**
   * Get progressive timeout information
   */
  getProgressiveTimeoutInfo() {
    return {
      enabled: this.config.progressiveTimeouts && this.config.progressiveTimeoutConfig.enabled,
      currentStep: this.currentTimeoutStep,
      consecutiveFailures: this.consecutiveFailures,
      maxSteps: this.config.progressiveTimeoutConfig.timeoutSteps.length,
      timeoutSteps: this.config.progressiveTimeoutConfig.timeoutSteps,
      cooldownPeriod: this.config.progressiveTimeoutConfig.cooldownPeriod,
      timeSinceLastSuccess: Date.now() - this.lastSuccessTime
    };
  }

  /**
   * Cleanup resources when circuit breaker is destroyed
   */
  destroy(): void {
    if (this.loadMonitoringInterval) {
      clearInterval(this.loadMonitoringInterval);
      this.loadMonitoringInterval = undefined;
    }
    
    console.log('🧹 Smart Circuit Breaker: Resources cleaned up');
  }
}