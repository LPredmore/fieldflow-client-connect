/**
 * Retry Engine - Production Implementation
 * Implements exponential backoff with jitter and circuit breaker pattern
 */

export interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponentialBackoff?: boolean;
  jitter?: boolean;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDelay: number;
}

export const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  exponentialBackoff: true,
  jitter: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 30000,
};

type CircuitState = 'closed' | 'open' | 'half-open';

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly timeout: number;

  constructor(threshold: number, timeout: number) {
    this.threshold = threshold;
    this.timeout = timeout;
  }

  canExecute(): boolean {
    if (this.state === 'closed') return true;
    
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure >= this.timeout) {
        this.state = 'half-open';
        this.successCount = 0;
        return true;
      }
      return false;
    }
    
    // half-open state
    return true;
  }

  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= 2) {
        this.state = 'closed';
        this.failureCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'open';
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
  }
}

class RetryEngine {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private stats = {
    totalRetries: 0,
    successfulRetries: 0,
    failedRetries: 0,
  };

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(
    attempt: number,
    config: RetryConfig
  ): number {
    const { baseDelay = 1000, maxDelay = 10000, exponentialBackoff, jitter } = config;
    
    let delay = exponentialBackoff 
      ? Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
      : baseDelay;
    
    if (jitter) {
      // Add random jitter (±25%)
      const jitterAmount = delay * 0.25;
      delay = delay + (Math.random() * 2 - 1) * jitterAmount;
    }
    
    return Math.max(delay, 0);
  }

  /**
   * Get or create circuit breaker for an operation
   */
  private getCircuitBreaker(operationKey: string, config: RetryConfig): CircuitBreaker {
    if (!this.circuitBreakers.has(operationKey)) {
      this.circuitBreakers.set(
        operationKey,
        new CircuitBreaker(
          config.circuitBreakerThreshold || 5,
          config.circuitBreakerTimeout || 30000
        )
      );
    }
    return this.circuitBreakers.get(operationKey)!;
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors
    if (error.message?.includes('Failed to fetch')) return true;
    if (error.message?.includes('Network request failed')) return true;
    if (error.message?.includes('timeout')) return true;
    
    // HTTP status codes that are retryable
    if (error.status) {
      const retryableStatuses = [408, 429, 500, 502, 503, 504];
      return retryableStatuses.includes(error.status);
    }
    
    // Supabase specific errors
    if (error.code === 'PGRST301') return true; // Connection error
    if (error.code === '57P03') return true; // Cannot connect now
    
    return false;
  }

  /**
   * Execute a function with retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig = defaultRetryConfig,
    operationKey: string = 'default'
  ): Promise<RetryResult<T>> {
    const maxRetries = config.maxRetries ?? 3;
    let attempts = 0;
    let totalDelay = 0;
    let lastError: Error | undefined;

    const circuitBreaker = this.getCircuitBreaker(operationKey, config);

    while (attempts <= maxRetries) {
      // Check circuit breaker
      if (!circuitBreaker.canExecute()) {
        return {
          success: false,
          error: new Error('Circuit breaker open - operation blocked'),
          attempts,
          totalDelay,
        };
      }

      try {
        const result = await fn();
        circuitBreaker.recordSuccess();
        
        if (attempts > 0) {
          this.stats.successfulRetries++;
        }
        
        return {
          success: true,
          data: result,
          attempts,
          totalDelay,
        };
      } catch (error: any) {
        lastError = error;
        circuitBreaker.recordFailure();
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          this.stats.failedRetries++;
          return {
            success: false,
            error: lastError,
            attempts,
            totalDelay,
          };
        }

        // Check if we should retry
        if (attempts >= maxRetries) {
          this.stats.failedRetries++;
          break;
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempts, config);
        totalDelay += delay;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        attempts++;
        this.stats.totalRetries++;
      }
    }

    return {
      success: false,
      error: lastError,
      attempts,
      totalDelay,
    };
  }

  /**
   * Get retry statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
    };
  }

  /**
   * Reset circuit breaker for an operation
   */
  resetCircuitBreaker(operationKey: string) {
    this.circuitBreakers.get(operationKey)?.reset();
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(operationKey: string): CircuitState | null {
    return this.circuitBreakers.get(operationKey)?.getState() || null;
  }
}

// Export singleton instance
export const retryEngine = new RetryEngine();
