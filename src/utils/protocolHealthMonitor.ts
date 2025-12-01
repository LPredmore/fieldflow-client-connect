/**
 * Protocol Health Monitor
 * 
 * Tracks HTTP/2 and HTTP/1.1 performance metrics to make intelligent
 * protocol selection decisions.
 */

import { resilienceLogger } from './resilienceLogger';

export interface ProtocolMetrics {
  successCount: number;
  failureCount: number;
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  lastSuccessTime: number;
  lastFailureTime: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export interface ProtocolHealth {
  protocol: 'http2' | 'http1.1';
  metrics: ProtocolMetrics;
  health: 'excellent' | 'good' | 'poor' | 'critical';
  recommendation: 'use' | 'avoid' | 'fallback';
  reasons: string[];
}

export interface ProtocolRecommendation {
  recommended: 'http2' | 'http1.1';
  confidence: number; // 0-1
  reasons: string[];
  shouldSwitch: boolean;
}

/**
 * Protocol Health Monitor
 * 
 * Monitors and analyzes protocol performance to recommend optimal protocol
 */
export class ProtocolHealthMonitor {
  private metrics: Map<'http2' | 'http1.1', ProtocolMetrics> = new Map();
  private readonly HEALTH_THRESHOLDS = {
    excellent: { successRate: 0.95, avgResponseTime: 1000 },
    good: { successRate: 0.85, avgResponseTime: 2000 },
    poor: { successRate: 0.70, avgResponseTime: 3000 },
    // Below poor is critical
  };
  private readonly CONSECUTIVE_FAILURE_THRESHOLD = 5;
  private readonly MIN_REQUESTS_FOR_RECOMMENDATION = 10;

  constructor() {
    // Initialize metrics for both protocols
    this.metrics.set('http2', this.createEmptyMetrics());
    this.metrics.set('http1.1', this.createEmptyMetrics());
    
    resilienceLogger.info('protocol-monitor', 'Protocol Health Monitor initialized');
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(): ProtocolMetrics {
    return {
      successCount: 0,
      failureCount: 0,
      totalRequests: 0,
      successRate: 1.0,
      avgResponseTime: 0,
      lastSuccessTime: 0,
      lastFailureTime: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0
    };
  }

  /**
   * Record successful request
   */
  recordSuccess(protocol: 'http2' | 'http1.1', responseTime: number): void {
    const metrics = this.metrics.get(protocol)!;
    
    metrics.successCount++;
    metrics.totalRequests++;
    metrics.lastSuccessTime = Date.now();
    metrics.consecutiveSuccesses++;
    metrics.consecutiveFailures = 0;
    
    // Update success rate
    metrics.successRate = metrics.successCount / metrics.totalRequests;
    
    // Update average response time (exponential moving average)
    const alpha = 0.2; // Smoothing factor
    if (metrics.avgResponseTime === 0) {
      metrics.avgResponseTime = responseTime;
    } else {
      metrics.avgResponseTime = alpha * responseTime + (1 - alpha) * metrics.avgResponseTime;
    }

    resilienceLogger.debug('protocol-monitor', `Recorded success for ${protocol}`, {
      responseTime,
      successRate: metrics.successRate,
      avgResponseTime: metrics.avgResponseTime
    });
  }

  /**
   * Record failed request
   */
  recordFailure(protocol: 'http2' | 'http1.1', error: Error): void {
    const metrics = this.metrics.get(protocol)!;
    
    metrics.failureCount++;
    metrics.totalRequests++;
    metrics.lastFailureTime = Date.now();
    metrics.consecutiveFailures++;
    metrics.consecutiveSuccesses = 0;
    
    // Update success rate
    metrics.successRate = metrics.successCount / metrics.totalRequests;

    resilienceLogger.warn('protocol-monitor', `Recorded failure for ${protocol}`, {
      error: error.message,
      successRate: metrics.successRate,
      consecutiveFailures: metrics.consecutiveFailures
    });

    // Log alert if consecutive failures exceed threshold
    if (metrics.consecutiveFailures >= this.CONSECUTIVE_FAILURE_THRESHOLD) {
      resilienceLogger.error('protocol-monitor', `${protocol} has ${metrics.consecutiveFailures} consecutive failures`, {
        protocol,
        consecutiveFailures: metrics.consecutiveFailures,
        threshold: this.CONSECUTIVE_FAILURE_THRESHOLD
      });
    }
  }

  /**
   * Get health assessment for a protocol
   */
  getProtocolHealth(protocol: 'http2' | 'http1.1'): ProtocolHealth {
    const metrics = this.metrics.get(protocol)!;
    const reasons: string[] = [];
    
    // Determine health level
    let health: 'excellent' | 'good' | 'poor' | 'critical';
    let recommendation: 'use' | 'avoid' | 'fallback';

    if (metrics.totalRequests < this.MIN_REQUESTS_FOR_RECOMMENDATION) {
      health = 'good';
      recommendation = 'use';
      reasons.push('Insufficient data for accurate assessment');
    } else if (
      metrics.successRate >= this.HEALTH_THRESHOLDS.excellent.successRate &&
      metrics.avgResponseTime <= this.HEALTH_THRESHOLDS.excellent.avgResponseTime
    ) {
      health = 'excellent';
      recommendation = 'use';
      reasons.push(`High success rate (${(metrics.successRate * 100).toFixed(1)}%)`);
      reasons.push(`Fast response time (${metrics.avgResponseTime.toFixed(0)}ms)`);
    } else if (
      metrics.successRate >= this.HEALTH_THRESHOLDS.good.successRate &&
      metrics.avgResponseTime <= this.HEALTH_THRESHOLDS.good.avgResponseTime
    ) {
      health = 'good';
      recommendation = 'use';
      reasons.push(`Good success rate (${(metrics.successRate * 100).toFixed(1)}%)`);
    } else if (
      metrics.successRate >= this.HEALTH_THRESHOLDS.poor.successRate &&
      metrics.avgResponseTime <= this.HEALTH_THRESHOLDS.poor.avgResponseTime
    ) {
      health = 'poor';
      recommendation = 'fallback';
      reasons.push(`Low success rate (${(metrics.successRate * 100).toFixed(1)}%)`);
      reasons.push(`Slow response time (${metrics.avgResponseTime.toFixed(0)}ms)`);
    } else {
      health = 'critical';
      recommendation = 'avoid';
      reasons.push(`Critical success rate (${(metrics.successRate * 100).toFixed(1)}%)`);
      reasons.push(`Very slow response time (${metrics.avgResponseTime.toFixed(0)}ms)`);
    }

    // Check for consecutive failures
    if (metrics.consecutiveFailures >= this.CONSECUTIVE_FAILURE_THRESHOLD) {
      health = 'critical';
      recommendation = 'avoid';
      reasons.push(`${metrics.consecutiveFailures} consecutive failures`);
    }

    return {
      protocol,
      metrics: { ...metrics },
      health,
      recommendation,
      reasons
    };
  }

  /**
   * Get protocol recommendation based on comparative health
   */
  getRecommendation(currentProtocol: 'http2' | 'http1.1'): ProtocolRecommendation {
    const http2Health = this.getProtocolHealth('http2');
    const http1Health = this.getProtocolHealth('http1.1');
    
    const reasons: string[] = [];
    let recommended: 'http2' | 'http1.1';
    let confidence: number;
    let shouldSwitch: boolean;

    // If current protocol is healthy, stick with it
    if (currentProtocol === 'http2' && http2Health.recommendation === 'use') {
      recommended = 'http2';
      confidence = 0.9;
      shouldSwitch = false;
      reasons.push('HTTP/2 is performing well');
    } else if (currentProtocol === 'http1.1' && http1Health.recommendation === 'use') {
      recommended = 'http1.1';
      confidence = 0.9;
      shouldSwitch = false;
      reasons.push('HTTP/1.1 is performing well');
    }
    // If current protocol should be avoided, switch
    else if (currentProtocol === 'http2' && http2Health.recommendation === 'avoid') {
      recommended = 'http1.1';
      confidence = 0.95;
      shouldSwitch = true;
      reasons.push('HTTP/2 is experiencing critical issues');
      reasons.push(...http2Health.reasons);
    } else if (currentProtocol === 'http1.1' && http1Health.recommendation === 'avoid') {
      recommended = 'http2';
      confidence = 0.95;
      shouldSwitch = true;
      reasons.push('HTTP/1.1 is experiencing critical issues');
      reasons.push(...http1Health.reasons);
    }
    // Compare protocols if current is in fallback state
    else {
      // Calculate scores
      const http2Score = this.calculateProtocolScore(http2Health);
      const http1Score = this.calculateProtocolScore(http1Health);
      
      if (http2Score > http1Score * 1.2) {
        // HTTP/2 is significantly better
        recommended = 'http2';
        confidence = Math.min(0.9, http2Score / (http1Score + 0.1));
        shouldSwitch = currentProtocol !== 'http2';
        reasons.push('HTTP/2 shows better performance');
        reasons.push(`HTTP/2 score: ${http2Score.toFixed(2)}, HTTP/1.1 score: ${http1Score.toFixed(2)}`);
      } else if (http1Score > http2Score * 1.2) {
        // HTTP/1.1 is significantly better
        recommended = 'http1.1';
        confidence = Math.min(0.9, http1Score / (http2Score + 0.1));
        shouldSwitch = currentProtocol !== 'http1.1';
        reasons.push('HTTP/1.1 shows better performance');
        reasons.push(`HTTP/1.1 score: ${http1Score.toFixed(2)}, HTTP/2 score: ${http2Score.toFixed(2)}`);
      } else {
        // Protocols are similar, prefer HTTP/2
        recommended = 'http2';
        confidence = 0.5;
        shouldSwitch = false;
        reasons.push('Protocols have similar performance, preferring HTTP/2');
      }
    }

    resilienceLogger.info('protocol-monitor', 'Protocol recommendation generated', {
      currentProtocol,
      recommended,
      confidence,
      shouldSwitch,
      reasons
    });

    return {
      recommended,
      confidence,
      reasons,
      shouldSwitch
    };
  }

  /**
   * Calculate protocol score for comparison
   */
  private calculateProtocolScore(health: ProtocolHealth): number {
    const metrics = health.metrics;
    
    // Insufficient data
    if (metrics.totalRequests < this.MIN_REQUESTS_FOR_RECOMMENDATION) {
      return 0.5;
    }

    // Weight success rate heavily (70%)
    const successScore = metrics.successRate * 0.7;
    
    // Weight response time (30%)
    // Normalize response time to 0-1 scale (lower is better)
    const normalizedResponseTime = Math.max(0, 1 - (metrics.avgResponseTime / 5000));
    const responseScore = normalizedResponseTime * 0.3;
    
    // Penalty for consecutive failures
    const failurePenalty = Math.min(0.5, metrics.consecutiveFailures * 0.1);
    
    return Math.max(0, successScore + responseScore - failurePenalty);
  }

  /**
   * Get metrics for a protocol
   */
  getMetrics(protocol: 'http2' | 'http1.1'): ProtocolMetrics {
    return { ...this.metrics.get(protocol)! };
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): { http2: ProtocolMetrics; http1: ProtocolMetrics } {
    return {
      http2: this.getMetrics('http2'),
      http1: this.getMetrics('http1.1')
    };
  }

  /**
   * Reset metrics for a protocol
   */
  resetMetrics(protocol: 'http2' | 'http1.1'): void {
    this.metrics.set(protocol, this.createEmptyMetrics());
    resilienceLogger.info('protocol-monitor', `Reset metrics for ${protocol}`);
  }

  /**
   * Reset all metrics
   */
  resetAllMetrics(): void {
    this.metrics.set('http2', this.createEmptyMetrics());
    this.metrics.set('http1.1', this.createEmptyMetrics());
    resilienceLogger.info('protocol-monitor', 'Reset all protocol metrics');
  }

  /**
   * Get summary report
   */
  getSummary(): {
    http2: ProtocolHealth;
    http1: ProtocolHealth;
    recommendation: ProtocolRecommendation;
  } {
    const http2Health = this.getProtocolHealth('http2');
    const http1Health = this.getProtocolHealth('http1.1');
    const recommendation = this.getRecommendation('http2'); // Default to http2 for recommendation

    return {
      http2: http2Health,
      http1: http1Health,
      recommendation
    };
  }
}

// Export singleton instance
export const protocolHealthMonitor = new ProtocolHealthMonitor();
