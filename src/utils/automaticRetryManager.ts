/**
 * Automatic Retry Manager
 * 
 * Implements automatic retry logic with exponential backoff for recoverable errors.
 * Integrates with circuit breaker to prevent retry storms during outages.
 */

import { ErrorType, supabaseCircuitBreaker } from './circuitBreaker';

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay in milliseconds for exponential backoff */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Maximum jitter in milliseconds to prevent thundering herd */
  maxJitter: number;
  /** Whether to respect circuit breaker state */
  respectCircuitBreaker: boolean;
}

export interface RetryAttempt {
  /** Attempt number (1-based) */
  attemptNumber: number;
  /** Delay before this attempt in milliseconds */
  delay: number;
  /** Timestamp when attempt was made */
  timestamp: number;
  /** Error that triggered this retry */
  error: any;
  /** Error type classification */
  errorType: ErrorType;
}

export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Final error if all retries failed */
  error?: any;
  /** Total number of attempts made */
  totalAttempts: number;
  /** Total time spent on retries */
  totalDuration: number;
  /** History of retry attempts */
  attempts: RetryAttempt[];
}

export class AutomaticRetryManager {
  private static instance: AutomaticRetryManager;
  private activeRetries = new Map<string, Promise<any>>();
  private retryStats = new Map<string, RetryAttempt[]>();

  static getInstance(): AutomaticRetryManager {
    if (!AutomaticRetryManager.instance) {
      AutomaticRetryManager.instance = new AutomaticRetryManager();
    }
    return AutomaticRetryManager.instance;
  }

  /**
   * Execute operation with automatic retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    operationId?: string
  ): Promise<RetryResult<T>> {
    const finalConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      maxJitter: 1000,
      respectCircuitBreaker: true,
      ...config
    };

    const startTime = Date.now();
    const attempts: RetryAttempt[] = [];
    let lastError: any;

    // Prevent duplicate retries for the same operation
    if (operationId && this.activeRetries.has(operationId)) {
      console.log(`🔄 Retry already in progress for ${operationId}, waiting...`);
      return this.activeRetries.get(operationId)!;
    }

    const retryPromise = this._executeRetryLoop(operation, finalConfig, attempts);
    
    if (operationId) {
      this.activeRetries.set(operationId, retryPromise);
    }

    try {
      const result = await retryPromise;
      
      // Clean up active retry tracking
      if (operationId) {
        this.activeRetries.delete(operationId);
        this.retryStats.set(operationId, attempts);
      }

      return {
        success: result.success,
        data: result.data,
        error: result.error,
        totalAttempts: attempts.length,
        totalDuration: Date.now() - startTime,
        attempts
      };
    } catch (error) {
      // Clean up on error
      if (operationId) {
        this.activeRetries.delete(operationId);
      }
      throw error;
    }
  }

  /**
   * Internal retry loop implementation
   */
  private async _executeRetryLoop<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    attempts: RetryAttempt[]
  ): Promise<{ success: boolean; data?: T; error?: any }> {
    let lastError: any;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      const attemptStartTime = Date.now();
      
      // Check circuit breaker before retry (except first attempt)
      if (attempt > 1 && config.respectCircuitBreaker) {
        const circuitState = supabaseCircuitBreaker.getState();
        if (circuitState.isOpen) {
          console.log(`🚫 Circuit breaker is open, stopping retries at attempt ${attempt}`);
          break;
        }
      }

      try {
        console.log(`🔄 Retry attempt ${attempt}/${config.maxAttempts}`);
        
        const result = await operation();
        
        console.log(`✅ Operation succeeded on attempt ${attempt}`);
        return { success: true, data: result };
        
      } catch (error) {
        lastError = error;
        const errorType = this.classifyError(error);
        
        const attemptRecord: RetryAttempt = {
          attemptNumber: attempt,
          delay: attempt === 1 ? 0 : this.calculateDelay(attempt - 1, config),
          timestamp: attemptStartTime,
          error,
          errorType
        };
        
        attempts.push(attemptRecord);
        
        console.log(`❌ Attempt ${attempt} failed:`, {
          errorType,
          message: error?.message || String(error)
        });

        // Don't retry non-retryable errors
        if (!this.isRetryableError(errorType)) {
          console.log(`🚫 Error type ${errorType} is not retryable, stopping retries`);
          break;
        }

        // Don't retry if this was the last attempt
        if (attempt >= config.maxAttempts) {
          console.log(`🚫 Max attempts (${config.maxAttempts}) reached`);
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, config);
        console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1}`);
        
        await this.sleep(delay);
      }
    }

    return { success: false, error: lastError };
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateDelay(attemptNumber: number, config: RetryConfig): number {
    // Exponential backoff: baseDelay * (backoffMultiplier ^ attemptNumber)
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attemptNumber);
    
    // Cap at maximum delay
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * config.maxJitter;
    
    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Classify error for retry decision
   */
  private classifyError(error: any): ErrorType {
    const message = error?.message || String(error);
    
    // Network errors - retryable
    if (message.includes('fetch') || 
        message.includes('network') || 
        message.includes('connection') ||
        message.includes('ECONNREFUSED') ||
        message.includes('ENOTFOUND')) {
      return ErrorType.NETWORK_ERROR;
    }
    
    // Timeout errors - retryable
    if (message.includes('timeout') || 
        message.includes('aborted') ||
        (error instanceof Error && error.name === 'AbortError')) {
      return ErrorType.TIMEOUT_ERROR;
    }
    
    // Permission errors - not retryable (need user action)
    if (message.includes('permission') || 
        message.includes('unauthorized') || 
        message.includes('forbidden') ||
        message.includes('access denied')) {
      return ErrorType.PERMISSION_ERROR;
    }
    
    // Policy errors - not retryable (need configuration fixes)
    if (message.includes('infinite recursion detected in policy') ||
        message.includes('infinite recursion') ||
        message.includes('Query timeout - possible infinite recursion')) {
      return ErrorType.POLICY_INFINITE_RECURSION;
    }
    
    if (message.includes('circular dependency') ||
        message.includes('policy dependency cycle')) {
      return ErrorType.POLICY_CIRCULAR_DEPENDENCY;
    }
    
    if (message.includes('policy evaluation failed') ||
        message.includes('RLS policy error')) {
      return ErrorType.POLICY_EVALUATION_ERROR;
    }
    
    // Schema errors - not retryable (need code fixes)
    if (message.includes('column') && 
        (message.includes('does not exist') || message.includes('not found'))) {
      return ErrorType.SCHEMA_MISMATCH;
    }
    
    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * Check if error type is retryable
   */
  private isRetryableError(errorType: ErrorType): boolean {
    const retryableErrors = [
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.UNKNOWN_ERROR
    ];
    
    return retryableErrors.includes(errorType);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry statistics for monitoring
   */
  getRetryStats(operationId?: string) {
    if (operationId) {
      return this.retryStats.get(operationId) || [];
    }
    
    // Return aggregated stats
    const allAttempts = Array.from(this.retryStats.values()).flat();
    const totalRetries = allAttempts.length;
    const successfulRetries = allAttempts.filter(attempt => 
      attempt.attemptNumber > 1
    ).length;
    
    const errorsByType = allAttempts.reduce((acc, attempt) => {
      acc[attempt.errorType] = (acc[attempt.errorType] || 0) + 1;
      return acc;
    }, {} as Record<ErrorType, number>);

    return {
      totalRetries,
      successfulRetries,
      activeRetries: this.activeRetries.size,
      errorsByType,
      averageAttempts: totalRetries > 0 ? 
        allAttempts.reduce((sum, attempt) => sum + attempt.attemptNumber, 0) / totalRetries : 0
    };
  }

  /**
   * Clear retry history for an operation
   */
  clearRetryHistory(operationId: string): void {
    this.retryStats.delete(operationId);
  }

  /**
   * Cancel active retry for an operation
   */
  cancelRetry(operationId: string): boolean {
    if (this.activeRetries.has(operationId)) {
      this.activeRetries.delete(operationId);
      return true;
    }
    return false;
  }

  /**
   * Get predefined retry configurations for different scenarios
   */
  static getRetryConfig(scenario: 'fast' | 'standard' | 'patient' | 'critical'): RetryConfig {
    switch (scenario) {
      case 'fast':
        return {
          maxAttempts: 2,
          baseDelay: 500,
          maxDelay: 5000,
          backoffMultiplier: 2,
          maxJitter: 500,
          respectCircuitBreaker: true
        };
      
      case 'standard':
        return {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 15000,
          backoffMultiplier: 2,
          maxJitter: 1000,
          respectCircuitBreaker: true
        };
      
      case 'patient':
        return {
          maxAttempts: 5,
          baseDelay: 2000,
          maxDelay: 30000,
          backoffMultiplier: 1.5,
          maxJitter: 2000,
          respectCircuitBreaker: true
        };
      
      case 'critical':
        return {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2,
          maxJitter: 500,
          respectCircuitBreaker: false // Critical operations ignore circuit breaker
        };
      
      default:
        return AutomaticRetryManager.getRetryConfig('standard');
    }
  }
}

// Export singleton instance
export const automaticRetryManager = AutomaticRetryManager.getInstance();

/**
 * Convenience function for executing operations with retry
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  scenario: 'fast' | 'standard' | 'patient' | 'critical' = 'standard',
  operationId?: string
): Promise<RetryResult<T>> {
  const config = AutomaticRetryManager.getRetryConfig(scenario);
  return automaticRetryManager.executeWithRetry(operation, config, operationId);
}

/**
 * Hook for React components to use automatic retry
 * Note: Import React in the component that uses this hook
 */
export function useAutomaticRetry<T>(
  operation: () => Promise<T>,
  dependencies: any[] = [],
  scenario: 'fast' | 'standard' | 'patient' | 'critical' = 'standard'
) {
  // This hook should be used in React components where React is already imported
  const React = (globalThis as any).React;
  if (!React) {
    throw new Error('useAutomaticRetry must be used in a React component');
  }

  const [result, setResult] = (React as any).useState(null);
  const [isLoading, setIsLoading] = (React as any).useState(false);

  const execute = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const retryResult = await executeWithRetry(operation, scenario);
      setResult(retryResult);
    } catch (error) {
      setResult({
        success: false,
        error,
        totalAttempts: 1,
        totalDuration: 0,
        attempts: []
      });
    } finally {
      setIsLoading(false);
    }
  }, dependencies);

  return {
    result,
    isLoading,
    execute,
    retry: execute
  };
}