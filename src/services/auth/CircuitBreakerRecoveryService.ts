/**
 * Circuit Breaker Recovery Service
 * 
 * Manages circuit breaker state for authentication operations.
 * Tracks failures, opens circuit when threshold is reached,
 * and provides recovery mechanisms.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { authLogger, AuthLogCategory } from './AuthLogger';

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number; // milliseconds
  halfOpenMaxAttempts: number;
}

export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  nextRetryTime: number | null;
}

type StateChangeListener = (state: CircuitBreakerState, status: CircuitBreakerStatus) => void;

export class CircuitBreakerRecoveryService {
  private state: CircuitBreakerState = 'closed';
  private failureCount: number = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private halfOpenAttempts: number = 0;
  private resetTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private listeners: StateChangeListener[] = [];

  private readonly config: CircuitBreakerConfig = {
    failureThreshold: 3,
    resetTimeout: 30000, // 30 seconds
    halfOpenMaxAttempts: 1
  };

  constructor(config?: Partial<CircuitBreakerConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    authLogger.logCircuitBreaker('Circuit breaker initialized', this.config);
  }

  /**
   * Record a successful operation
   * Resets failure count and closes circuit if open
   */
  recordSuccess(): void {
    authLogger.logCircuitBreaker('Recording success', {
      previousState: this.state,
      failureCount: this.failureCount
    });

    this.lastSuccessTime = Date.now();
    this.failureCount = 0;
    this.halfOpenAttempts = 0;

    if (this.state !== 'closed') {
      this.transitionTo('closed');
    }

    this.clearResetTimeout();
  }

  /**
   * Record a failed operation
   * Increments failure count and may open circuit
   */
  recordFailure(error?: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    authLogger.logCircuitBreaker('Recording failure', {
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold,
      state: this.state,
      error: error?.message
    });

    // Handle based on current state
    if (this.state === 'closed') {
      // Check if we should open the circuit
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionTo('open');
        this.scheduleHalfOpen();
      }
    } else if (this.state === 'half-open') {
      // Failed during half-open test, go back to open
      this.halfOpenAttempts++;
      this.transitionTo('open');
      this.scheduleHalfOpen();
    }
  }

  /**
   * Check if operation should be allowed
   * @returns true if operation can proceed, false if circuit is open
   */
  canProceed(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'half-open') {
      // Allow limited attempts in half-open state
      return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;
    }

    // State is 'open'
    // Check if enough time has passed to try half-open
    if (this.lastFailureTime) {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure >= this.config.resetTimeout) {
        this.transitionTo('half-open');
        return true;
      }
    }

    return false;
  }

  /**
   * Manually reset the circuit breaker
   * Used for user-initiated recovery
   */
  reset(): void {
    authLogger.logCircuitBreaker('Manual reset triggered', {
      previousState: this.state,
      failureCount: this.failureCount
    });

    this.failureCount = 0;
    this.halfOpenAttempts = 0;
    this.lastFailureTime = null;
    this.clearResetTimeout();
    this.transitionTo('closed');
  }

  /**
   * Get current circuit breaker status
   */
  getStatus(): CircuitBreakerStatus {
    let nextRetryTime: number | null = null;

    if (this.state === 'open' && this.lastFailureTime) {
      nextRetryTime = this.lastFailureTime + this.config.resetTimeout;
    }

    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextRetryTime
    };
  }

  /**
   * Check if circuit breaker is open
   */
  isOpen(): boolean {
    return this.state === 'open';
  }

  /**
   * Check if circuit breaker is closed
   */
  isClosed(): boolean {
    return this.state === 'closed';
  }

  /**
   * Check if circuit breaker is half-open
   */
  isHalfOpen(): boolean {
    return this.state === 'half-open';
  }

  /**
   * Add a state change listener
   * @param listener - Function to call when state changes
   * @returns Function to remove the listener
   */
  onStateChange(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitBreakerState): void {
    if (this.state === newState) {
      return;
    }

    const oldState = this.state;
    this.state = newState;

    authLogger.logCircuitBreaker('State transition', {
      from: oldState,
      to: newState,
      failureCount: this.failureCount
    });

    // Notify listeners
    const status = this.getStatus();
    this.listeners.forEach(listener => {
      try {
        listener(newState, status);
      } catch (error) {
        authLogger.logError(AuthLogCategory.CIRCUIT_BREAKER, 'Listener error', error as Error);
      }
    });
  }

  /**
   * Schedule transition to half-open state
   */
  private scheduleHalfOpen(): void {
    this.clearResetTimeout();

    this.resetTimeoutId = setTimeout(() => {
      if (this.state === 'open') {
        authLogger.logCircuitBreaker('Auto-transitioning to half-open', {
          resetTimeout: this.config.resetTimeout
        });
        this.transitionTo('half-open');
        this.halfOpenAttempts = 0;
      }
    }, this.config.resetTimeout);
  }

  /**
   * Clear the reset timeout
   */
  private clearResetTimeout(): void {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
  }

  /**
   * Get configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   * Note: Does not reset current state
   */
  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    Object.assign(this.config, config);
    authLogger.logCircuitBreaker('Configuration updated', this.config);
  }
}

// Export singleton instance
export const circuitBreakerRecoveryService = new CircuitBreakerRecoveryService();
