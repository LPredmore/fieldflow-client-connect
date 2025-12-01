/**
 * Network Quality Monitor - Production Implementation
 * Monitors network quality, latency, error rates, and connection status
 */

export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

export interface NetworkMetrics {
  latency: number;
  bandwidth: number;
  packetLoss: number;
  errorRate: number;
  avgResponseTime: number;
  jitter: number;
}

export interface NetworkQualityResult {
  status: NetworkQuality;
  metrics: NetworkMetrics;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

interface RequestRecord {
  startTime: number;
  endTime?: number;
  success: boolean;
  responseTime?: number;
  error?: Error;
}

class NetworkQualityMonitor {
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private requestHistory: RequestRecord[] = [];
  private readonly maxHistorySize = 100;
  private latencyHistory: number[] = [];
  private connectionInfo: any = null;
  private lastHealthCheck = 0;
  private readonly healthCheckInterval = 5000; // 5 seconds

  constructor() {
    // Initialize with browser's connection API if available
    this.updateConnectionInfo();
    
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleConnectionChange());
      window.addEventListener('offline', () => this.handleConnectionChange());
    }
  }

  /**
   * Update connection information from Navigator API
   */
  private updateConnectionInfo() {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      this.connectionInfo = {
        effectiveType: connection?.effectiveType,
        downlink: connection?.downlink,
        rtt: connection?.rtt,
        saveData: connection?.saveData,
      };
    }
  }

  /**
   * Handle connection change events
   */
  private handleConnectionChange() {
    this.updateConnectionInfo();
    this.performHealthCheck();
  }

  /**
   * Perform a health check by pinging a reliable endpoint
   */
  private async performHealthCheck(): Promise<number> {
    const startTime = performance.now();
    try {
      // Use a small, fast endpoint for health checks
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
      });
      const endTime = performance.now();
      const latency = endTime - startTime;
      
      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > 20) {
        this.latencyHistory.shift();
      }
      
      return latency;
    } catch (error) {
      return -1; // Error indicator
    }
  }

  /**
   * Calculate network quality based on metrics
   */
  private calculateQuality(metrics: NetworkMetrics): NetworkQuality {
    if (!this.isOnline()) return 'offline';
    
    const { latency, errorRate, avgResponseTime } = metrics;
    
    // Excellent: Low latency, no errors
    if (latency < 50 && errorRate < 0.01 && avgResponseTime < 100) {
      return 'excellent';
    }
    
    // Good: Moderate latency, few errors
    if (latency < 150 && errorRate < 0.05 && avgResponseTime < 500) {
      return 'good';
    }
    
    // Fair: Higher latency or some errors
    if (latency < 300 && errorRate < 0.15 && avgResponseTime < 1000) {
      return 'fair';
    }
    
    // Poor: High latency or many errors
    return 'poor';
  }

  /**
   * Calculate metrics from request history
   */
  private calculateMetrics(): NetworkMetrics {
    if (this.requestHistory.length === 0) {
      return {
        latency: 0,
        bandwidth: 0,
        packetLoss: 0,
        errorRate: 0,
        avgResponseTime: 0,
        jitter: 0,
      };
    }

    const recentRequests = this.requestHistory.slice(-50);
    const completedRequests = recentRequests.filter(r => r.endTime);
    const failedRequests = recentRequests.filter(r => !r.success);
    
    // Calculate average response time
    const responseTimes = completedRequests
      .map(r => r.responseTime!)
      .filter(t => t !== undefined);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    // Calculate latency (use connection RTT or average response time)
    const latency = this.connectionInfo?.rtt || 
      (this.latencyHistory.length > 0 
        ? this.latencyHistory.reduce((sum, l) => sum + l, 0) / this.latencyHistory.length
        : avgResponseTime);

    // Calculate jitter (variance in latency)
    const jitter = this.latencyHistory.length > 1
      ? Math.sqrt(
          this.latencyHistory
            .map(l => Math.pow(l - latency, 2))
            .reduce((sum, val) => sum + val, 0) / this.latencyHistory.length
        )
      : 0;

    // Error rate
    const errorRate = recentRequests.length > 0
      ? failedRequests.length / recentRequests.length
      : 0;

    // Bandwidth (use connection downlink if available)
    const bandwidth = this.connectionInfo?.downlink || 0;

    return {
      latency,
      bandwidth,
      packetLoss: errorRate * 100, // Convert to percentage
      errorRate,
      avgResponseTime,
      jitter,
    };
  }

  /**
   * Start monitoring network quality
   */
  startMonitoring(intervalMs: number = 10000) {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.updateConnectionInfo();
      
      // Periodic health check
      const now = Date.now();
      if (now - this.lastHealthCheck > this.healthCheckInterval) {
        this.performHealthCheck();
        this.lastHealthCheck = now;
      }
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
  }

  /**
   * Record a new request
   */
  recordRequest(): string {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.requestHistory.push({
      startTime: performance.now(),
      success: false,
    });
    
    // Trim history if needed
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory.shift();
    }
    
    return requestId;
  }

  /**
   * Record a successful request completion
   */
  recordSuccess(startTime: number) {
    const endTime = performance.now();
    const request = this.requestHistory.find(r => r.startTime === startTime);
    if (request) {
      request.endTime = endTime;
      request.responseTime = endTime - startTime;
      request.success = true;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(startTime: number, error: Error) {
    const endTime = performance.now();
    const request = this.requestHistory.find(r => r.startTime === startTime);
    if (request) {
      request.endTime = endTime;
      request.responseTime = endTime - startTime;
      request.success = false;
      request.error = error;
    }
  }

  /**
   * Check if online
   */
  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  /**
   * Get current latency estimate
   */
  getLatency(): number {
    return this.calculateMetrics().latency;
  }

  /**
   * Get current bandwidth estimate
   */
  getBandwidth(): number {
    return this.calculateMetrics().bandwidth;
  }

  /**
   * Get current network quality
   */
  getQuality(): NetworkQualityResult {
    this.updateConnectionInfo();
    const metrics = this.calculateMetrics();
    const status = this.calculateQuality(metrics);

    return {
      status,
      metrics,
      connectionType: this.connectionInfo?.effectiveType,
      effectiveType: this.connectionInfo?.effectiveType,
      downlink: this.connectionInfo?.downlink,
      rtt: this.connectionInfo?.rtt,
    };
  }

  /**
   * Get request statistics
   */
  getStats() {
    const total = this.requestHistory.length;
    const successful = this.requestHistory.filter(r => r.success).length;
    const failed = this.requestHistory.filter(r => !r.success).length;
    
    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? successful / total : 0,
      errorRate: total > 0 ? failed / total : 0,
    };
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.requestHistory = [];
    this.latencyHistory = [];
  }
}

// Export singleton instance
export const networkQualityMonitor = new NetworkQualityMonitor();
