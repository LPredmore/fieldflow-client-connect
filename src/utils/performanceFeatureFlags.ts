/**
 * Performance Feature Flags System
 * 
 * Provides controlled rollout capabilities for query performance optimizations
 * with automatic rollback triggers and gradual enablement.
 */

export interface PerformanceFeatureFlags {
  enhancedCaching: boolean;
  requestDeduplication: boolean;
  smartCircuitBreaker: boolean;
  authQueryCoordination: boolean;
  performanceMonitoring: boolean;
  queryPrioritization: boolean;
  progressiveErrorRecovery: boolean;
  backgroundRefresh: boolean;
}

export interface FeatureFlagConfig {
  enabled: boolean;
  rolloutPercentage: number;
  rollbackTriggers: RollbackTrigger[];
  dependencies?: string[];
  description: string;
}

export interface RollbackTrigger {
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq';
  timeWindow: number; // milliseconds
}

export interface PerformanceMetrics {
  averageQueryTime: number;
  errorRate: number;
  cacheHitRate: number;
  circuitBreakerActivations: number;
  authSkippedQueries: number;
  userSatisfactionScore: number;
}

class PerformanceFeatureFlagManager {
  private flags: Map<keyof PerformanceFeatureFlags, FeatureFlagConfig> = new Map();
  private userHash: string;
  private metricsHistory: PerformanceMetrics[] = [];
  private rollbackCallbacks: Map<string, () => void> = new Map();

  constructor(userId?: string) {
    this.userHash = this.generateUserHash(userId || 'anonymous');
    this.initializeDefaultFlags();
    this.startMetricsMonitoring();
  }

  private generateUserHash(userId: string): string {
    // Simple hash function for consistent user bucketing
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  }

  private initializeDefaultFlags(): void {
    // Enhanced Caching - Low risk, high impact
    this.flags.set('enhancedCaching', {
      enabled: true,
      rolloutPercentage: 100,
      rollbackTriggers: [
        { metric: 'averageQueryTime', threshold: 2000, operator: 'gt', timeWindow: 300000 },
        { metric: 'errorRate', threshold: 0.05, operator: 'gt', timeWindow: 300000 }
      ],
      description: 'Intelligent caching with table-specific configurations'
    });

    // Request Deduplication - Medium risk, high impact
    this.flags.set('requestDeduplication', {
      enabled: true,
      rolloutPercentage: 90,
      rollbackTriggers: [
        { metric: 'errorRate', threshold: 0.03, operator: 'gt', timeWindow: 300000 },
        { metric: 'averageQueryTime', threshold: 1500, operator: 'gt', timeWindow: 300000 }
      ],
      dependencies: ['enhancedCaching'],
      description: 'Prevent redundant queries to same tables'
    });

    // Smart Circuit Breaker - Medium risk, medium impact
    this.flags.set('smartCircuitBreaker', {
      enabled: true,
      rolloutPercentage: 80,
      rollbackTriggers: [
        { metric: 'circuitBreakerActivations', threshold: 10, operator: 'gt', timeWindow: 300000 },
        { metric: 'errorRate', threshold: 0.02, operator: 'gt', timeWindow: 300000 }
      ],
      description: 'Enhanced circuit breaker with cache-aware logic'
    });

    // Auth Query Coordination - High risk, high impact
    this.flags.set('authQueryCoordination', {
      enabled: true,
      rolloutPercentage: 70,
      rollbackTriggers: [
        { metric: 'authSkippedQueries', threshold: 5, operator: 'gt', timeWindow: 300000 },
        { metric: 'errorRate', threshold: 0.02, operator: 'gt', timeWindow: 300000 }
      ],
      description: 'Coordinate authentication state with query execution'
    });

    // Performance Monitoring - Low risk, monitoring only
    this.flags.set('performanceMonitoring', {
      enabled: true,
      rolloutPercentage: 100,
      rollbackTriggers: [],
      description: 'Real-time performance metrics collection'
    });

    // Query Prioritization - Medium risk, medium impact
    this.flags.set('queryPrioritization', {
      enabled: true,
      rolloutPercentage: 60,
      rollbackTriggers: [
        { metric: 'averageQueryTime', threshold: 1800, operator: 'gt', timeWindow: 300000 },
        { metric: 'userSatisfactionScore', threshold: 4.0, operator: 'lt', timeWindow: 600000 }
      ],
      dependencies: ['requestDeduplication'],
      description: 'Priority-based query execution and throttling'
    });

    // Progressive Error Recovery - Low risk, high UX impact
    this.flags.set('progressiveErrorRecovery', {
      enabled: true,
      rolloutPercentage: 85,
      rollbackTriggers: [
        { metric: 'errorRate', threshold: 0.03, operator: 'gt', timeWindow: 300000 }
      ],
      dependencies: ['enhancedCaching'],
      description: 'Multi-level fallback strategy for query failures'
    });

    // Background Refresh - Low risk, performance improvement
    this.flags.set('backgroundRefresh', {
      enabled: true,
      rolloutPercentage: 95,
      rollbackTriggers: [
        { metric: 'cacheHitRate', threshold: 0.6, operator: 'lt', timeWindow: 600000 }
      ],
      dependencies: ['enhancedCaching'],
      description: 'Background cache refresh for stale data'
    });
  }

  public isFeatureEnabled(feature: keyof PerformanceFeatureFlags): boolean {
    const config = this.flags.get(feature);
    if (!config || !config.enabled) {
      return false;
    }

    // Check dependencies
    if (config.dependencies) {
      for (const dependency of config.dependencies) {
        if (!this.isFeatureEnabled(dependency as keyof PerformanceFeatureFlags)) {
          console.warn(`Feature ${feature} disabled due to dependency ${dependency} being disabled`);
          return false;
        }
      }
    }

    // Check rollout percentage
    const userBucket = parseInt(this.userHash.slice(-2), 16) % 100;
    return userBucket < config.rolloutPercentage;
  }

  public getAllFlags(): PerformanceFeatureFlags {
    return {
      enhancedCaching: this.isFeatureEnabled('enhancedCaching'),
      requestDeduplication: this.isFeatureEnabled('requestDeduplication'),
      smartCircuitBreaker: this.isFeatureEnabled('smartCircuitBreaker'),
      authQueryCoordination: this.isFeatureEnabled('authQueryCoordination'),
      performanceMonitoring: this.isFeatureEnabled('performanceMonitoring'),
      queryPrioritization: this.isFeatureEnabled('queryPrioritization'),
      progressiveErrorRecovery: this.isFeatureEnabled('progressiveErrorRecovery'),
      backgroundRefresh: this.isFeatureEnabled('backgroundRefresh')
    };
  }

  public updateMetrics(metrics: PerformanceMetrics): void {
    this.metricsHistory.push({
      ...metrics,
      timestamp: Date.now()
    } as PerformanceMetrics & { timestamp: number });

    // Keep only last 24 hours of metrics
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.metricsHistory = this.metricsHistory.filter(m => 
      (m as PerformanceMetrics & { timestamp: number }).timestamp > oneDayAgo
    );

    // Check rollback triggers
    this.checkRollbackTriggers(metrics);
  }

  private checkRollbackTriggers(currentMetrics: PerformanceMetrics): void {
    for (const [featureName, config] of this.flags.entries()) {
      if (!config.enabled) continue;

      for (const trigger of config.rollbackTriggers) {
        const shouldRollback = this.evaluateTrigger(trigger, currentMetrics);
        
        if (shouldRollback) {
          console.warn(`Rollback trigger activated for ${featureName}:`, trigger);
          this.rollbackFeature(featureName, trigger);
        }
      }
    }
  }

  private evaluateTrigger(trigger: RollbackTrigger, metrics: PerformanceMetrics): boolean {
    const metricValue = metrics[trigger.metric as keyof PerformanceMetrics];
    if (typeof metricValue !== 'number') return false;

    // Check if trigger condition is met within time window
    const windowStart = Date.now() - trigger.timeWindow;
    const recentMetrics = this.metricsHistory.filter(m => 
      (m as PerformanceMetrics & { timestamp: number }).timestamp > windowStart
    );

    if (recentMetrics.length === 0) return false;

    // Calculate average for the time window
    const avgValue = recentMetrics.reduce((sum, m) => 
      sum + (m[trigger.metric as keyof PerformanceMetrics] as number), 0
    ) / recentMetrics.length;

    switch (trigger.operator) {
      case 'gt':
        return avgValue > trigger.threshold;
      case 'lt':
        return avgValue < trigger.threshold;
      case 'eq':
        return Math.abs(avgValue - trigger.threshold) < 0.001;
      default:
        return false;
    }
  }

  private rollbackFeature(featureName: keyof PerformanceFeatureFlags, trigger: RollbackTrigger): void {
    const config = this.flags.get(featureName);
    if (!config) return;

    // Disable the feature
    config.enabled = false;
    
    // Log the rollback
    console.error(`Feature ${featureName} rolled back due to trigger:`, {
      metric: trigger.metric,
      threshold: trigger.threshold,
      operator: trigger.operator,
      timeWindow: trigger.timeWindow
    });

    // Execute rollback callback if registered
    const callback = this.rollbackCallbacks.get(featureName);
    if (callback) {
      try {
        callback();
      } catch (error) {
        console.error(`Error executing rollback callback for ${featureName}:`, error);
      }
    }

    // Notify monitoring system
    this.notifyRollback(featureName, trigger);
  }

  private notifyRollback(featureName: string, trigger: RollbackTrigger): void {
    // In a real implementation, this would send alerts to monitoring systems
    console.error('PERFORMANCE ROLLBACK ALERT', {
      feature: featureName,
      trigger,
      timestamp: new Date().toISOString(),
      userHash: this.userHash
    });
  }

  public registerRollbackCallback(featureName: keyof PerformanceFeatureFlags, callback: () => void): void {
    this.rollbackCallbacks.set(featureName, callback);
  }

  public manuallyEnableFeature(featureName: keyof PerformanceFeatureFlags, rolloutPercentage: number = 100): void {
    const config = this.flags.get(featureName);
    if (config) {
      config.enabled = true;
      config.rolloutPercentage = rolloutPercentage;
      console.log(`Manually enabled feature ${featureName} with ${rolloutPercentage}% rollout`);
    }
  }

  public manuallyDisableFeature(featureName: keyof PerformanceFeatureFlags): void {
    const config = this.flags.get(featureName);
    if (config) {
      config.enabled = false;
      console.log(`Manually disabled feature ${featureName}`);
    }
  }

  public getFeatureStatus(): Record<string, { enabled: boolean; rolloutPercentage: number; description: string }> {
    const status: Record<string, { enabled: boolean; rolloutPercentage: number; description: string }> = {};
    
    for (const [featureName, config] of this.flags.entries()) {
      status[featureName] = {
        enabled: config.enabled && this.isFeatureEnabled(featureName),
        rolloutPercentage: config.rolloutPercentage,
        description: config.description
      };
    }
    
    return status;
  }

  private startMetricsMonitoring(): void {
    // Check rollback triggers every 30 seconds
    setInterval(() => {
      if (this.metricsHistory.length > 0) {
        const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1];
        this.checkRollbackTriggers(latestMetrics);
      }
    }, 30000);
  }
}

// Global instance
let globalFeatureFlagManager: PerformanceFeatureFlagManager | null = null;

export function getPerformanceFeatureFlags(userId?: string): PerformanceFeatureFlagManager {
  if (!globalFeatureFlagManager) {
    globalFeatureFlagManager = new PerformanceFeatureFlagManager(userId);
  }
  return globalFeatureFlagManager;
}

export function updatePerformanceMetrics(metrics: PerformanceMetrics): void {
  if (globalFeatureFlagManager) {
    globalFeatureFlagManager.updateMetrics(metrics);
  }
}

export function isPerformanceFeatureEnabled(feature: keyof PerformanceFeatureFlags): boolean {
  if (!globalFeatureFlagManager) {
    globalFeatureFlagManager = new PerformanceFeatureFlagManager();
  }
  return globalFeatureFlagManager.isFeatureEnabled(feature);
}

// Development/testing utilities
export function resetFeatureFlags(): void {
  globalFeatureFlagManager = null;
}

export function setFeatureFlagForTesting(feature: keyof PerformanceFeatureFlags, enabled: boolean): void {
  if (!globalFeatureFlagManager) {
    globalFeatureFlagManager = new PerformanceFeatureFlagManager();
  }
  
  if (enabled) {
    globalFeatureFlagManager.manuallyEnableFeature(feature);
  } else {
    globalFeatureFlagManager.manuallyDisableFeature(feature);
  }
}