/**
 * Policy Error Message Utilities
 * 
 * Provides user-friendly error messages for database policy-related failures
 * Requirements: 3.1, 3.2, 3.3
 */

import { ErrorType } from './circuitBreaker';

export interface PolicyErrorInfo {
  userMessage: string;
  technicalMessage: string;
  actionable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedActions: string[];
}

/**
 * Generate user-friendly error messages for policy-related errors
 */
export function getPolicyErrorMessage(errorType: ErrorType, originalMessage: string): PolicyErrorInfo {
  switch (errorType) {
    case ErrorType.POLICY_INFINITE_RECURSION:
      return {
        userMessage: "We're experiencing a technical issue with your registration. Our team has been notified and is working on a fix.",
        technicalMessage: `Database policy infinite recursion detected: ${originalMessage}`,
        actionable: false,
        severity: 'critical',
        suggestedActions: [
          'Please try again in a few minutes',
          'If the issue persists, contact support with error code: POLICY_RECURSION'
        ]
      };

    case ErrorType.POLICY_CIRCULAR_DEPENDENCY:
      return {
        userMessage: "There's a configuration issue preventing your registration from completing. Our technical team has been alerted.",
        technicalMessage: `Database policy circular dependency detected: ${originalMessage}`,
        actionable: false,
        severity: 'critical',
        suggestedActions: [
          'Please wait while we resolve this issue',
          'Contact support if you need immediate assistance with error code: POLICY_CIRCULAR'
        ]
      };

    case ErrorType.POLICY_EVALUATION_ERROR:
      return {
        userMessage: "We're having trouble processing your information due to a security policy issue. Please try again.",
        technicalMessage: `Database policy evaluation failed: ${originalMessage}`,
        actionable: true,
        severity: 'high',
        suggestedActions: [
          'Try refreshing the page and submitting again',
          'Ensure all required fields are filled correctly',
          'Contact support if the problem continues with error code: POLICY_EVAL'
        ]
      };

    case ErrorType.SCHEMA_MISMATCH:
      return {
        userMessage: "There's a data format issue preventing your registration. Our team is working on a fix.",
        technicalMessage: `Database schema mismatch: ${originalMessage}`,
        actionable: false,
        severity: 'high',
        suggestedActions: [
          'Please try again in a few minutes',
          'Contact support with error code: SCHEMA_MISMATCH if the issue persists'
        ]
      };

    case ErrorType.PERMISSION_ERROR:
      return {
        userMessage: "You don't have permission to perform this action. Please check your account status.",
        technicalMessage: `Permission denied: ${originalMessage}`,
        actionable: true,
        severity: 'medium',
        suggestedActions: [
          'Try logging out and logging back in',
          'Contact your administrator to verify your account permissions',
          'Ensure your session hasn\'t expired'
        ]
      };

    case ErrorType.NETWORK_ERROR:
      return {
        userMessage: "Connection issue detected. Please check your internet connection and try again.",
        technicalMessage: `Network error: ${originalMessage}`,
        actionable: true,
        severity: 'medium',
        suggestedActions: [
          'Check your internet connection',
          'Try refreshing the page',
          'Wait a moment and try again'
        ]
      };

    case ErrorType.TIMEOUT_ERROR:
      return {
        userMessage: "The request is taking longer than expected. Please try again.",
        technicalMessage: `Request timeout: ${originalMessage}`,
        actionable: true,
        severity: 'medium',
        suggestedActions: [
          'Try submitting your information again',
          'Check your internet connection',
          'Contact support if timeouts continue'
        ]
      };

    default:
      return {
        userMessage: "An unexpected error occurred. Please try again or contact support if the issue persists.",
        technicalMessage: `Unknown error: ${originalMessage}`,
        actionable: true,
        severity: 'medium',
        suggestedActions: [
          'Try refreshing the page and submitting again',
          'Contact support with the error details if the problem continues'
        ]
      };
  }
}

/**
 * Check if an error is policy-related
 */
export function isPolicyError(errorType: ErrorType): boolean {
  return [
    ErrorType.POLICY_INFINITE_RECURSION,
    ErrorType.POLICY_CIRCULAR_DEPENDENCY,
    ErrorType.POLICY_EVALUATION_ERROR
  ].includes(errorType);
}

/**
 * Get a short error code for logging and support purposes
 */
export function getErrorCode(errorType: ErrorType): string {
  const errorCodes: Record<ErrorType, string> = {
    [ErrorType.POLICY_INFINITE_RECURSION]: 'POL_RECURSION',
    [ErrorType.POLICY_CIRCULAR_DEPENDENCY]: 'POL_CIRCULAR',
    [ErrorType.POLICY_EVALUATION_ERROR]: 'POL_EVAL',
    [ErrorType.SCHEMA_MISMATCH]: 'SCHEMA_ERR',
    [ErrorType.PERMISSION_ERROR]: 'PERM_ERR',
    [ErrorType.NETWORK_ERROR]: 'NET_ERR',
    [ErrorType.TIMEOUT_ERROR]: 'TIMEOUT_ERR',
    [ErrorType.UNKNOWN_ERROR]: 'UNKNOWN_ERR'
  };

  return errorCodes[errorType] || 'UNKNOWN_ERR';
}

/**
 * Generate a detailed error report for logging
 */
export function generateErrorReport(errorType: ErrorType, originalMessage: string, context?: Record<string, unknown>): string {
  const errorInfo = getPolicyErrorMessage(errorType, originalMessage);
  const errorCode = getErrorCode(errorType);
  const timestamp = new Date().toISOString();

  return JSON.stringify({
    timestamp,
    errorCode,
    errorType,
    severity: errorInfo.severity,
    userMessage: errorInfo.userMessage,
    technicalMessage: errorInfo.technicalMessage,
    originalMessage,
    context: context || {},
    isPolicyError: isPolicyError(errorType)
  }, null, 2);
}