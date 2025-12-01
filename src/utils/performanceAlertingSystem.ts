/**
 * Performance Alerting System
 * 
 * Provides real-time monitoring and automated alerting for performance degradation,
 * integrating with feature flags for rollback decisions.
 */

import { queryPerformanceMonitor } from './queryPerformanceMonitor';
import { getPerformanceFeatureFlags } from './performanceFeatureFlags';
import type { PerformanceFeatureFlags } from './performanceFeatureFlags';
import { enhancedQueryCache } from './enhancedQueryCache';
import { deduplicationManager } from './deduplicationManager';
import { smartSupabaseCircuitBreaker } from './smartCircuitBreakerInstance';

export interface AlertRule {
  /** Unique identifier for the alert rule */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this alert monitors */
  description: string;
  /** Metric to monitor */
  metric: AlertMetric;
  /** Threshold value that triggers the alert */
  threshold: number;
  /** Comparison operator */
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  /** Time window for evaluation (ms) */
  timeWindow: number;
  /** Minimum number of data points required */
  minDataPoints: number;
  /** Alert severity level */
  severity: 'info' | 'warning' | 'critical';
  /** Whether this alert is currently enabled */
  enabled: boolean;
  /** Actions to take when alert triggers */
  actions: AlertAction[];
  /** Cooldown period before re-alerting (ms) */
  cooldownPeriod: number;
  /** Tags for categorization */
  tags: string[];
}

export interface AlertMetric {
  /** Type of metric to monitor */
  type: 'response_time' | 'error_rate' | 'cache_hit_rate' | 'circuit_breaker_state' | 
        'deduplication_savings' | 'memory_usage' | 'active_queries' | 'feature_rollout_health';
  /** Aggregation method */
  aggregation: 'average' | 'max' | 'min' | 'sum' | 'count' | 'percentile';
  /** Percentile value if aggregation is percentile */
  percentile?: number;
  /** Filters to apply to the metric */
  filters?: Record<string, any>;
}

export interface AlertAction {
  /** Type of action to take */
  type: 'notification' | 'rollback_feature' | 'emergency_rollback' | 'log' | 'webhook';
  /** Configuration for the action */
  config: AlertActionConfig;
}

export interface AlertActionConfig {
  /** Feature to rollback (for rollback actions) */
  feature?: string;
  /** Notification message template */
  message?: string;
  /** Webhook URL (for webhook actions) */
  webhookUrl?: string;
  /** Log level (for log actions) */
  logLevel?: 'info' | 'warn' | 'error';
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface Alert {
  /** Unique alert identifier */
  id: string;
  /** Alert rule that triggered this alert */
  ruleId: string;
  /** Alert rule name */
  ruleName: string;
  /** Timestamp when alert was triggered */
  timestamp: number;
  /** Current metric value that triggered the alert */
  currentValue: number;
  /** Threshold that was exceeded */
  threshold: number;
  /** Alert severity */
  severity: 'info' | 'warning' | 'critical';
  /** Alert message */
  message: string;
  /** Whether this alert is currently active */
  active: boolean;
  /** Timestamp when alert was resolved (if resolved) */
  resolvedAt?: number;
  /** Actions that were taken */
  actionsTaken: AlertActionResult[];
  /** Additional context data */
  context: Record<string, any>;
}

export interface AlertActionResult {
  /** Action type that was executed */
  actionType: string;
  /** Whether the action was successful */
  success: boolean;
  /** Timestamp when action was executed */
  executedAt: number;
  /** Result message */
  message: string;
  /** Error details if action failed */
  error?: string;
}

export interface AlertingMetrics {
  /** Total number of alert rules */
  totalRules: number;
  /** Number of active alerts */
  activeAlerts: number;
  /** Number of alerts triggered in last 24 hours */
  alertsLast24h: number;
  /** Alert frequency by severity */
  alertsBySeverity: Record<string, number>;
  /** Most frequently triggered rules */
  topAlertRules: Array<{ ruleId: string; count: number }>;
  /** Average time to resolution */
  avgResolutionTime: number;
  /** System health score based on alerts */
  healthScore: number;
}

export interface MonitoringDashboardData {
  /** Current system metrics */
  currentMetrics: SystemMetrics;
  /** Active alerts */
  activeAlerts: Alert[];
  /** Recent alert history */
  recentAlerts: Alert[];
  /** Alerting system metrics */
  alertingMetrics: AlertingMetrics;
  /** Performance trends */
  performanceTrends: PerformanceTrend[];
  /** Feature flag health */
  featureFlagHealth: FeatureFlagHealthData[];
}

export interface SystemMetrics {
  /** Current response time metrics */
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  /** Current error rate */
  errorRate: number;
  /** Cache performance */
  cacheMetrics: {
    hitRate: number;
    missRate: number;
    totalSize: number;
  };
  /** Circuit breaker status */
  circuitBreakerState: string;
  /** Deduplication effectiveness */
  deduplicationSavings: number;
  /** System load indicators */
  systemLoad: {
    activeQueries: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  /** Timestamp of metrics */
  timestamp: number;
}

export interface PerformanceTrend {
  /** Metric name */
  metric: string;
  /** Data points over time */
  dataPoints: Array<{ timestamp: number; value: number }>;
  /** Trend direction */
  trend: 'improving' | 'stable' | 'degrading';
  /** Percentage change from baseline */
  changePercent: number;
}

export interface FeatureFlagHealthData {
  /** Feature name */
  feature: string;
  /** Whether feature is enabled */
  enabled: boolean;
  /** Rollout percentage */
  rolloutPercentage: number;
  /** Health status */
  health: 'healthy' | 'warning' | 'critical';
  /** Performance impact */
  performanceImpact: number;
  /** Recent issues */
  recentIssues: string[];
}

/**
 * Performance Alerting System
 * 
 * Monitors system performance and triggers alerts based on configurable rules.
 */
export class PerformanceAlertingSystem {
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private monitoringInterval: NodeJS.Timeout;
  private metricsHistory: Array<{ timestamp: number; metrics: SystemMetrics }> = [];
  private maxHistorySize = 1000;
  private lastAlertTimes: Map<string, number> = new Map();

  constructor() {
    this.initializeDefaultAlertRules();
    this.startMonitoring();

    console.log('🚨 Performance Alerting System initialized');
  }

  /**
   * Add a new alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    console.log(`📋 Alert rule added: ${rule.name} (${rule.id})`);
  }

  /**
   * Remove an alert rule
   */
  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    console.log(`🗑️ Alert rule removed: ${ruleId}`);
  }

  /**
   * Update an existing alert rule
   */
  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): void {
    const rule = this.alertRules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
      console.log(`✏️ Alert rule updated: ${ruleId}`);
    }
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get alerting metrics
   */
  getAlertingMetrics(): AlertingMetrics {
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);
    
    const alertsLast24h = this.alertHistory.filter(alert => alert.timestamp >= last24h).length;
    
    const alertsBySeverity = this.alertHistory.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const ruleFrequency = this.alertHistory.reduce((acc, alert) => {
      acc[alert.ruleId] = (acc[alert.ruleId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topAlertRules = Object.entries(ruleFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([ruleId, count]) => ({ ruleId, count }));

    const resolvedAlerts = this.alertHistory.filter(alert => alert.resolvedAt);
    const avgResolutionTime = resolvedAlerts.length > 0
      ? resolvedAlerts.reduce((sum, alert) => sum + (alert.resolvedAt! - alert.timestamp), 0) / resolvedAlerts.length
      : 0;

    // Calculate health score based on active alerts and recent activity
    const criticalAlerts = this.getActiveAlerts().filter(alert => alert.severity === 'critical').length;
    const warningAlerts = this.getActiveAlerts().filter(alert => alert.severity === 'warning').length;
    const healthScore = Math.max(0, 100 - (criticalAlerts * 30) - (warningAlerts * 10));

    return {
      totalRules: this.alertRules.size,
      activeAlerts: this.activeAlerts.size,
      alertsLast24h,
      alertsBySeverity,
      topAlertRules,
      avgResolutionTime,
      healthScore
    };
  }

  /**
   * Get comprehensive monitoring dashboard data
   */
  getMonitoringDashboardData(): MonitoringDashboardData {
    const currentMetrics = this.getCurrentSystemMetrics();
    const activeAlerts = this.getActiveAlerts();
    const recentAlerts = this.getAlertHistory(20);
    const alertingMetrics = this.getAlertingMetrics();
    const performanceTrends = this.calculatePerformanceTrends();
    const featureFlagHealth = this.getFeatureFlagHealthData();

    return {
      currentMetrics,
      activeAlerts,
      recentAlerts,
      alertingMetrics,
      performanceTrends,
      featureFlagHealth
    };
  }

  /**
   * Manually trigger alert evaluation (for testing)
   */
  evaluateAlerts(): void {
    this.checkAlertRules();
  }

  /**
   * Resolve an active alert
   */
  resolveAlert(alertId: string, reason = 'Manual resolution'): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.active = false;
      alert.resolvedAt = Date.now();
      alert.context.resolutionReason = reason;
      
      this.activeAlerts.delete(alertId);
      console.log(`✅ Alert resolved: ${alert.ruleName} (${reason})`);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    console.log('🧹 Performance Alerting System destroyed');
  }

  // Private helper methods

  private initializeDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_response_time',
        name: 'High Response Time',
        description: 'Alert when average response time exceeds 2 seconds',
        metric: {
          type: 'response_time',
          aggregation: 'average'
        },
        threshold: 2000,
        operator: 'greater_than',
        timeWindow: 5 * 60 * 1000, // 5 minutes
        minDataPoints: 5,
        severity: 'warning',
        enabled: true,
        actions: [
          {
            type: 'notification',
            config: {
              message: 'Average response time is {{currentValue}}ms, exceeding threshold of {{threshold}}ms'
            }
          },
          {
            type: 'log',
            config: {
              logLevel: 'warn',
              message: 'High response time detected'
            }
          }
        ],
        cooldownPeriod: 10 * 60 * 1000, // 10 minutes
        tags: ['performance', 'response_time']
      },
      {
        id: 'critical_response_time',
        name: 'Critical Response Time',
        description: 'Alert when average response time exceeds 5 seconds',
        metric: {
          type: 'response_time',
          aggregation: 'average'
        },
        threshold: 5000,
        operator: 'greater_than',
        timeWindow: 2 * 60 * 1000, // 2 minutes
        minDataPoints: 3,
        severity: 'critical',
        enabled: true,
        actions: [
          {
            type: 'notification',
            config: {
              message: 'CRITICAL: Average response time is {{currentValue}}ms, exceeding critical threshold'
            }
          },
          {
            type: 'emergency_rollback',
            config: {
              message: 'Emergency rollback triggered due to critical response time'
            }
          }
        ],
        cooldownPeriod: 5 * 60 * 1000, // 5 minutes
        tags: ['performance', 'critical', 'response_time']
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Alert when error rate exceeds 5%',
        metric: {
          type: 'error_rate',
          aggregation: 'average'
        },
        threshold: 0.05,
        operator: 'greater_than',
        timeWindow: 5 * 60 * 1000,
        minDataPoints: 5,
        severity: 'critical',
        enabled: true,
        actions: [
          {
            type: 'notification',
            config: {
              message: 'Error rate is {{currentValue}}%, exceeding threshold of {{threshold}}%'
            }
          }
        ],
        cooldownPeriod: 10 * 60 * 1000,
        tags: ['errors', 'critical']
      },
      {
        id: 'low_cache_hit_rate',
        name: 'Low Cache Hit Rate',
        description: 'Alert when cache hit rate drops below 50%',
        metric: {
          type: 'cache_hit_rate',
          aggregation: 'average'
        },
        threshold: 0.5,
        operator: 'less_than',
        timeWindow: 10 * 60 * 1000,
        minDataPoints: 10,
        severity: 'warning',
        enabled: true,
        actions: [
          {
            type: 'notification',
            config: {
              message: 'Cache hit rate is {{currentValue}}%, below optimal threshold'
            }
          }
        ],
        cooldownPeriod: 15 * 60 * 1000,
        tags: ['cache', 'performance']
      },
      {
        id: 'circuit_breaker_open',
        name: 'Circuit Breaker Open',
        description: 'Alert when circuit breaker opens',
        metric: {
          type: 'circuit_breaker_state',
          aggregation: 'count'
        },
        threshold: 1,
        operator: 'greater_than',
        timeWindow: 1 * 60 * 1000,
        minDataPoints: 1,
        severity: 'critical',
        enabled: true,
        actions: [
          {
            type: 'notification',
            config: {
              message: 'Circuit breaker has opened - system may be experiencing issues'
            }
          }
        ],
        cooldownPeriod: 5 * 60 * 1000,
        tags: ['circuit_breaker', 'critical']
      },
      {
        id: 'feature_rollout_issues',
        name: 'Feature Rollout Issues',
        description: 'Alert when feature rollouts show performance degradation',
        metric: {
          type: 'feature_rollout_health',
          aggregation: 'average'
        },
        threshold: 70, // Health score below 70%
        operator: 'less_than',
        timeWindow: 5 * 60 * 1000,
        minDataPoints: 3,
        severity: 'warning',
        enabled: true,
        actions: [
          {
            type: 'notification',
            config: {
              message: 'Feature rollout health score is {{currentValue}}%, indicating potential issues'
            }
          }
        ],
        cooldownPeriod: 10 * 60 * 1000,
        tags: ['feature_flags', 'rollout']
      }
    ];

    for (const rule of defaultRules) {
      this.alertRules.set(rule.id, rule);
    }

    console.log(`📋 Initialized ${defaultRules.length} default alert rules`);
  }

  private startMonitoring(): void {
    // Check alerts every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkAlertRules();
      this.cleanupOldData();
    }, 30 * 1000);

    console.log('🔍 Performance monitoring started');
  }

  private collectMetrics(): void {
    const metrics = this.getCurrentSystemMetrics();
    
    this.metricsHistory.push({
      timestamp: Date.now(),
      metrics
    });

    // Keep history size manageable
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }
  }

  private getCurrentSystemMetrics(): SystemMetrics {
    try {
      // Get metrics from various systems
      const performanceMetrics = queryPerformanceMonitor.getAggregatedMetrics();
      const cacheMetrics = enhancedQueryCache.getMetrics();
      const deduplicationMetrics = deduplicationManager.getMetrics();
      const circuitBreakerState = smartSupabaseCircuitBreaker.getEnhancedState();

      return {
        responseTime: {
          average: performanceMetrics.averageQueryTime,
          p95: (performanceMetrics as any).p95QueryTime || performanceMetrics.averageQueryTime * 1.5,
          p99: (performanceMetrics as any).p99QueryTime || performanceMetrics.averageQueryTime * 2
        },
        errorRate: performanceMetrics.errorRate,
        cacheMetrics: {
          hitRate: cacheMetrics.hitRate,
          missRate: cacheMetrics.missRate,
          totalSize: cacheMetrics.totalSizeBytes
        },
        circuitBreakerState: circuitBreakerState.state,
        deduplicationSavings: deduplicationMetrics.deduplicationSavings,
        systemLoad: {
          activeQueries: deduplicationMetrics.pendingRequests,
          memoryUsage: cacheMetrics.totalSizeBytes / (100 * 1024 * 1024) * 100, // Percentage of 100MB
          cpuUsage: Math.min(100, performanceMetrics.averageQueryTime / 10) // Rough estimate
        },
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error collecting system metrics:', error);
      
      // Return default metrics on error
      return {
        responseTime: { average: 0, p95: 0, p99: 0 },
        errorRate: 0,
        cacheMetrics: { hitRate: 0, missRate: 0, totalSize: 0 },
        circuitBreakerState: 'UNKNOWN',
        deduplicationSavings: 0,
        systemLoad: { activeQueries: 0, memoryUsage: 0, cpuUsage: 0 },
        timestamp: Date.now()
      };
    }
  }

  private checkAlertRules(): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      try {
        this.evaluateAlertRule(rule);
      } catch (error) {
        console.error(`Error evaluating alert rule ${rule.id}:`, error);
      }
    }
  }

  private evaluateAlertRule(rule: AlertRule): void {
    const now = Date.now();
    const windowStart = now - rule.timeWindow;
    
    // Get metrics within the time window
    const relevantMetrics = this.metricsHistory.filter(
      entry => entry.timestamp >= windowStart
    );

    if (relevantMetrics.length < rule.minDataPoints) {
      return; // Not enough data points
    }

    // Extract the specific metric values
    const metricValues = relevantMetrics.map(entry => 
      this.extractMetricValue(entry.metrics, rule.metric)
    ).filter(value => value !== null) as number[];

    if (metricValues.length === 0) {
      return; // No valid metric values
    }

    // Calculate aggregated value
    const currentValue = this.aggregateMetricValues(metricValues, rule.metric.aggregation, rule.metric.percentile);
    
    // Check if threshold is exceeded
    const thresholdExceeded = this.checkThreshold(currentValue, rule.threshold, rule.operator);
    
    if (thresholdExceeded) {
      // Check cooldown period
      const lastAlertTime = this.lastAlertTimes.get(rule.id) || 0;
      if (now - lastAlertTime < rule.cooldownPeriod) {
        return; // Still in cooldown period
      }

      this.triggerAlert(rule, currentValue);
    } else {
      // Check if we should resolve any active alerts for this rule
      this.checkAlertResolution(rule, currentValue);
    }
  }

  private extractMetricValue(metrics: SystemMetrics, metricConfig: AlertMetric): number | null {
    switch (metricConfig.type) {
      case 'response_time':
        return metrics.responseTime.average;
      case 'error_rate':
        return metrics.errorRate;
      case 'cache_hit_rate':
        return metrics.cacheMetrics.hitRate;
      case 'circuit_breaker_state':
        return metrics.circuitBreakerState === 'OPEN' ? 1 : 0;
      case 'deduplication_savings':
        return metrics.deduplicationSavings;
      case 'memory_usage':
        return metrics.systemLoad.memoryUsage;
      case 'active_queries':
        return metrics.systemLoad.activeQueries;
      case 'feature_rollout_health':
        // Get feature flag health score - this is a placeholder since we can't access the internal metrics
        return 0.95; // Assume healthy by default
      default:
        return null;
    }
  }

  private aggregateMetricValues(values: number[], aggregation: string, percentile?: number): number {
    switch (aggregation) {
      case 'average':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'max':
        return Math.max(...values);
      case 'min':
        return Math.min(...values);
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'count':
        return values.length;
      case 'percentile':
        if (!percentile) return values[0];
        const sorted = values.sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
      default:
        return values[0];
    }
  }

  private checkThreshold(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      case 'not_equals':
        return value !== threshold;
      default:
        return false;
    }
  }

  private triggerAlert(rule: AlertRule, currentValue: number): void {
    const alertId = `${rule.id}_${Date.now()}`;
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      timestamp: Date.now(),
      currentValue,
      threshold: rule.threshold,
      severity: rule.severity,
      message: this.formatAlertMessage(rule, currentValue),
      active: true,
      actionsTaken: [],
      context: {
        metric: rule.metric,
        timeWindow: rule.timeWindow,
        operator: rule.operator
      }
    };

    // Execute alert actions
    for (const action of rule.actions) {
      const result = this.executeAlertAction(action, alert, rule);
      alert.actionsTaken.push(result);
    }

    // Store alert
    this.activeAlerts.set(alertId, alert);
    this.alertHistory.push(alert);
    this.lastAlertTimes.set(rule.id, Date.now());

    console.log(`🚨 ALERT TRIGGERED: ${rule.name} - ${alert.message}`);
  }

  private executeAlertAction(action: AlertAction, alert: Alert, rule: AlertRule): AlertActionResult {
    const result: AlertActionResult = {
      actionType: action.type,
      success: false,
      executedAt: Date.now(),
      message: ''
    };

    try {
      switch (action.type) {
        case 'notification':
          result.message = this.formatAlertMessage(rule, alert.currentValue, action.config.message);
          console.log(`📢 NOTIFICATION: ${result.message}`);
          result.success = true;
          break;

        case 'log':
          const logLevel = action.config.logLevel || 'warn';
          const logMessage = action.config.message || alert.message;
          console[logLevel](`🚨 ALERT LOG: ${logMessage}`);
          result.message = `Logged at ${logLevel} level`;
          result.success = true;
          break;

        case 'rollback_feature':
          if (action.config.feature) {
            const trigger = {
              type: 'performance_degradation' as const,
              threshold: rule.threshold,
              timeWindow: rule.timeWindow,
              active: true,
              description: `Alert triggered: ${rule.name}`,
              severity: rule.severity === 'critical' ? 'critical' as const : 'warning' as const,
              action: 'disable_feature' as const
            };
            
            const featureFlagManager = getPerformanceFeatureFlags();
            featureFlagManager.manuallyDisableFeature(action.config.feature as any);
            
            result.message = `Rolled back feature: ${action.config.feature}`;
            result.success = true;
          } else {
            result.message = 'No feature specified for rollback';
          }
          break;

        case 'emergency_rollback':
          // Emergency rollback - disable all features
          const featureFlagManager = getPerformanceFeatureFlags();
          const allFlags = featureFlagManager.getAllFlags();
          Object.keys(allFlags).forEach(feature => {
            featureFlagManager.manuallyDisableFeature(feature as any);
          });
          result.message = 'Emergency rollback executed';
          result.success = true;
          break;

        case 'webhook':
          // Webhook implementation would go here
          result.message = 'Webhook not implemented';
          break;

        default:
          result.message = `Unknown action type: ${action.type}`;
      }
    } catch (error) {
      result.error = error.message;
      result.message = `Action failed: ${error.message}`;
      console.error(`Error executing alert action ${action.type}:`, error);
    }

    return result;
  }

  private checkAlertResolution(rule: AlertRule, currentValue: number): void {
    // Find active alerts for this rule
    const activeAlertsForRule = Array.from(this.activeAlerts.values())
      .filter(alert => alert.ruleId === rule.id && alert.active);

    for (const alert of activeAlertsForRule) {
      // Check if the condition is no longer met (with some hysteresis)
      const hysteresisThreshold = rule.threshold * (rule.operator === 'greater_than' ? 0.9 : 1.1);
      const conditionResolved = !this.checkThreshold(currentValue, hysteresisThreshold, rule.operator);

      if (conditionResolved) {
        this.resolveAlert(alert.id, 'Condition no longer met');
      }
    }
  }

  private formatAlertMessage(rule: AlertRule, currentValue: number, template?: string): string {
    const messageTemplate = template || `${rule.name}: Current value {{currentValue}} ${rule.operator.replace('_', ' ')} threshold {{threshold}}`;
    
    return messageTemplate
      .replace('{{currentValue}}', this.formatMetricValue(currentValue, rule.metric.type))
      .replace('{{threshold}}', this.formatMetricValue(rule.threshold, rule.metric.type))
      .replace('{{ruleName}}', rule.name);
  }

  private formatMetricValue(value: number, metricType: string): string {
    switch (metricType) {
      case 'response_time':
        return `${value.toFixed(0)}ms`;
      case 'error_rate':
      case 'cache_hit_rate':
        return `${(value * 100).toFixed(1)}%`;
      case 'memory_usage':
        return `${value.toFixed(1)}%`;
      case 'deduplication_savings':
        return `${value.toFixed(1)}%`;
      default:
        return value.toString();
    }
  }

  private calculatePerformanceTrends(): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];
    const now = Date.now();
    const timeWindow = 60 * 60 * 1000; // 1 hour
    const recentMetrics = this.metricsHistory.filter(entry => now - entry.timestamp <= timeWindow);

    if (recentMetrics.length < 10) {
      return trends; // Not enough data for trends
    }

    const metricTypes = ['response_time', 'error_rate', 'cache_hit_rate', 'deduplication_savings'];
    
    for (const metricType of metricTypes) {
      const dataPoints = recentMetrics.map(entry => ({
        timestamp: entry.timestamp,
        value: this.extractMetricValue(entry.metrics, { type: metricType as any, aggregation: 'average' }) || 0
      }));

      // Calculate trend
      const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
      const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));

      const firstAvg = firstHalf.reduce((sum, dp) => sum + dp.value, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, dp) => sum + dp.value, 0) / secondHalf.length;

      const changePercent = firstAvg !== 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
      
      let trend: 'improving' | 'stable' | 'degrading' = 'stable';
      if (Math.abs(changePercent) > 5) {
        // For response time and error rate, lower is better
        if (metricType === 'response_time' || metricType === 'error_rate') {
          trend = changePercent < 0 ? 'improving' : 'degrading';
        } else {
          // For cache hit rate and deduplication savings, higher is better
          trend = changePercent > 0 ? 'improving' : 'degrading';
        }
      }

      trends.push({
        metric: metricType,
        dataPoints,
        trend,
        changePercent
      });
    }

    return trends;
  }

  private getFeatureFlagHealthData(): FeatureFlagHealthData[] {
    const healthData: FeatureFlagHealthData[] = [];
    
    try {
      const featureFlagManager = getPerformanceFeatureFlags();
      const featureStates = featureFlagManager.getFeatureStatus();

      for (const [feature, state] of Object.entries(featureStates)) {
        
        let health: 'healthy' | 'warning' | 'critical' = 'healthy';
        const recentIssues: string[] = [];

        // Simplified health checks without featureMetrics
        // In a full implementation, these would come from actual monitoring
        
        const stateData = state as any;
        healthData.push({
          feature,
          enabled: stateData?.enabled || false,
          rolloutPercentage: stateData?.rolloutPercentage || 0,
          health,
          performanceImpact: 0, // Feature metrics not available
          recentIssues
        });
      }
    } catch (error) {
      console.error('Error getting feature flag health data:', error);
    }

    return healthData;
  }

  private cleanupOldData(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up old alert history
    this.alertHistory = this.alertHistory.filter(alert => now - alert.timestamp <= maxAge);

    // Clean up old metrics history
    this.metricsHistory = this.metricsHistory.filter(entry => now - entry.timestamp <= maxAge);
  }
}

// Global alerting system instance
export const performanceAlertingSystem = new PerformanceAlertingSystem();