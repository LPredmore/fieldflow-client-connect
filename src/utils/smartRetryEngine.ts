/**
 * Smart Retry Engine
 * 
 * Implements intelligent retry logic with exponential backoff, jitter,
 * circuit breaker pattern, and error-specific retry strategies.
 */

import { ErrorClassifier, ClassifiedError, RetryStrategy } from './errorClassifier';

export interface RetryContext {
  attempt: number;
  lastError: Error | null;
  totalDuration: number;
  cacheAvailable: boolean;
  startTime: number;
}

export interface RetryOptions {
  strategy?: Partial<RetryStrategy>;
  onRetry?: (context: RetryContext) => void;
  onSuccess?: (result: any, context: RetryContext) => void;
  onFailure?: (error: Error, context: RetryContext) => void;
  shouldRetry?: (error: Error, context: RetryContext) => boolean;
  cacheAvailable?: boolean;
  operationName?: string;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  successCount: number;
}

/**
 * Smart Retry Engine
 * 
 * Executes operations with intelligent retry logic and circuit breaker protection
 */
export class SmartRetryEngine {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // Open after 5 failures
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  private readonly CIRCUIT_BREAKER_SUCCESS_THRESHOLD = 2; // Close after 2 successes

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const operationName = options.operationName || 'unknown';
    
    // Check circuit breaker
    if (this.isCircuitOpen(operationName)) {
      const error = new Error(`Circuit breaker is OPEN for ${operationName}`);
      console.warn(`🔴 [SmartRetryEngine] Circuit breaker OPEN, rejecting request for ${operationName}`);
      throw error;
    }

    const context: RetryContext = {
      attempt: 0,
      lastError: null,
      totalDuration: 0,
      cacheAvailable: options.cacheAvailable || false,
      startTime: Date.now()
    };

    let lastClassifiedError: ClassifiedError | null = null;

    while (true) {
      context.attempt++;
      const attemptStartTime = Date.now();

      try {
        console.log(`🔄 [SmartRetryEngine] Attempt ${context.attempt} for ${operationName}`);
        
        const result = await operation();
        
        const attemptDuration = Date.now() - attemptStartTime;
        context.totalDuration = Date.now() - context.startTime;

        console.log(`✅ [SmartRetryEngine] Success on attempt ${context.attempt} for ${operationName} (${attemptDuration}ms)`);
        
        // Record success for circuit breaker
        this.recordSuccess(operationName);
        
        // Call success callback
        if (options.onSuccess) {
          options.onSuccess(result, context);
        }

        return result;
      } catch (error) {
        const attemptDuration = Date.now() - attemptStartTime;
        context.totalDuration = Date.now() - context.startTime;
        context.lastError = error instanceof Error ? error : new Error(String(error));

        // Classify the error
        lastClassifiedError = ErrorClassifier.classify(error);

        console.warn(`⚠️ [SmartRetryEngine] Attempt ${context.attempt} failed for ${operationName}`, {
          error: lastClassifiedError.technicalDetails,
          category: lastClassifiedError.category,
          isRetryable: lastClassifiedError.isRetryable,
          duration: attemptDuration
        });

        // Record failure for circuit breaker
        this.recordFailure(operationName);

        // Determine if we should retry
        const shouldRetry = this.shouldRetryOperation(
          lastClassifiedError,
          context,
          options
        );

        if (!shouldRetry) {
          console.error(`❌ [SmartRetryEngine] Not retrying ${operationName}`, {
            reason: lastClassifiedError.isRetryable ? 'Max retries reached' : 'Non-retryable error',
            attempts: context.attempt,
            totalDuration: context.totalDuration
          });

          // Call failure callback
          if (options.onFailure) {
            options.onFailure(context.lastError, context);
          }

          throw context.lastError;
        }

        // Calculate backoff delay
        const strategy = options.strategy 
          ? { ...ErrorClassifier.getRetryStrategy(lastClassifiedError), ...options.strategy }
          : ErrorClassifier.getRetryStrategy(lastClassifiedError);

        const delay = this.calculateBackoff(context.attempt, strategy);

        console.log(`⏳ [SmartRetryEngine] Retrying ${operationName} in ${delay}ms (attempt ${context.attempt + 1}/${strategy.maxAttempts})`);

        // Call retry callback
        if (options.onRetry) {
          options.onRetry(context);
        }

        // Wait before retrying
        await this.sleep(delay);
      }
    }
  }

  /**
   * Determine if operation should be retried
   */
  private shouldRetryOperation(
    classifiedError: ClassifiedError,
    context: RetryContext,
    options: RetryOptions
  ): boolean {
    // Use custom retry logic if provided
    if (options.shouldRetry) {
      return options.shouldRetry(context.lastError!, context);
    }

    // Don't retry if error is not retryable
    if (!classifiedError.isRetryable) {
      return false;
    }

    // Don't retry if max attempts reached
    const strategy = options.strategy 
      ? { ...ErrorClassifier.getRetryStrategy(classifiedError), ...options.strategy }
      : ErrorClassifier.getRetryStrategy(classifiedError);

    if (context.attempt >= strategy.maxAttempts) {
      return false;
    }

    return true;
  }

  /**
   * Calculate backoff delay with exponential backoff and jitter
   */
  calculateBackoff(attempt: number, strategy: RetryStrategy): number {
    // Calculate exponential backoff
    const exponentialDelay = strategy.baseDelay * Math.pow(strategy.backoffMultiplier, attempt - 1);
    
    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, strategy.maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * strategy.jitterFactor * (Math.random() - 0.5) * 2;
    const finalDelay = Math.max(0, cappedDelay + jitter);
    
    return Math.round(finalDelay);
  }

  /**
   * Check if circuit breaker is open for operation
   */
  private isCircuitOpen(operationName: string): boolean {
    const state = this.circuitBreakers.get(operationName);
    
    if (!state) {
      return false;
    }

    if (state.state === 'CLOSED') {
      return false;
    }

    if (state.state === 'OPEN') {
      // Check if timeout has passed
      const timeSinceLastFailure = Date.now() - state.lastFailureTime;
      
      if (timeSinceLastFailure >= this.CIRCUIT_BREAKER_TIMEOUT) {
        // Move to HALF_OPEN state
        state.state = 'HALF_OPEN';
        state.successCount = 0;
        console.log(`🟡 [SmartRetryEngine] Circuit breaker HALF_OPEN for ${operationName}`);
        return false;
      }
      
      return true;
    }

    // HALF_OPEN state - allow request through
    return false;
  }

  /**
   * Record successful operation
   */
  private recordSuccess(operationName: string): void {
    const state = this.circuitBreakers.get(operationName);
    
    if (!state) {
      // Initialize circuit breaker state
      this.circuitBreakers.set(operationName, {
        failures: 0,
        lastFailureTime: 0,
        state: 'CLOSED',
        successCount: 0
      });
      return;
    }

    if (state.state === 'HALF_OPEN') {
      state.successCount++;
      
      if (state.successCount >= this.CIRCUIT_BREAKER_SUCCESS_THRESHOLD) {
        // Close the circuit
        state.state = 'CLOSED';
        state.failures = 0;
        state.successCount = 0;
        console.log(`🟢 [SmartRetryEngine] Circuit breaker CLOSED for ${operationName}`);
      }
    } else if (state.state === 'CLOSED') {
      // Reset failure count on success
      state.failures = Math.max(0, state.failures - 1);
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(operationName: string): void {
    const state = this.circuitBreakers.get(operationName);
    
    if (!state) {
      // Initialize circuit breaker state
      this.circuitBreakers.set(operationName, {
        failures: 1,
        lastFailureTime: Date.now(),
        state: 'CLOSED',
        successCount: 0
      });
      return;
    }

    state.failures++;
    state.lastFailureTime = Date.now();

    if (state.state === 'HALF_OPEN') {
      // Failure in HALF_OPEN state - reopen circuit
      state.state = 'OPEN';
      state.successCount = 0;
      console.warn(`🔴 [SmartRetryEngine] Circuit breaker reopened for ${operationName}`);
    } else if (state.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      // Too many failures - open circuit
      state.state = 'OPEN';
      console.warn(`🔴 [SmartRetryEngine] Circuit breaker OPEN for ${operationName} (${state.failures} failures)`);
    }
  }

  /**
   * Get circuit breaker state for operation
   */
  getCircuitBreakerState(operationName: string): CircuitBreakerState | null {
    return this.circuitBreakers.get(operationName) || null;
  }

  /**
   * Reset circuit breaker for operation
   */
  resetCircuitBreaker(operationName: string): void {
    this.circuitBreakers.delete(operationName);
    console.log(`🔄 [SmartRetryEngine] Circuit breaker reset for ${operationName}`);
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    this.circuitBreakers.clear();
    console.log(`🔄 [SmartRetryEngine] All circuit breakers reset`);
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute operation with timeout
   */
  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    timeoutError?: Error
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => 
        setTimeout(
          () => reject(timeoutError || new Error(`Operation timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      )
    ]);
  }

  /**
   * Execute multiple operations with retry, returning results as they complete
   */
  async executeAllWithRetry<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions = {}
  ): Promise<Array<T | Error>> {
    const promises = operations.map(op => 
      this.executeWithRetry(op, options)
        .catch(error => error as Error)
    );

    return Promise.all(promises);
  }

  /**
   * Execute multiple operations with retry, returning first successful result
   */
  async executeRaceWithRetry<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions = {}
  ): Promise<T> {
    const promises = operations.map(op => 
      this.executeWithRetry(op, options)
    );

    return Promise.race(promises);
  }
}

// Export singleton instance
export const smartRetryEngine = new SmartRetryEngine();
