/**
 * Circuit Breaker Monitoring and Alerting System
 * Tracks circuit breaker state changes, collects metrics, and provides alerting
 */

export interface CircuitBreakerEvent {
  timestamp: number;
  eventType: 'state_change' | 'error' | 'success' | 'reset';
  previousState?: string;
  newState?: string;
  errorType?: string;
  errorMessage?: string;
  failureCount?: number;
  successCount?: number;
  requestCount?: number;
}

export interface CircuitBreakerMetrics {
  totalStateChanges: number;
  openEvents: number;
  closedEvents: number;
  halfOpenEvents: number;
  totalErrors: number;
  totalSuccesses: number;
  totalRequests: number;
  errorsByType: Record<string, number>;
  averageTimeInOpenState: number;
  averageRecoveryTime: number;
  frequentOpeningAlerts: number;
  lastOpenTime?: number;
  lastCloseTime?: number;
  uptime: number;
  reliability: number; // Success rate percentage
}

export interface AlertConfig {
  enabled: boolean;
  frequentOpeningThreshold: number; // Number of opens in time window
  frequentOpeningWindow: number; // Time window in ms
  longOpenDurationThreshold: number; // Alert if open for longer than this
  lowReliabilityThreshold: number; // Alert if reliability drops below this percentage
}

class CircuitBreakerMonitor {
  private events: CircuitBreakerEvent[] = [];
  private metrics: CircuitBreakerMetrics;
  private alertConfig: AlertConfig;
  private alertCallbacks: Array<(alert: AlertInfo) => void> = [];
  private enabled = true;
  private maxEventHistory = 1000; // Keep last 1000 events

  constructor(alertConfig?: Partial<AlertConfig>) {
    this.alertConfig = {
      enabled: true,
      frequentOpeningThreshold: 3, // 3 opens in 5 minutes triggers alert
      frequentOpeningWindow: 5 * 60 * 1000, // 5 minutes
      longOpenDurationThreshold: 2 * 60 * 1000, // 2 minutes
      lowReliabilityThreshold: 80, // Alert if success rate < 80%
      ...alertConfig
    };

    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): CircuitBreakerMetrics {
    return {
      totalStateChanges: 0,
      openEvents: 0,
      closedEvents: 0,
      halfOpenEvents: 0,
      totalErrors: 0,
      totalSuccesses: 0,
      totalRequests: 0,
      errorsByType: {},
      averageTimeInOpenState: 0,
      averageRecoveryTime: 0,
      frequentOpeningAlerts: 0,
      uptime: 100,
      reliability: 100
    };
  }

  // Event logging methods
  logStateChange(previousState: string, newState: string, context?: CircuitBreakerContext): void {
    if (!this.enabled) return;

    const event: CircuitBreakerEvent = {
      timestamp: Date.now(),
      eventType: 'state_change',
      previousState,
      newState,
      failureCount: context?.failureCount,
      successCount: context?.successCount,
      requestCount: context?.requestCount
    };

    this.addEvent(event);
    this.updateStateChangeMetrics(previousState, newState);
    this.checkForAlerts();

    // Enhanced logging with context
    console.log(`🔄 [Circuit Breaker] State change: ${previousState} → ${newState}`, {
      timestamp: new Date(event.timestamp).toISOString(),
      failureCount: context?.failureCount,
      successCount: context?.successCount,
      requestCount: context?.requestCount,
      metrics: this.getMetricsSummary()
    });
  }

  logError(errorType: string, errorMessage: string, context?: CircuitBreakerContext): void {
    if (!this.enabled) return;

    const event: CircuitBreakerEvent = {
      timestamp: Date.now(),
      eventType: 'error',
      errorType,
      errorMessage,
      failureCount: context?.failureCount,
      requestCount: context?.requestCount
    };

    this.addEvent(event);
    this.updateErrorMetrics(errorType);
    this.checkForAlerts(); // Check for alerts after error

    // Enhanced error logging
    console.error(`❌ [Circuit Breaker] Error logged: ${errorType}`, {
      message: errorMessage,
      timestamp: new Date(event.timestamp).toISOString(),
      failureCount: context?.failureCount,
      currentState: context?.currentState,
      errorFrequency: this.getErrorFrequency(errorType)
    });
  }

  logSuccess(context?: CircuitBreakerContext): void {
    if (!this.enabled) return;

    const event: CircuitBreakerEvent = {
      timestamp: Date.now(),
      eventType: 'success',
      successCount: context?.successCount,
      requestCount: context?.requestCount
    };

    this.addEvent(event);
    this.updateSuccessMetrics();
    this.checkForAlerts(); // Check for alerts after success

    // Log success with context (less verbose than errors)
    if (context?.currentState === 'HALF_OPEN') {
      console.log(`✅ [Circuit Breaker] Success in HALF_OPEN state`, {
        successCount: context?.successCount,
        timestamp: new Date(event.timestamp).toISOString()
      });
    }
  }

  logReset(context?: CircuitBreakerContext): void {
    if (!this.enabled) return;

    const event: CircuitBreakerEvent = {
      timestamp: Date.now(),
      eventType: 'reset',
      requestCount: context?.requestCount
    };

    this.addEvent(event);

    console.log(`🔄 [Circuit Breaker] Manual reset performed`, {
      timestamp: new Date(event.timestamp).toISOString(),
      previousMetrics: this.getMetricsSummary()
    });

    // Reset some metrics but keep historical data
    this.metrics.totalErrors = 0;
    this.metrics.totalSuccesses = 0;
    this.metrics.totalRequests = 0;
  }

  // Metrics calculation methods
  private updateStateChangeMetrics(previousState: string, newState: string): void {
    this.metrics.totalStateChanges++;

    switch (newState) {
      case 'OPEN':
        this.metrics.openEvents++;
        this.metrics.lastOpenTime = Date.now();
        break;
      case 'CLOSED':
        this.metrics.closedEvents++;
        this.metrics.lastCloseTime = Date.now();
        this.updateRecoveryTime();
        break;
      case 'HALF_OPEN':
        this.metrics.halfOpenEvents++;
        break;
    }

    this.updateReliabilityMetrics();
  }

  private updateErrorMetrics(errorType: string): void {
    this.metrics.totalErrors++;
    this.metrics.totalRequests++;
    this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;
    this.updateReliabilityMetrics();
  }

  private updateSuccessMetrics(): void {
    this.metrics.totalSuccesses++;
    this.metrics.totalRequests++;
    this.updateReliabilityMetrics();
  }

  private updateReliabilityMetrics(): void {
    if (this.metrics.totalRequests > 0) {
      this.metrics.reliability = (this.metrics.totalSuccesses / this.metrics.totalRequests) * 100;
    }

    // Calculate uptime (percentage of time not in OPEN state)
    const recentEvents = this.getRecentEvents(60 * 60 * 1000); // Last hour
    const openTime = this.calculateTimeInState('OPEN', recentEvents);
    const totalTime = 60 * 60 * 1000; // 1 hour
    this.metrics.uptime = Math.max(0, ((totalTime - openTime) / totalTime) * 100);
  }

  private updateRecoveryTime(): void {
    if (this.metrics.lastOpenTime && this.metrics.lastCloseTime) {
      const recoveryTime = this.metrics.lastCloseTime - this.metrics.lastOpenTime;
      
      // Calculate running average
      const totalRecoveries = this.metrics.closedEvents;
      if (totalRecoveries === 1) {
        this.metrics.averageRecoveryTime = recoveryTime;
      } else {
        this.metrics.averageRecoveryTime = 
          ((this.metrics.averageRecoveryTime * (totalRecoveries - 1)) + recoveryTime) / totalRecoveries;
      }
    }
  }

  // Alert system
  private checkForAlerts(): void {
    if (!this.alertConfig.enabled) return;

    this.checkFrequentOpeningAlert();
    this.checkLongOpenDurationAlert();
    this.checkLowReliabilityAlert();
  }

  private checkFrequentOpeningAlert(): void {
    const recentOpens = this.getRecentEvents(this.alertConfig.frequentOpeningWindow)
      .filter(event => event.eventType === 'state_change' && event.newState === 'OPEN');

    if (recentOpens.length >= this.alertConfig.frequentOpeningThreshold) {
      this.metrics.frequentOpeningAlerts++;
      this.triggerAlert({
        type: 'frequent_opening',
        severity: 'high',
        message: `Circuit breaker opened ${recentOpens.length} times in ${this.alertConfig.frequentOpeningWindow / 1000}s`,
        data: {
          openCount: recentOpens.length,
          timeWindow: this.alertConfig.frequentOpeningWindow,
          recentErrors: this.getRecentErrorTypes()
        }
      });
    }
  }

  private checkLongOpenDurationAlert(): void {
    if (this.metrics.lastOpenTime && !this.metrics.lastCloseTime) {
      const openDuration = Date.now() - this.metrics.lastOpenTime;
      if (openDuration > this.alertConfig.longOpenDurationThreshold) {
        this.triggerAlert({
          type: 'long_open_duration',
          severity: 'medium',
          message: `Circuit breaker has been open for ${Math.round(openDuration / 1000)}s`,
          data: {
            openDuration,
            threshold: this.alertConfig.longOpenDurationThreshold,
            lastErrors: this.getRecentErrors(5)
          }
        });
      }
    }
  }

  private checkLowReliabilityAlert(): void {
    if (this.metrics.totalRequests > 10 && this.metrics.reliability < this.alertConfig.lowReliabilityThreshold) {
      this.triggerAlert({
        type: 'low_reliability',
        severity: 'medium',
        message: `Circuit breaker reliability dropped to ${this.metrics.reliability.toFixed(1)}%`,
        data: {
          reliability: this.metrics.reliability,
          threshold: this.alertConfig.lowReliabilityThreshold,
          totalRequests: this.metrics.totalRequests,
          errorBreakdown: this.metrics.errorsByType
        }
      });
    }
  }

  // Alert management
  onAlert(callback: (alert: AlertInfo) => void): void {
    this.alertCallbacks.push(callback);
  }

  private triggerAlert(alert: AlertInfo): void {
    // Log alert
    console.warn(`🚨 [Circuit Breaker Alert] ${alert.type.toUpperCase()}: ${alert.message}`, alert.data);

    // Notify callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    });
  }

  // Utility methods
  private addEvent(event: CircuitBreakerEvent): void {
    this.events.push(event);
    
    // Keep only recent events to prevent memory issues
    if (this.events.length > this.maxEventHistory) {
      this.events = this.events.slice(-this.maxEventHistory);
    }
  }

  private getRecentEvents(timeWindow: number): CircuitBreakerEvent[] {
    const cutoff = Date.now() - timeWindow;
    return this.events.filter(event => event.timestamp >= cutoff);
  }

  private getRecentErrors(count: number): CircuitBreakerEvent[] {
    return this.events
      .filter(event => event.eventType === 'error')
      .slice(-count);
  }

  private getRecentErrorTypes(): Record<string, number> {
    const recentErrors = this.getRecentEvents(5 * 60 * 1000); // Last 5 minutes
    const errorTypes: Record<string, number> = {};
    
    recentErrors
      .filter(event => event.eventType === 'error' && event.errorType)
      .forEach(event => {
        errorTypes[event.errorType!] = (errorTypes[event.errorType!] || 0) + 1;
      });
    
    return errorTypes;
  }

  private getErrorFrequency(errorType: string): number {
    const recentErrors = this.getRecentEvents(60 * 1000); // Last minute
    return recentErrors.filter(event => 
      event.eventType === 'error' && event.errorType === errorType
    ).length;
  }

  private calculateTimeInState(state: string, events: CircuitBreakerEvent[]): number {
    let totalTime = 0;
    let currentState = 'CLOSED'; // Assume starting state
    let stateStartTime = Date.now() - (60 * 60 * 1000); // 1 hour ago

    for (const event of events) {
      if (event.eventType === 'state_change') {
        if (currentState === state) {
          totalTime += event.timestamp - stateStartTime;
        }
        currentState = event.newState!;
        stateStartTime = event.timestamp;
      }
    }

    // Add time from last state change to now if still in target state
    if (currentState === state) {
      totalTime += Date.now() - stateStartTime;
    }

    return totalTime;
  }

  // Public API methods
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  getMetricsSummary(): object {
    return {
      reliability: `${this.metrics.reliability.toFixed(1)}%`,
      uptime: `${this.metrics.uptime.toFixed(1)}%`,
      totalRequests: this.metrics.totalRequests,
      openEvents: this.metrics.openEvents,
      averageRecoveryTime: `${Math.round(this.metrics.averageRecoveryTime / 1000)}s`,
      topErrorTypes: Object.entries(this.metrics.errorsByType)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([type, count]) => `${type}: ${count}`)
    };
  }

  getEvents(limit?: number): CircuitBreakerEvent[] {
    return limit ? this.events.slice(-limit) : [...this.events];
  }

  // Configuration methods
  updateAlertConfig(config: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
  }

  enable(): void {
    this.enabled = true;
    console.log('🔄 [Circuit Breaker Monitor] Monitoring enabled');
  }

  disable(): void {
    this.enabled = false;
    console.log('🔄 [Circuit Breaker Monitor] Monitoring disabled');
  }

  reset(): void {
    this.events = [];
    this.metrics = this.initializeMetrics();
    console.log('🔄 [Circuit Breaker Monitor] Metrics and events reset');
  }
}

// Alert interface
export interface AlertInfo {
  type: 'frequent_opening' | 'long_open_duration' | 'low_reliability';
  severity: 'low' | 'medium' | 'high';
  message: string;
  data: Record<string, unknown>;
}

export interface CircuitBreakerContext {
  failureCount?: number;
  successCount?: number;
  requestCount?: number;
  currentState?: string;
  retryable?: boolean;
  policyError?: boolean;
  criticalError?: boolean;
}

// Export singleton instance
export const circuitBreakerMonitor = new CircuitBreakerMonitor();

// Development helper to log periodic summaries
if (import.meta.env.DEV) {
  setInterval(() => {
    const metrics = circuitBreakerMonitor.getMetrics();
    if (metrics.totalRequests > 0) {
      console.log('📊 [Circuit Breaker Summary]', circuitBreakerMonitor.getMetricsSummary());
    }
  }, 5 * 60 * 1000); // Every 5 minutes in development
}