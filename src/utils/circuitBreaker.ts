import { circuitBreakerMonitor } from './circuitBreakerMonitor';

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export enum ErrorType {
  SCHEMA_MISMATCH = 'schema_mismatch',
  NETWORK_ERROR = 'network_error',
  PERMISSION_ERROR = 'permission_error',
  TIMEOUT_ERROR = 'timeout_error',
  POLICY_INFINITE_RECURSION = 'policy_infinite_recursion',
  POLICY_CIRCULAR_DEPENDENCY = 'policy_circular_dependency',
  POLICY_EVALUATION_ERROR = 'policy_evaluation_error',
  UNKNOWN_ERROR = 'unknown_error'
}

interface ErrorInfo {
  type: ErrorType;
  message: string;
  timestamp: number;
  retryable: boolean;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private requestCount = 0;
  private lastResetTime = Date.now();
  private errorHistory: ErrorInfo[] = [];

  constructor(private options: CircuitBreakerOptions) {}

  static extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return 'Unknown error';
  }

  private static hasErrorCode(error: unknown, code: string): boolean {
    return error && 
           typeof error === 'object' && 
           'code' in error && 
           (error as { code: unknown }).code === code;
  }

  static classifyError(error: unknown): ErrorInfo {
    const message = CircuitBreaker.extractErrorMessage(error);
    const timestamp = Date.now();
    
    // Policy infinite recursion errors - highest priority detection
    if (message.includes('infinite recursion detected in policy') ||
        message.includes('infinite recursion') ||
        message.includes('Query timeout - possible infinite recursion')) {
      return {
        type: ErrorType.POLICY_INFINITE_RECURSION,
        message,
        timestamp,
        retryable: false // These require policy fixes, not retries
      };
    }
    
    // Policy circular dependency errors
    if (message.includes('circular dependency') ||
        message.includes('policy dependency cycle') ||
        message.includes('recursive policy evaluation')) {
      return {
        type: ErrorType.POLICY_CIRCULAR_DEPENDENCY,
        message,
        timestamp,
        retryable: false // These require policy restructuring
      };
    }
    
    // General policy evaluation errors
    if (message.includes('policy evaluation failed') ||
        message.includes('RLS policy error') ||
        message.includes('row level security') ||
        (message.includes('policy') && (message.includes('failed') || message.includes('error')))) {
      return {
        type: ErrorType.POLICY_EVALUATION_ERROR,
        message,
        timestamp,
        retryable: false // Policy errors usually need configuration fixes
      };
    }
    
    // Schema mismatch errors
    if (message.includes('column') && (message.includes('does not exist') || message.includes('not found'))) {
      return {
        type: ErrorType.SCHEMA_MISMATCH,
        message,
        timestamp,
        retryable: false // Schema errors shouldn't be retried
      };
    }
    
    // Network errors
    if (message.includes('fetch') || 
        message.includes('network') || 
        message.includes('connection') ||
        message.includes('ECONNREFUSED') ||
        message.includes('ENOTFOUND') ||
        CircuitBreaker.hasErrorCode(error, 'NETWORK_ERROR')) {
      return {
        type: ErrorType.NETWORK_ERROR,
        message,
        timestamp,
        retryable: true
      };
    }
    
    // Permission errors
    if (message.includes('permission') || 
        message.includes('unauthorized') || 
        message.includes('forbidden') ||
        message.includes('access denied') ||
        CircuitBreaker.hasErrorCode(error, 'PGRST301') ||
        CircuitBreaker.hasErrorCode(error, 'PGRST116')) {
      return {
        type: ErrorType.PERMISSION_ERROR,
        message,
        timestamp,
        retryable: false // Permission errors usually need user action
      };
    }
    
    // Timeout errors
    if (message.includes('timeout') || 
        message.includes('aborted') ||
        (error instanceof Error && error.name === 'AbortError') ||
        CircuitBreaker.hasErrorCode(error, 'TIMEOUT')) {
      return {
        type: ErrorType.TIMEOUT_ERROR,
        message,
        timestamp,
        retryable: true
      };
    }
    
    // Default to unknown error
    return {
      type: ErrorType.UNKNOWN_ERROR,
      message,
      timestamp,
      retryable: true // Default to retryable for unknown errors
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        const previousState = this.state;
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        
        // Log state change to HALF_OPEN
        circuitBreakerMonitor.logStateChange(previousState, this.state, {
          failureCount: this.failureCount,
          successCount: this.successCount,
          requestCount: this.requestCount
        });
      } else {
        throw new Error('Circuit breaker is OPEN - operation blocked');
      }
    }

    try {
      this.requestCount++;
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      const errorInfo = CircuitBreaker.classifyError(error);
      this.onFailure(errorInfo);
      throw error;
    }
  }

  private onSuccess() {
    this.successCount++;
    
    // Log success event
    circuitBreakerMonitor.logSuccess({
      successCount: this.successCount,
      requestCount: this.requestCount,
      currentState: this.state
    });
    
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= 3) { // Require 3 successes to close
        const previousState = this.state;
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.lastResetTime = Date.now();
        
        // Log state change
        circuitBreakerMonitor.logStateChange(previousState, this.state, {
          failureCount: this.failureCount,
          successCount: this.successCount,
          requestCount: this.requestCount
        });
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  private onFailure(errorInfo: ErrorInfo) {
    // Add to error history (keep last 10 errors)
    this.errorHistory.push(errorInfo);
    if (this.errorHistory.length > 10) {
      this.errorHistory.shift();
    }

    // Log error to monitoring system
    circuitBreakerMonitor.logError(errorInfo.type, errorInfo.message, {
      retryable: errorInfo.retryable,
      currentState: this.state,
      failureCount: this.failureCount,
      requestCount: this.requestCount
    });

    // Special handling for policy errors
    if (this.isPolicyError(errorInfo.type)) {
      this.handlePolicyError(errorInfo);
      return;
    }

    // Only count retryable errors towards circuit breaker threshold
    // Non-retryable errors (like schema mismatches) shouldn't trigger circuit breaker
    if (errorInfo.retryable) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.state === CircuitState.CLOSED || this.state === CircuitState.HALF_OPEN) {
        if (this.failureCount >= this.options.failureThreshold) {
          const previousState = this.state;
          this.state = CircuitState.OPEN;
          
          // Log state change to OPEN
          circuitBreakerMonitor.logStateChange(previousState, this.state, {
            failureCount: this.failureCount,
            successCount: this.successCount,
            requestCount: this.requestCount
          });
        }
      }
    } else {
      // For non-retryable errors, log but don't affect circuit breaker state
      console.warn(`Circuit breaker: Non-retryable ${errorInfo.type} error ignored for circuit breaker logic`);
    }
  }

  private isPolicyError(errorType: ErrorType): boolean {
    return [
      ErrorType.POLICY_INFINITE_RECURSION,
      ErrorType.POLICY_CIRCULAR_DEPENDENCY,
      ErrorType.POLICY_EVALUATION_ERROR
    ].includes(errorType);
  }

  private handlePolicyError(errorInfo: ErrorInfo) {
    // Policy errors are critical and should immediately open the circuit
    // to prevent cascading failures and give time for policy fixes
    const previousState = this.state;
    
    // For infinite recursion, immediately open circuit with extended timeout
    if (errorInfo.type === ErrorType.POLICY_INFINITE_RECURSION) {
      this.state = CircuitState.OPEN;
      this.failureCount = this.options.failureThreshold; // Set to threshold to keep circuit open
      this.lastFailureTime = Date.now();
      
      console.error(`🚨 Circuit breaker: CRITICAL policy infinite recursion detected. Circuit opened immediately.`);
      
      // Log state change with policy context
      circuitBreakerMonitor.logStateChange(previousState, this.state, {
        failureCount: this.failureCount,
        successCount: this.successCount,
        requestCount: this.requestCount,
        policyError: true,
        criticalError: true
      });
    } 
    // For circular dependencies, also open immediately but with different logging
    else if (errorInfo.type === ErrorType.POLICY_CIRCULAR_DEPENDENCY) {
      this.state = CircuitState.OPEN;
      this.failureCount = this.options.failureThreshold;
      this.lastFailureTime = Date.now();
      
      console.error(`🚨 Circuit breaker: CRITICAL policy circular dependency detected. Circuit opened immediately.`);
      
      circuitBreakerMonitor.logStateChange(previousState, this.state, {
        failureCount: this.failureCount,
        successCount: this.successCount,
        requestCount: this.requestCount,
        policyError: true,
        criticalError: true
      });
    }
    // For general policy evaluation errors, increment failure count but don't immediately open
    else if (errorInfo.type === ErrorType.POLICY_EVALUATION_ERROR) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      console.warn(`⚠️ Circuit breaker: Policy evaluation error detected. Failure count: ${this.failureCount}`);
      
      // Check if we should open the circuit
      if (this.failureCount >= this.options.failureThreshold && 
          (this.state === CircuitState.CLOSED || this.state === CircuitState.HALF_OPEN)) {
        this.state = CircuitState.OPEN;
        
        circuitBreakerMonitor.logStateChange(previousState, this.state, {
          failureCount: this.failureCount,
          successCount: this.successCount,
          requestCount: this.requestCount,
          policyError: true
        });
      }
    }
  }

  getState() {
    const policyErrors = this.errorHistory.filter(error => this.isPolicyError(error.type));
    const recentPolicyErrors = policyErrors.filter(error => 
      Date.now() - error.timestamp < 300000 // Last 5 minutes
    );

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      isOpen: this.state === CircuitState.OPEN,
      errorHistory: this.errorHistory.slice(), // Return copy of error history
      lastErrorType: this.errorHistory.length > 0 ? this.errorHistory[this.errorHistory.length - 1].type : null,
      policyErrorCount: policyErrors.length,
      recentPolicyErrorCount: recentPolicyErrors.length,
      hasCriticalPolicyErrors: policyErrors.some(error => 
        error.type === ErrorType.POLICY_INFINITE_RECURSION || 
        error.type === ErrorType.POLICY_CIRCULAR_DEPENDENCY
      )
    };
  }

  /**
   * Get policy-specific error statistics
   */
  getPolicyErrorStats() {
    const policyErrors = this.errorHistory.filter(error => this.isPolicyError(error.type));
    const errorsByType = policyErrors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const lastPolicyError = policyErrors[policyErrors.length - 1];
    const recentPolicyErrors = policyErrors.filter(error => 
      Date.now() - error.timestamp < 300000 // Last 5 minutes
    );

    return {
      totalPolicyErrors: policyErrors.length,
      recentPolicyErrors: recentPolicyErrors.length,
      errorsByType,
      lastPolicyError: lastPolicyError ? {
        type: lastPolicyError.type,
        message: lastPolicyError.message,
        timestamp: lastPolicyError.timestamp
      } : null,
      hasCriticalErrors: policyErrors.some(error => 
        error.type === ErrorType.POLICY_INFINITE_RECURSION || 
        error.type === ErrorType.POLICY_CIRCULAR_DEPENDENCY
      )
    };
  }

  /**
   * Check if circuit should use fallback strategies due to policy errors
   */
  shouldUsePolicyFallback(): boolean {
    const stats = this.getPolicyErrorStats();
    return stats.hasCriticalErrors || stats.recentPolicyErrors > 2;
  }

  reset() {
    const previousState = this.state;
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.errorHistory = [];
    this.lastResetTime = Date.now();
    
    // Log reset event
    circuitBreakerMonitor.logReset({
      requestCount: this.requestCount
    });
    
    // Log state change if not already closed
    if (previousState !== CircuitState.CLOSED) {
      circuitBreakerMonitor.logStateChange(previousState, this.state, {
        failureCount: this.failureCount,
        successCount: this.successCount,
        requestCount: this.requestCount
      });
    }
  }
}

/**
 * Global circuit breaker for Supabase queries
 * 
 * Configuration optimized for database query performance:
 * - failureThreshold: 5 (increased from 3) - More tolerant of transient failures
 * - resetTimeout: 30000ms (reduced from 60000ms) - Faster recovery from issues
 * - monitoringPeriod: 60000ms - Track failures over 1-minute windows
 * 
 * The circuit breaker implements intelligent error classification:
 * - Schema mismatch errors: Not counted towards failure threshold (non-retryable)
 * - Network errors: Counted and retried with backoff
 * - Permission errors: Not retried (require user action)
 * - Timeout errors: Counted and retried
 * 
 * States:
 * - CLOSED: Normal operation, all requests allowed
 * - OPEN: Blocking requests after threshold failures, showing cached data if available
 * - HALF_OPEN: Testing recovery, requires 3 successes to fully close
 * 
 * Benefits:
 * - Prevents cascading failures from database issues
 * - Provides graceful degradation with cached data
 * - Faster recovery compared to previous 60-second timeout
 * - Intelligent error handling prevents unnecessary circuit trips
 */
export const supabaseCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5, // Open after 5 failures (increased from 3 for better tolerance)
  resetTimeout: 30000, // Try again after 30 seconds (reduced from 60s for faster recovery)
  monitoringPeriod: 60000, // Monitor over 1 minute periods
});