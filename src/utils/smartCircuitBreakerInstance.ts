/**
 * Smart Circuit Breaker Instance Configuration
 * 
 * Creates and configures the global smart circuit breaker instance
 * with optimized settings for query performance.
 */

import { SmartCircuitBreaker, SmartCircuitBreakerConfig } from './smartCircuitBreaker';
import { ErrorType } from './circuitBreaker';

/**
 * Smart Circuit Breaker Configuration
 * Optimized for database query performance with intelligent caching integration
 */
const smartCircuitBreakerConfig: SmartCircuitBreakerConfig = {
  // Base circuit breaker settings - Made less aggressive for better UX
  failureThreshold: 8, // Increased from 5 to 8 failures to prevent premature blocking
  resetTimeout: 15000, // Reduced from 30 to 15 seconds for faster recovery
  monitoringPeriod: 60000, // Monitor over 1 minute periods
  
  // Smart features
  progressiveTimeouts: true,
  adaptiveThresholds: true,
  cacheGracePeriod: 300000, // 5 minutes - serve cached data when circuit is open
  maxTimeoutMultiplier: 4, // Maximum 4x timeout increase
  performanceThreshold: 2000, // 2 second performance threshold
  
  // Error type weights for intelligent failure analysis - Adjusted for better auth handling
  errorTypeWeights: {
    [ErrorType.SCHEMA_MISMATCH]: 0, // Don't count schema errors toward circuit breaker
    [ErrorType.PERMISSION_ERROR]: 0, // Don't count permission errors toward circuit breaker (auth failures)
    [ErrorType.NETWORK_ERROR]: 0.5, // Reduced weight for network errors to prevent false positives
    [ErrorType.TIMEOUT_ERROR]: 1, // Reduced weight for timeout errors
    [ErrorType.POLICY_INFINITE_RECURSION]: 3, // Critical - immediately impact circuit breaker
    [ErrorType.POLICY_CIRCULAR_DEPENDENCY]: 3, // Critical - immediately impact circuit breaker
    [ErrorType.POLICY_EVALUATION_ERROR]: 0.5, // Reduced weight for policy errors
    [ErrorType.UNKNOWN_ERROR]: 0.2, // Much lower weight for unknown errors
  },
  
  // Progressive timeout configuration
  progressiveTimeoutConfig: {
    enabled: true,
    timeoutSteps: [1, 1.5, 2, 3, 4], // Multipliers for progressive timeout
    performanceThresholds: [2000, 5000, 10000, 20000], // Performance thresholds in ms
    maxConsecutiveFailures: 10, // Max failures before maximum timeout
    cooldownPeriod: 2 * 60 * 1000, // 2 minutes cooldown before reducing timeout
  },
  
  // System load monitoring configuration
  loadMonitoringConfig: {
    enabled: true,
    cpuThreshold: 70, // CPU usage threshold (estimated)
    memoryThreshold: 80, // Memory usage threshold (estimated)
    activeQueryThreshold: 20, // Active query count threshold
    monitoringInterval: 30 * 1000, // Monitor every 30 seconds
  },
};

/**
 * Global Smart Circuit Breaker Instance
 * 
 * This replaces the basic supabaseCircuitBreaker with intelligent features:
 * - Cache-aware operation (serves cached data when circuit is open)
 * - Progressive timeouts based on performance history
 * - Adaptive thresholds that adjust to system load
 * - Weighted error analysis (schema errors don't trigger circuit breaker)
 * - System load monitoring and adjustment
 * 
 * Benefits over basic circuit breaker:
 * - Graceful degradation with cached data instead of complete blocking
 * - Faster recovery under good conditions, longer timeouts under poor conditions
 * - Intelligent error handling prevents unnecessary circuit trips
 * - Performance-based adjustments improve user experience
 */
export const smartSupabaseCircuitBreaker = new SmartCircuitBreaker(smartCircuitBreakerConfig);

// Export configuration for testing and monitoring
export { smartCircuitBreakerConfig };

// Development logging
if (import.meta.env.DEV) {
  console.log('🧠 Smart Circuit Breaker initialized with configuration:', {
    failureThreshold: smartCircuitBreakerConfig.failureThreshold,
    resetTimeout: smartCircuitBreakerConfig.resetTimeout,
    progressiveTimeouts: smartCircuitBreakerConfig.progressiveTimeouts,
    adaptiveThresholds: smartCircuitBreakerConfig.adaptiveThresholds,
    cacheGracePeriod: `${smartCircuitBreakerConfig.cacheGracePeriod / 1000}s`,
    loadMonitoring: smartCircuitBreakerConfig.loadMonitoringConfig.enabled,
  });
}