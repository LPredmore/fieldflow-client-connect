/**
 * Feature Flag Integration System
 * 
 * Integrates performance feature flags with existing optimization systems
 * to enable controlled rollout and automatic rollback capabilities.
 */

import { getPerformanceFeatureFlags, isPerformanceFeatureEnabled, updatePerformanceMetrics } from './performanceFeatureFlags';
import type { PerformanceMetrics } from './performanceFeatureFlags';

export class FeatureFlagIntegratedPerformanceSystem {
  private metricsCollector: PerformanceMetricsCollector;

  constructor(userId?: string) {
    // Initialize feature flag manager
    getPerformanceFeatureFlags(userId);
    
    // Start metrics collection
    this.metricsCollector = new PerformanceMetricsCollector();
    this.startMetricsCollection();

    // Log enabled features
    this.logEnabledFeatures();
  }

  private logEnabledFeatures(): void {
    const features = [
      'enhancedCaching',
      'requestDeduplication', 
      'smartCircuitBreaker',
      'authQueryCoordination',
      'performanceMonitoring',
      'queryPrioritization',
      'progressiveErrorRecovery',
      'backgroundRefresh'
    ] as const;

    console.log('🚀 Performance Feature Flags Status:');
    features.forEach(feature => {
      const enabled = isPerformanceFeatureEnabled(feature);
      console.log(`  ${enabled ? '✅' : '❌'} ${feature}: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    });
  }

  public async executeQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    const startTime = Date.now();
    let result: T;
    let error: Error | null = null;
    const cacheHit = false;

    try {
      // For now, just execute the query directly
      // In a full implementation, this would integrate with all the performance systems
      result = await queryFn();

      return result;

    } catch (err) {
      error = err;
      throw err;

    } finally {
      // Collect metrics for feature flag monitoring
      const duration = Date.now() - startTime;
      this.metricsCollector.recordQuery({
        queryKey,
        duration,
        success: !error,
        cacheHit,
        deduplicationSaved: false,
        error: error?.message,
        timestamp: Date.now()
      });
    }
  }

  private startMetricsCollection(): void {
    // Collect and report metrics every 60 seconds
    setInterval(() => {
      const metrics = this.metricsCollector.getAggregatedMetrics();
      updatePerformanceMetrics(metrics);
    }, 60000);
  }

  public getFeatureStatus() {
    return getPerformanceFeatureFlags().getFeatureStatus();
  }

  public manuallyToggleFeature(feature: string, enabled: boolean): void {
    const flagManager = getPerformanceFeatureFlags();
    const validFeatures = [
      'enhancedCaching', 'requestDeduplication', 'smartCircuitBreaker',
      'authQueryCoordination', 'performanceMonitoring', 'queryPrioritization',
      'progressiveErrorRecovery', 'backgroundRefresh'
    ];
    
    if (validFeatures.includes(feature)) {
      if (enabled) {
        flagManager.manuallyEnableFeature(feature as keyof import('./performanceFeatureFlags').PerformanceFeatureFlags);
      } else {
        flagManager.manuallyDisableFeature(feature as keyof import('./performanceFeatureFlags').PerformanceFeatureFlags);
      }
    }
    
    // Re-log enabled features
    this.logEnabledFeatures();
  }
}

interface QueryOptions {
  priority?: 'critical' | 'high' | 'medium' | 'low';
  timeout?: number;
  retryCount?: number;
  cacheConfig?: {
    staleTime?: number;
    maxAge?: number;
    priority?: 'high' | 'medium' | 'low';
  };
}

class PerformanceMetricsCollector {
  private queryMetrics: QueryMetric[] = [];
  private circuitBreakerActivations = 0;
  private authSkippedQueries = 0;

  recordQuery(metric: QueryMetric): void {
    this.queryMetrics.push(metric);

    // Keep only last hour of metrics
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.queryMetrics = this.queryMetrics.filter(m => m.timestamp > oneHourAgo);
  }

  recordCircuitBreakerActivation(): void {
    this.circuitBreakerActivations++;
  }

  recordAuthSkippedQuery(): void {
    this.authSkippedQueries++;
  }

  getAggregatedMetrics(): PerformanceMetrics {
    const recentMetrics = this.queryMetrics.filter(m => 
      m.timestamp > Date.now() - 5 * 60 * 1000 // Last 5 minutes
    );

    if (recentMetrics.length === 0) {
      return {
        averageQueryTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        circuitBreakerActivations: this.circuitBreakerActivations,
        authSkippedQueries: this.authSkippedQueries,
        userSatisfactionScore: 5.0 // Default high score when no data
      };
    }

    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageQueryTime = totalDuration / recentMetrics.length;

    const errorCount = recentMetrics.filter(m => !m.success).length;
    const errorRate = errorCount / recentMetrics.length;

    const cacheHits = recentMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = cacheHits / recentMetrics.length;

    // Simple user satisfaction score based on performance
    let userSatisfactionScore = 5.0;
    if (averageQueryTime > 2000) userSatisfactionScore -= 1.0;
    if (averageQueryTime > 5000) userSatisfactionScore -= 1.0;
    if (errorRate > 0.02) userSatisfactionScore -= 1.0;
    if (cacheHitRate < 0.5) userSatisfactionScore -= 0.5;

    return {
      averageQueryTime,
      errorRate,
      cacheHitRate,
      circuitBreakerActivations: this.circuitBreakerActivations,
      authSkippedQueries: this.authSkippedQueries,
      userSatisfactionScore: Math.max(1.0, userSatisfactionScore)
    };
  }

  reset(): void {
    this.queryMetrics = [];
    this.circuitBreakerActivations = 0;
    this.authSkippedQueries = 0;
  }
}

interface QueryMetric {
  queryKey: string;
  duration: number;
  success: boolean;
  cacheHit: boolean;
  deduplicationSaved: boolean;
  error?: string;
  timestamp: number;
}

// Global instance
let globalPerformanceSystem: FeatureFlagIntegratedPerformanceSystem | null = null;

export function getIntegratedPerformanceSystem(userId?: string): FeatureFlagIntegratedPerformanceSystem {
  if (!globalPerformanceSystem) {
    globalPerformanceSystem = new FeatureFlagIntegratedPerformanceSystem(userId);
  }
  return globalPerformanceSystem;
}

export function executeQueryWithFeatureFlags<T>(
  queryKey: string,
  queryFn: () => Promise<T>,
  options?: QueryOptions
): Promise<T> {
  return getIntegratedPerformanceSystem().executeQuery(queryKey, queryFn, options);
}

// Development utilities
export function resetIntegratedPerformanceSystem(): void {
  globalPerformanceSystem = null;
}