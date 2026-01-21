/**
 * Error types for UI state management
 * Extracted from circuitBreaker.ts to allow UI components to reference
 * error types without importing the full circuit breaker implementation.
 */

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
