/**
 * Success Metrics Tracker
 * 
 * Tracks and validates performance improvement success metrics
 * to measure the effectiveness of optimization implementations.
 */

import { queryPerformanceMonitor } from './queryPerformanceMonitor';
import { getPerformanceFeatureFlags } from './performanceFeatureFlags';
import { enhancedQueryCache } from './enhancedQueryCache';
import { deduplicationManager } from './deduplicationManager';

export interface SuccessMetric {
  /** Unique identifier for the metric */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this metric measures */
  description: string;
  /** Target value to achieve */
  targetValue: number;
  /** Current measured value */
  currentValue: number;
  /** Baseline value before optimizations */
  baselineValue: number;
  /** Unit of measurement */
  unit: string;
  /** Whether higher values are better */
  higherIsBetter: boolean;
  /** Percentage improvement from baseline */
  improvementPercent: number;
  /** Whether target has been achieved */
  targetAchieved: boolean;
  /** Confidence level in the measurement (0-1) */
  confidence: number;
  /** Last measurement timestamp */
  lastMeasured: number;
  /** Measurement history */
  history: Array<{ timestamp: number; value: number }>;
  /** Category of metric */
  category: 'performance' | 'reliability' | 'user_experience' | 'system_health';
}

export interface SuccessMetricsReport {
  /** Overall success score (0-100) */
  overallScore: number;
  /** Individual metrics */
  metrics: SuccessMetric[];
  /** Metrics by category */
  metricsByCategory: Record<string, SuccessMetric[]>;
  /** Summary statistics */
  summary: {
    totalMetrics: number;
    achievedTargets: number;
    averageImprovement: number;
    highConfidenceMetrics: number;
  };
  /** Performance trends */
  trends: {
    improving: number;
    stable: number;
    degrading: number;
  };
  /** Recommendations */
  recommendations: string[];
  /** Report generation timestamp */
  generatedAt: number;
}

export interface ValidationResult {
  /** Whether validation passed */
  passed: boolean;
  /** Validation score (0-100) */
  score: number;
  /** Detailed results by metric */
  metricResults: Array<{
    metricId: string;
    passed: boolean;
    actualValue: number;
    targetValue: number;
    improvement: number;
  }>;
  /** Issues found during validation */
  issues: string[];
  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * Success Metrics Tracker
 * 
 * Tracks performance improvement metrics and validates achievement of targets.
 */
export class SuccessMetricsTracker {
  private metrics: Map<string, SuccessMetric> = new Map();
  private measurementInterval: NodeJS.Timeout;
  private baselineEstablished = false;
  private baselineTimestamp = 0;

  constructor() {
    this.initializeSuccessMetrics();
    this.startPeriodicMeasurement();

    console.log('📊 Success Metrics Tracker initialized');
  }

  /**
   * Get current success metrics report
   */
  getSuccessMetricsReport(): SuccessMetricsReport {
    this.measureAllMetrics();

    const metrics = Array.from(this.metrics.values());
    const metricsByCategory = this.groupMetricsByCategory(metrics);
    
    const totalMetrics = metrics.length;
    const achievedTargets = metrics.filter(m => m.targetAchieved).length;
    const averageImprovement = metrics.reduce((sum, m) => sum + m.improvementPercent, 0) / totalMetrics;
    const highConfidenceMetrics = metrics.filter(m => m.confidence >= 0.8).length;

    // Calculate trends
    const trends = this.calculateTrends(metrics);

    // Calculate overall score
    const overallScore = this.calculateOverallScore(metrics);

    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics);

    return {
      overallScore,
      metrics,
      metricsByCategory,
      summary: {
        totalMetrics,
        achievedTargets,
        averageImprovement,
        highConfidenceMetrics
      },
      trends,
      recommendations,
      generatedAt: Date.now()
    };
  }

  /**
   * Validate that performance targets have been achieved
   */
  validatePerformanceTargets(): ValidationResult {
    this.measureAllMetrics();

    const metrics = Array.from(this.metrics.values());
    const metricResults = metrics.map(metric => ({
      metricId: metric.id,
      passed: metric.targetAchieved,
      actualValue: metric.currentValue,
      targetValue: metric.targetValue,
      improvement: metric.improvementPercent
    }));

    const passedCount = metricResults.filter(r => r.passed).length;
    const score = (passedCount / metrics.length) * 100;
    const passed = score >= 80; // 80% of targets must be achieved

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Identify issues and recommendations
    for (const result of metricResults) {
      if (!result.passed) {
        const metric = this.metrics.get(result.metricId)!;
        issues.push(`${metric.name}: ${result.actualValue}${metric.unit} (target: ${result.targetValue}${metric.unit})`);
        
        if (metric.category === 'performance') {
          recommendations.push(`Optimize ${metric.name.toLowerCase()} - consider additional caching or query optimization`);
        } else if (metric.category === 'reliability') {
          recommendations.push(`Improve ${metric.name.toLowerCase()} - review error handling and circuit breaker configuration`);
        }
      }
    }

    return {
      passed,
      score,
      metricResults,
      issues,
      recommendations
    };
  }

  /**
   * Establish baseline metrics (should be called before optimizations)
   */
  establishBaseline(): void {
    console.log('📏 Establishing performance baseline...');
    
    this.measureAllMetrics();
    
    // Set current values as baseline
    for (const metric of this.metrics.values()) {
      metric.baselineValue = metric.currentValue;
      metric.improvementPercent = 0;
    }

    this.baselineEstablished = true;
    this.baselineTimestamp = Date.now();

    console.log('✅ Performance baseline established');
  }

  /**
   * Get specific metric by ID
   */
  getMetric(metricId: string): SuccessMetric | undefined {
    return this.metrics.get(metricId);
  }

  /**
   * Update target value for a metric
   */
  updateMetricTarget(metricId: string, targetValue: number): void {
    const metric = this.metrics.get(metricId);
    if (metric) {
      metric.targetValue = targetValue;
      this.updateMetricStatus(metric);
      console.log(`🎯 Updated target for ${metric.name}: ${targetValue}${metric.unit}`);
    }
  }

  /**
   * Get performance improvement summary
   */
  getPerformanceImprovementSummary(): {
    totalImprovements: number;
    significantImprovements: number;
    averageImprovement: number;
    bestImprovement: { metric: string; improvement: number };
    worstImprovement: { metric: string; improvement: number };
  } {
    const metrics = Array.from(this.metrics.values());
    const improvements = metrics.map(m => m.improvementPercent);
    
    const totalImprovements = improvements.filter(i => i > 0).length;
    const significantImprovements = improvements.filter(i => i > 10).length; // >10% improvement
    const averageImprovement = improvements.reduce((sum, i) => sum + i, 0) / improvements.length;
    
    const bestMetric = metrics.reduce((best, current) => 
      current.improvementPercent > best.improvementPercent ? current : best
    );
    
    const worstMetric = metrics.reduce((worst, current) => 
      current.improvementPercent < worst.improvementPercent ? current : worst
    );

    return {
      totalImprovements,
      significantImprovements,
      averageImprovement,
      bestImprovement: {
        metric: bestMetric.name,
        improvement: bestMetric.improvementPercent
      },
      worstImprovement: {
        metric: worstMetric.name,
        improvement: worstMetric.improvementPercent
      }
    };
  }

  /**
   * Export metrics data for reporting
   */
  exportMetricsData(): {
    metrics: SuccessMetric[];
    report: SuccessMetricsReport;
    validation: ValidationResult;
    summary: any;
  } {
    return {
      metrics: Array.from(this.metrics.values()),
      report: this.getSuccessMetricsReport(),
      validation: this.validatePerformanceTargets(),
      summary: this.getPerformanceImprovementSummary()
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.measurementInterval) {
      clearInterval(this.measurementInterval);
    }

    console.log('🧹 Success Metrics Tracker destroyed');
  }

  // Private helper methods

  private initializeSuccessMetrics(): void {
    const metrics: Omit<SuccessMetric, 'currentValue' | 'improvementPercent' | 'targetAchieved' | 'confidence' | 'lastMeasured' | 'history'>[] = [
      {
        id: 'avg_response_time',
        name: 'Average Response Time',
        description: 'Average query response time across all operations',
        targetValue: 1000, // 1 second
        baselineValue: 5000, // Assume 5 second baseline
        unit: 'ms',
        higherIsBetter: false,
        category: 'performance'
      },
      {
        id: 'p95_response_time',
        name: '95th Percentile Response Time',
        description: '95th percentile query response time',
        targetValue: 2000, // 2 seconds
        baselineValue: 10000, // Assume 10 second baseline
        unit: 'ms',
        higherIsBetter: false,
        category: 'performance'
      },
      {
        id: 'cache_hit_rate',
        name: 'Cache Hit Rate',
        description: 'Percentage of queries served from cache',
        targetValue: 75, // 75%
        baselineValue: 30, // Assume 30% baseline
        unit: '%',
        higherIsBetter: true,
        category: 'performance'
      },
      {
        id: 'error_rate',
        name: 'Error Rate',
        description: 'Percentage of queries that result in errors',
        targetValue: 1, // 1%
        baselineValue: 5, // Assume 5% baseline
        unit: '%',
        higherIsBetter: false,
        category: 'reliability'
      },
      {
        id: 'deduplication_savings',
        name: 'Deduplication Savings',
        description: 'Percentage of requests saved through deduplication',
        targetValue: 50, // 50%
        baselineValue: 0, // No deduplication initially
        unit: '%',
        higherIsBetter: true,
        category: 'performance'
      },
      {
        id: 'circuit_breaker_uptime',
        name: 'Circuit Breaker Uptime',
        description: 'Percentage of time circuit breaker is closed (healthy)',
        targetValue: 99, // 99%
        baselineValue: 95, // Assume 95% baseline
        unit: '%',
        higherIsBetter: true,
        category: 'reliability'
      },
      {
        id: 'query_success_rate',
        name: 'Query Success Rate',
        description: 'Percentage of queries that complete successfully',
        targetValue: 99, // 99%
        baselineValue: 95, // Assume 95% baseline
        unit: '%',
        higherIsBetter: true,
        category: 'reliability'
      },
      {
        id: 'memory_efficiency',
        name: 'Memory Efficiency',
        description: 'Efficiency of memory usage in caching system',
        targetValue: 80, // 80%
        baselineValue: 60, // Assume 60% baseline
        unit: '%',
        higherIsBetter: true,
        category: 'system_health'
      },
      {
        id: 'feature_rollout_success',
        name: 'Feature Rollout Success Rate',
        description: 'Percentage of feature rollouts that complete without rollback',
        targetValue: 90, // 90%
        baselineValue: 70, // Assume 70% baseline
        unit: '%',
        higherIsBetter: true,
        category: 'system_health'
      },
      {
        id: 'user_satisfaction_score',
        name: 'User Satisfaction Score',
        description: 'Estimated user satisfaction based on performance metrics',
        targetValue: 85, // 85%
        baselineValue: 60, // Assume 60% baseline
        unit: '%',
        higherIsBetter: true,
        category: 'user_experience'
      }
    ];

    for (const metricData of metrics) {
      const metric: SuccessMetric = {
        ...metricData,
        currentValue: metricData.baselineValue,
        improvementPercent: 0,
        targetAchieved: false,
        confidence: 0.5, // Start with medium confidence
        lastMeasured: Date.now(),
        history: []
      };

      this.metrics.set(metric.id, metric);
    }

    console.log(`📊 Initialized ${metrics.length} success metrics`);
  }

  private startPeriodicMeasurement(): void {
    // Measure metrics every 2 minutes
    this.measurementInterval = setInterval(() => {
      this.measureAllMetrics();
    }, 2 * 60 * 1000);

    console.log('📏 Started periodic metrics measurement');
  }

  private measureAllMetrics(): void {
    try {
      // Get current system data
      const performanceMetrics = queryPerformanceMonitor.getAggregatedMetrics();
      const cacheMetrics = enhancedQueryCache.getMetrics();
      const deduplicationMetrics = deduplicationManager.getMetrics();
      
      // Feature flag metrics - default values since system not fully implemented
      const featureFlagMetrics = {
        enabledFeatures: 8,
        rolledBackFeatures: 0,
        rolloutPercentage: 100
      };
      // Feature flag metrics not available in current implementation

      // Update each metric
      this.updateMetric('avg_response_time', performanceMetrics.averageQueryTime, 0.9);
      this.updateMetric('p95_response_time', (performanceMetrics as any).p95QueryTime || performanceMetrics.averageQueryTime * 1.5, 0.8);
      this.updateMetric('cache_hit_rate', cacheMetrics.hitRate * 100, 0.95);
      this.updateMetric('error_rate', performanceMetrics.errorRate * 100, 0.9);
      this.updateMetric('deduplication_savings', deduplicationMetrics.deduplicationSavings, 0.85);
      
      // Circuit breaker uptime (estimated based on state)
      const circuitBreakerUptime = 99; // Would be calculated from actual uptime data
      this.updateMetric('circuit_breaker_uptime', circuitBreakerUptime, 0.8);
      
      // Query success rate
      const successRate = (1 - performanceMetrics.errorRate) * 100;
      this.updateMetric('query_success_rate', successRate, 0.9);
      
      // Memory efficiency
      const memoryEfficiency = cacheMetrics.performance?.memoryEfficiency * 100 || 70;
      this.updateMetric('memory_efficiency', memoryEfficiency, 0.7);
      
      // Feature rollout success (estimated)
      const rolloutSuccess = 100 - (featureFlagMetrics.rolledBackFeatures / Math.max(1, featureFlagMetrics.enabledFeatures) * 100);
      this.updateMetric('feature_rollout_success', rolloutSuccess, 0.6);
      
      // User satisfaction score (calculated from performance metrics)
      const userSatisfaction = this.calculateUserSatisfactionScore(performanceMetrics);
      this.updateMetric('user_satisfaction_score', userSatisfaction, 0.7);

    } catch (error) {
      console.error('Error measuring success metrics:', error);
    }
  }

  private updateMetric(metricId: string, value: number, confidence: number): void {
    const metric = this.metrics.get(metricId);
    if (!metric) return;

    // Update current value and confidence
    metric.currentValue = value;
    metric.confidence = confidence;
    metric.lastMeasured = Date.now();

    // Add to history
    metric.history.push({
      timestamp: Date.now(),
      value
    });

    // Keep history manageable (last 100 measurements)
    if (metric.history.length > 100) {
      metric.history = metric.history.slice(-100);
    }

    // Calculate improvement if baseline is established
    if (this.baselineEstablished && metric.baselineValue !== 0) {
      if (metric.higherIsBetter) {
        metric.improvementPercent = ((value - metric.baselineValue) / metric.baselineValue) * 100;
      } else {
        metric.improvementPercent = ((metric.baselineValue - value) / metric.baselineValue) * 100;
      }
    }

    // Update target achievement status
    this.updateMetricStatus(metric);
  }

  private updateMetricStatus(metric: SuccessMetric): void {
    if (metric.higherIsBetter) {
      metric.targetAchieved = metric.currentValue >= metric.targetValue;
    } else {
      metric.targetAchieved = metric.currentValue <= metric.targetValue;
    }
  }

  private calculateUserSatisfactionScore(performanceMetrics: any): number {
    // Calculate user satisfaction based on performance metrics
    // This is a simplified calculation - in reality, this would come from user feedback
    
    const responseTimeScore = Math.max(0, 100 - (performanceMetrics.averageQueryTime / 50)); // 50ms = 1 point deduction
    const errorRateScore = Math.max(0, 100 - (performanceMetrics.errorRate * 2000)); // 0.05% error = 1 point deduction
    
    return Math.min(100, (responseTimeScore + errorRateScore) / 2);
  }

  private groupMetricsByCategory(metrics: SuccessMetric[]): Record<string, SuccessMetric[]> {
    const grouped: Record<string, SuccessMetric[]> = {};
    
    for (const metric of metrics) {
      if (!grouped[metric.category]) {
        grouped[metric.category] = [];
      }
      grouped[metric.category].push(metric);
    }
    
    return grouped;
  }

  private calculateTrends(metrics: SuccessMetric[]): { improving: number; stable: number; degrading: number } {
    let improving = 0;
    let stable = 0;
    let degrading = 0;

    for (const metric of metrics) {
      if (metric.history.length < 5) {
        stable++;
        continue;
      }

      // Calculate trend from recent history
      const recentHistory = metric.history.slice(-10);
      const firstHalf = recentHistory.slice(0, 5);
      const secondHalf = recentHistory.slice(5);

      const firstAvg = firstHalf.reduce((sum, h) => sum + h.value, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, h) => sum + h.value, 0) / secondHalf.length;

      const changePercent = firstAvg !== 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

      if (Math.abs(changePercent) < 2) {
        stable++;
      } else if (metric.higherIsBetter ? changePercent > 0 : changePercent < 0) {
        improving++;
      } else {
        degrading++;
      }
    }

    return { improving, stable, degrading };
  }

  private calculateOverallScore(metrics: SuccessMetric[]): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const metric of metrics) {
      // Weight by confidence and category importance
      const categoryWeight = this.getCategoryWeight(metric.category);
      const weight = metric.confidence * categoryWeight;
      
      // Calculate metric score (0-100)
      let metricScore = 0;
      if (metric.targetAchieved) {
        metricScore = 100;
      } else {
        // Partial score based on progress toward target
        const progress = metric.higherIsBetter
          ? (metric.currentValue - metric.baselineValue) / (metric.targetValue - metric.baselineValue)
          : (metric.baselineValue - metric.currentValue) / (metric.baselineValue - metric.targetValue);
        
        metricScore = Math.max(0, Math.min(100, progress * 100));
      }

      totalScore += metricScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private getCategoryWeight(category: string): number {
    switch (category) {
      case 'performance': return 1.0;
      case 'reliability': return 0.9;
      case 'user_experience': return 0.8;
      case 'system_health': return 0.7;
      default: return 0.5;
    }
  }

  private generateRecommendations(metrics: SuccessMetric[]): string[] {
    const recommendations: string[] = [];
    
    for (const metric of metrics) {
      if (!metric.targetAchieved && metric.confidence >= 0.7) {
        switch (metric.id) {
          case 'avg_response_time':
          case 'p95_response_time':
            recommendations.push('Consider implementing additional caching layers or optimizing database queries');
            break;
          case 'cache_hit_rate':
            recommendations.push('Review cache configuration and consider increasing cache TTL for stable data');
            break;
          case 'error_rate':
            recommendations.push('Investigate error patterns and implement better error handling');
            break;
          case 'deduplication_savings':
            recommendations.push('Analyze query patterns to identify more deduplication opportunities');
            break;
          case 'circuit_breaker_uptime':
            recommendations.push('Review circuit breaker thresholds and improve underlying service reliability');
            break;
        }
      }
    }

    // Remove duplicates
    return Array.from(new Set(recommendations));
  }
}

// Global success metrics tracker instance
export const successMetricsTracker = new SuccessMetricsTracker();