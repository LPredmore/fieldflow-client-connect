/**
 * Retry with Exponential Backoff
 * 
 * Utility for retrying failed operations with exponential backoff.
 * 
 * Requirements: 7.3, 7.4
 */

import { AuthError, AuthErrorType } from './AuthError';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 4000, // 4 seconds
  shouldRetry: (error: Error) => {
    if (error instanceof AuthError) {
      return error.shouldRetry();
    }
    // Retry on network errors by default
    return error.message.toLowerCase().includes('network') ||
           error.message.toLowerCase().includes('fetch');
  }
};

/**
 * Retry an async operation with exponential backoff
 * 
 * @param operation - Async function to retry
 * @param options - Retry options
 * @returns Result of the operation
 * @throws Last error if all retries fail
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      if (import.meta.env.DEV) {
        console.debug('[retryWithBackoff] Attempt', { attempt, maxAttempts: config.maxAttempts });
      }
      
      const result = await operation();
      
      if (import.meta.env.DEV && attempt > 1) {
        console.debug('[retryWithBackoff] Operation succeeded after retry', { attempt });
      }
      
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (import.meta.env.DEV) {
        console.debug('[retryWithBackoff] Attempt failed', {
          attempt,
          error: lastError.message,
          willRetry: attempt < config.maxAttempts && config.shouldRetry(lastError)
        });
      }

      // Check if we should retry
      if (attempt >= config.maxAttempts || !config.shouldRetry(lastError)) {
        if (import.meta.env.DEV) {
          console.debug('[retryWithBackoff] Not retrying', {
            reason: attempt >= config.maxAttempts ? 'max attempts reached' : 'error not retryable'
          });
        }
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.initialDelay * Math.pow(2, attempt - 1),
        config.maxDelay
      );

      if (import.meta.env.DEV) {
        console.debug('[retryWithBackoff] Waiting before retry', { delay, attempt });
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!;
}

/**
 * Wrap an async function with retry logic
 * 
 * @param fn - Function to wrap
 * @param options - Retry options
 * @returns Wrapped function with retry logic
 */
export function withRetry<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    return retryWithBackoff(() => fn(...args), options);
  };
}
