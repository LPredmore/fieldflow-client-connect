/**
 * Policy Fallback Strategies
 * 
 * Provides fallback mechanisms when database policies fail
 * Requirements: 3.1, 3.2
 */

import { ErrorType, CircuitBreaker, supabaseCircuitBreaker } from './circuitBreaker';
import { smartSupabaseCircuitBreaker } from './smartCircuitBreakerInstance';

export interface FallbackResult<T> {
  success: boolean;
  data?: T;
  fallbackUsed: boolean;
  fallbackType?: string;
  error?: string;
}

export interface PolicyFallbackOptions {
  enableCaching: boolean;
  enableRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  fallbackToReadOnly: boolean;
}

const DEFAULT_FALLBACK_OPTIONS: PolicyFallbackOptions = {
  enableCaching: true,
  enableRetry: true,
  maxRetries: 2,
  retryDelay: 1000,
  fallbackToReadOnly: false
};

/**
 * Execute a database operation with policy fallback strategies
 */
export async function executeWithPolicyFallback<T>(
  operation: () => Promise<T>,
  fallbackOptions: Partial<PolicyFallbackOptions> = {}
): Promise<FallbackResult<T>> {
  const options = { ...DEFAULT_FALLBACK_OPTIONS, ...fallbackOptions };
  let lastError: unknown;
  let retryCount = 0;

  // Check if smart circuit breaker suggests using fallback immediately
  const circuitState = smartSupabaseCircuitBreaker.getEnhancedState();
  if (circuitState.state === 'OPEN' || supabaseCircuitBreaker.shouldUsePolicyFallback()) {
    console.warn('🔄 Policy fallback: Smart circuit breaker suggests immediate fallback due to policy errors');
    return await tryFallbackStrategies<T>(options, new Error('Smart circuit breaker policy fallback'));
  }

  // Try the main operation with retries
  while (retryCount <= options.maxRetries) {
    try {
      const result = await operation();
      return {
        success: true,
        data: result,
        fallbackUsed: false
      };
    } catch (error: unknown) {
      lastError = error;
      const errorInfo = CircuitBreaker.classifyError(error);
      
      // For policy errors, don't retry - go straight to fallback
      if (isPolicyError(errorInfo.type)) {
        console.warn(`🚨 Policy error detected (${errorInfo.type}), attempting fallback strategies`);
        return await tryFallbackStrategies<T>(options, error);
      }

      // For other retryable errors, try again
      if (errorInfo.retryable && retryCount < options.maxRetries) {
        retryCount++;
        console.warn(`🔄 Retrying operation (attempt ${retryCount}/${options.maxRetries}) after error:`, CircuitBreaker.extractErrorMessage(error));
        await delay(options.retryDelay * retryCount); // Exponential backoff
        continue;
      }

      // If not retryable or max retries reached, try fallback
      break;
    }
  }

  // All retries failed, try fallback strategies
  return await tryFallbackStrategies<T>(options, lastError);
}

/**
 * Try various fallback strategies when the main operation fails
 */
async function tryFallbackStrategies<T>(
  options: PolicyFallbackOptions,
  originalError: unknown
): Promise<FallbackResult<T>> {
  
  // Strategy 1: Try cached data if available
  if (options.enableCaching) {
    const cachedResult = await tryCache<T>();
    if (cachedResult.success) {
      return {
        ...cachedResult,
        fallbackUsed: true,
        fallbackType: 'cache'
      };
    }
  }

  // Strategy 2: Try read-only fallback (for write operations)
  if (options.fallbackToReadOnly) {
    const readOnlyResult = await tryReadOnlyFallback<T>();
    if (readOnlyResult.success) {
      return {
        ...readOnlyResult,
        fallbackUsed: true,
        fallbackType: 'read_only'
      };
    }
  }

  // Strategy 3: Return graceful failure with user guidance
  return {
    success: false,
    fallbackUsed: true,
    fallbackType: 'graceful_failure',
    error: CircuitBreaker.extractErrorMessage(originalError)
  };
}

/**
 * Try to get data from cache
 */
async function tryCache<T>(): Promise<FallbackResult<T>> {
  try {
    // This would integrate with your existing caching system
    // For now, return failure to indicate cache miss
    return {
      success: false,
      fallbackUsed: false
    };
  } catch (error) {
    return {
      success: false,
      fallbackUsed: false,
      error: 'Cache access failed'
    };
  }
}

/**
 * Try read-only fallback for write operations
 */
async function tryReadOnlyFallback<T>(): Promise<FallbackResult<T>> {
  try {
    // This would implement read-only alternatives for write operations
    // For example, for staff registration, this might return existing data
    // without attempting to update it
    return {
      success: false,
      fallbackUsed: false
    };
  } catch (error) {
    return {
      success: false,
      fallbackUsed: false,
      error: 'Read-only fallback failed'
    };
  }
}

/**
 * Check if an error type is policy-related
 */
function isPolicyError(errorType: ErrorType): boolean {
  return [
    ErrorType.POLICY_INFINITE_RECURSION,
    ErrorType.POLICY_CIRCULAR_DEPENDENCY,
    ErrorType.POLICY_EVALUATION_ERROR
  ].includes(errorType);
}

/**
 * Delay utility for retry backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a fallback-aware database operation wrapper
 */
export function createPolicyAwareOperation<T>(
  operation: () => Promise<T>,
  fallbackOptions?: Partial<PolicyFallbackOptions>
) {
  return () => executeWithPolicyFallback(operation, fallbackOptions);
}

/**
 * Specific fallback for staff registration operations
 */
export async function executeStaffRegistrationWithFallback<T>(
  operation: () => Promise<T>
): Promise<FallbackResult<T>> {
  return executeWithPolicyFallback(operation, {
    enableCaching: false, // Don't cache registration attempts
    enableRetry: false,   // Don't retry policy errors for registration
    maxRetries: 0,
    fallbackToReadOnly: false // Registration is inherently a write operation
  });
}

/**
 * Get fallback guidance for users based on error type
 */
export function getFallbackGuidance(errorType: ErrorType): {
  canRetry: boolean;
  userAction: string;
  technicalAction: string;
} {
  switch (errorType) {
    case ErrorType.POLICY_INFINITE_RECURSION:
      return {
        canRetry: false,
        userAction: 'Please wait a few minutes before trying again. Our technical team has been notified.',
        technicalAction: 'Check database policies for circular references. Review RLS policy dependencies.'
      };

    case ErrorType.POLICY_CIRCULAR_DEPENDENCY:
      return {
        canRetry: false,
        userAction: 'This is a system configuration issue. Please contact support.',
        technicalAction: 'Audit and restructure RLS policies to eliminate circular dependencies.'
      };

    case ErrorType.POLICY_EVALUATION_ERROR:
      return {
        canRetry: true,
        userAction: 'Please try again. If the problem persists, contact support.',
        technicalAction: 'Review policy logic and ensure proper indexing for policy conditions.'
      };

    default:
      return {
        canRetry: true,
        userAction: 'Please try again or contact support if the issue continues.',
        technicalAction: 'Review error logs and check system health.'
      };
  }
}