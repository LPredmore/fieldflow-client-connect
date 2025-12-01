/**
 * Circuit Breaker Alert Handlers
 * Configures and manages alerts for circuit breaker events
 */

import { circuitBreakerMonitor, AlertInfo } from './circuitBreakerMonitor';

// Alert severity levels for different environments
const ALERT_CONFIG = {
  development: {
    enabled: true,
    frequentOpeningThreshold: 2, // Lower threshold for dev
    frequentOpeningWindow: 2 * 60 * 1000, // 2 minutes
    longOpenDurationThreshold: 30 * 1000, // 30 seconds
    lowReliabilityThreshold: 70, // 70% threshold for dev
  },
  production: {
    enabled: true,
    frequentOpeningThreshold: 3, // 3 opens in 5 minutes
    frequentOpeningWindow: 5 * 60 * 1000, // 5 minutes
    longOpenDurationThreshold: 2 * 60 * 1000, // 2 minutes
    lowReliabilityThreshold: 80, // 80% threshold for prod
  }
};

// Alert handlers for different environments
class CircuitBreakerAlertManager {
  private alertHistory: Array<AlertInfo & { timestamp: number }> = [];
  private maxAlertHistory = 100;

  constructor() {
    this.setupEnvironmentConfig();
    this.setupAlertHandlers();
  }

  private setupEnvironmentConfig(): void {
    const env = import.meta.env.PROD ? 'production' : 'development';
    const config = ALERT_CONFIG[env];
    
    circuitBreakerMonitor.updateAlertConfig(config);
    
    console.log(`🔧 [Circuit Breaker Alerts] Configured for ${env} environment`, config);
  }

  private setupAlertHandlers(): void {
    circuitBreakerMonitor.onAlert((alert: AlertInfo) => {
      this.handleAlert(alert);
    });
  }

  private handleAlert(alert: AlertInfo): void {
    const alertWithTimestamp = {
      ...alert,
      timestamp: Date.now()
    };

    // Store alert in history
    this.alertHistory.push(alertWithTimestamp);
    if (this.alertHistory.length > this.maxAlertHistory) {
      this.alertHistory.shift();
    }

    // Handle different alert types
    switch (alert.type) {
      case 'frequent_opening':
        this.handleFrequentOpeningAlert(alertWithTimestamp);
        break;
      case 'long_open_duration':
        this.handleLongOpenDurationAlert(alertWithTimestamp);
        break;
      case 'low_reliability':
        this.handleLowReliabilityAlert(alertWithTimestamp);
        break;
    }

    // In production, you might want to send these to external monitoring
    if (import.meta.env.PROD) {
      this.sendToExternalMonitoring(alertWithTimestamp);
    }
  }

  private handleFrequentOpeningAlert(alert: AlertInfo & { timestamp: number }): void {
    // This is a high-severity alert indicating potential system issues
    console.error(`🚨 [CRITICAL] Circuit breaker opening frequently!`, {
      message: alert.message,
      data: alert.data,
      timestamp: new Date(alert.timestamp).toISOString(),
      recommendation: 'Check for database connectivity issues, schema problems, or high load'
    });

    // In development, show a more detailed breakdown
    if (import.meta.env.DEV) {
      console.group('🔍 Frequent Opening Alert Details');
      console.log('Recent error types:', alert.data.recentErrors);
      console.log('Time window:', `${Number(alert.data.timeWindow) / 1000}s`);
      console.log('Open count:', alert.data.openCount);
      console.log('Suggested actions:');
      console.log('  1. Check database connectivity');
      console.log('  2. Review recent schema changes');
      console.log('  3. Monitor system load');
      console.log('  4. Check for network issues');
      console.groupEnd();
    }
  }

  private handleLongOpenDurationAlert(alert: AlertInfo & { timestamp: number }): void {
    console.warn(`⚠️ [WARNING] Circuit breaker stuck open`, {
      message: alert.message,
      data: alert.data,
      timestamp: new Date(alert.timestamp).toISOString(),
      recommendation: 'Manual intervention may be required'
    });

    // Show recent errors that might be causing the issue
    if (import.meta.env.DEV && alert.data.lastErrors && Array.isArray(alert.data.lastErrors)) {
      console.group('🔍 Recent Errors Causing Long Open State');
      alert.data.lastErrors.forEach((error: Record<string, unknown>, index: number) => {
        console.log(`${index + 1}. ${error.errorType}: ${error.errorMessage}`);
      });
      console.groupEnd();
    }
  }

  private handleLowReliabilityAlert(alert: AlertInfo & { timestamp: number }): void {
    console.warn(`⚠️ [WARNING] Circuit breaker reliability degraded`, {
      message: alert.message,
      data: alert.data,
      timestamp: new Date(alert.timestamp).toISOString(),
      recommendation: 'Review error patterns and system health'
    });

    // Show error breakdown
    if (import.meta.env.DEV && alert.data.errorBreakdown) {
      console.group('🔍 Error Breakdown');
      Object.entries(alert.data.errorBreakdown).forEach(([errorType, count]) => {
        console.log(`${errorType}: ${count} occurrences`);
      });
      console.groupEnd();
    }
  }

  private sendToExternalMonitoring(alert: AlertInfo & { timestamp: number }): void {
    // In a real application, you would send alerts to external monitoring services
    // Examples: DataDog, New Relic, Sentry, PagerDuty, etc.
    
    // For now, we'll just log that we would send it
    console.log(`📡 [External Monitoring] Would send alert to monitoring service:`, {
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp
    });

    // Example implementations:
    
    // Sentry example:
    // Sentry.captureMessage(alert.message, {
    //   level: alert.severity === 'high' ? 'error' : 'warning',
    //   tags: {
    //     component: 'circuit-breaker',
    //     alert_type: alert.type
    //   },
    //   extra: alert.data
    // });

    // Custom webhook example:
    // fetch('/api/alerts', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(alert)
    // });
  }

  // Public methods for managing alerts
  getAlertHistory(limit?: number): Array<AlertInfo & { timestamp: number }> {
    return limit ? this.alertHistory.slice(-limit) : [...this.alertHistory];
  }

  getAlertSummary(): object {
    const now = Date.now();
    const last24h = this.alertHistory.filter(alert => 
      now - alert.timestamp < 24 * 60 * 60 * 1000
    );

    const alertCounts = last24h.reduce((counts, alert) => {
      counts[alert.type] = (counts[alert.type] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return {
      totalAlerts24h: last24h.length,
      alertsByType: alertCounts,
      lastAlert: this.alertHistory.length > 0 ? 
        this.alertHistory[this.alertHistory.length - 1] : null,
      mostCommonAlertType: Object.entries(alertCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none'
    };
  }

  clearAlertHistory(): void {
    this.alertHistory = [];
    console.log('🔄 [Circuit Breaker Alerts] Alert history cleared');
  }

  // Test method for development
  triggerTestAlert(): void {
    if (!import.meta.env.DEV) {
      console.warn('Test alerts only available in development');
      return;
    }

    console.log('🧪 [Test] Triggering test circuit breaker alert...');
    
    // Simulate a test alert
    this.handleAlert({
      type: 'frequent_opening',
      severity: 'high',
      message: 'Test alert: Circuit breaker opened 3 times in 2 minutes',
      data: {
        openCount: 3,
        timeWindow: 120000,
        recentErrors: {
          'NETWORK_ERROR': 2,
          'TIMEOUT_ERROR': 1
        }
      } as Record<string, unknown>
    });
  }
}

// Export singleton instance
export const circuitBreakerAlertManager = new CircuitBreakerAlertManager();

// Development helper functions
if (import.meta.env.DEV) {
  // Make alert manager available globally for debugging
  (window as unknown as Record<string, unknown>).circuitBreakerAlerts = {
    getHistory: () => circuitBreakerAlertManager.getAlertHistory(),
    getSummary: () => circuitBreakerAlertManager.getAlertSummary(),
    getMetrics: () => circuitBreakerMonitor.getMetrics(),
    triggerTest: () => circuitBreakerAlertManager.triggerTestAlert(),
    clearHistory: () => circuitBreakerAlertManager.clearAlertHistory()
  };

  console.log('🔧 [Dev Tools] Circuit breaker alerts available at window.circuitBreakerAlerts');
}