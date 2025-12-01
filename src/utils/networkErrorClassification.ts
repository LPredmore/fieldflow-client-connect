/**
 * Network Error Classification System
 * 
 * Provides comprehensive error type detection and classification for network operations.
 * Integrates with existing CircuitBreaker error classification while extending it for network-specific scenarios.
 */

import { ErrorType, CircuitBreaker } from './circuitBreaker';

export interface NetworkErrorDetails {
  originalError: unknown;
  classifiedType: ErrorType;
  networkErrorType: NetworkErrorType;
  retryable: boolean;
  severity: ErrorSeverity;
  suggestedAction: string;
  userMessage: string;
  technicalDetails: TechnicalErrorDetails;
}

export enum NetworkErrorType {
  HTTP2_PROTOCOL = 'http2_protocol',
  CONNECTION_RESET = 'connection_reset', 
  CONNECTION_TIMEOUT = 'connection_timeout',
  DNS_RESOLUTION = 'dns_resolution',
  SSL_HANDSHAKE = 'ssl_handshake',
  REQUEST_TIMEOUT = 'request_timeout',
  RATE_LIMITED = 'rate_limited',
  SERVER_ERROR = 'server_error',
  CLIENT_ERROR = 'client_error',
  NETWORK_UNAVAILABLE = 'network_unavailable',
  CORS_ERROR = 'cors_error',
  UNKNOWN_NETWORK = 'unknown_network'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface TechnicalErrorDetails {
  errorCode?: string;
  httpStatus?: number;
  errorName?: string;
  stackTrace?: string;
  timestamp: number;
  userAgent: string;
  url?: string;
  method?: string;
  connectionInfo?: {
    online: boolean;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
}

/**
 * Network Error Classification Engine
 */
export class NetworkErrorClassifier {
  
  /**
   * Classify a network error with comprehensive analysis
   */
  static classifyError(error: unknown, context?: { url?: string; method?: string }): NetworkErrorDetails {
    const message = CircuitBreaker.extractErrorMessage(error);
    const timestamp = Date.now();
    
    // Get base classification from existing circuit breaker
    const baseClassification = CircuitBreaker.classifyError(error);
    
    // Perform detailed network-specific classification
    const networkClassification = this.classifyNetworkSpecificError(error, message);
    
    // Determine severity based on error type and impact
    const severity = this.determineSeverity(networkClassification.type, baseClassification.type);
    
    // Generate user-friendly messages and suggested actions
    const userMessage = this.generateUserMessage(networkClassification.type, severity);
    const suggestedAction = this.generateSuggestedAction(networkClassification.type, severity);
    
    // Collect technical details
    const technicalDetails = this.collectTechnicalDetails(error, context, timestamp);
    
    return {
      originalError: error,
      classifiedType: baseClassification.type,
      networkErrorType: networkClassification.type,
      retryable: networkClassification.retryable,
      severity,
      suggestedAction,
      userMessage,
      technicalDetails
    };
  }

  /**
   * Perform network-specific error classification
   */
  private static classifyNetworkSpecificError(error: unknown, message: string): {
    type: NetworkErrorType;
    retryable: boolean;
  } {
    // HTTP2 Protocol errors
    if (message.includes('ERR_HTTP2_PROTOCOL_ERROR') || 
        message.includes('HTTP/2') ||
        message.includes('protocol error')) {
      return { type: NetworkErrorType.HTTP2_PROTOCOL, retryable: true };
    }

    // Connection reset errors
    if (message.includes('ERR_CONNECTION_RESET') || 
        message.includes('connection reset') ||
        message.includes('ECONNRESET')) {
      return { type: NetworkErrorType.CONNECTION_RESET, retryable: true };
    }

    // DNS resolution errors
    if (message.includes('ENOTFOUND') || 
        message.includes('DNS') ||
        message.includes('getaddrinfo')) {
      return { type: NetworkErrorType.DNS_RESOLUTION, retryable: true };
    }

    // Connection timeout errors
    if (message.includes('ECONNREFUSED') || 
        message.includes('connection refused') ||
        message.includes('connect timeout')) {
      return { type: NetworkErrorType.CONNECTION_TIMEOUT, retryable: true };
    }

    // SSL/TLS handshake errors
    if (message.includes('SSL') || 
        message.includes('TLS') ||
        message.includes('certificate') ||
        message.includes('handshake')) {
      return { type: NetworkErrorType.SSL_HANDSHAKE, retryable: false };
    }

    // Request timeout errors
    if (message.includes('timeout') || 
        message.includes('aborted') ||
        (error instanceof Error && error.name === 'AbortError')) {
      return { type: NetworkErrorType.REQUEST_TIMEOUT, retryable: true };
    }

    // Rate limiting errors
    if (message.includes('rate limit') || 
        message.includes('too many requests') ||
        message.includes('429')) {
      return { type: NetworkErrorType.RATE_LIMITED, retryable: true };
    }

    // Server errors (5xx)
    if (message.includes('500') || 
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504') ||
        message.includes('server error')) {
      return { type: NetworkErrorType.SERVER_ERROR, retryable: true };
    }

    // Client errors (4xx) - mostly non-retryable
    if (message.includes('400') || 
        message.includes('401') ||
        message.includes('403') ||
        message.includes('404') ||
        message.includes('client error')) {
      return { type: NetworkErrorType.CLIENT_ERROR, retryable: false };
    }

    // CORS errors
    if (message.includes('CORS') || 
        message.includes('cross-origin') ||
        message.includes('Access-Control')) {
      return { type: NetworkErrorType.CORS_ERROR, retryable: false };
    }

    // Network unavailable
    if (message.includes('network') || 
        message.includes('offline') ||
        !navigator.onLine) {
      return { type: NetworkErrorType.NETWORK_UNAVAILABLE, retryable: true };
    }

    // Default to unknown network error
    return { type: NetworkErrorType.UNKNOWN_NETWORK, retryable: true };
  }

  /**
   * Determine error severity based on type and impact
   */
  private static determineSeverity(networkType: NetworkErrorType, circuitBreakerType: ErrorType): ErrorSeverity {
    // Critical errors that require immediate attention
    if (networkType === NetworkErrorType.SSL_HANDSHAKE ||
        networkType === NetworkErrorType.CORS_ERROR ||
        circuitBreakerType === ErrorType.POLICY_INFINITE_RECURSION ||
        circuitBreakerType === ErrorType.POLICY_CIRCULAR_DEPENDENCY) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors that significantly impact functionality
    if (networkType === NetworkErrorType.HTTP2_PROTOCOL ||
        networkType === NetworkErrorType.DNS_RESOLUTION ||
        networkType === NetworkErrorType.SERVER_ERROR ||
        circuitBreakerType === ErrorType.SCHEMA_MISMATCH ||
        circuitBreakerType === ErrorType.PERMISSION_ERROR) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity errors that may impact user experience
    if (networkType === NetworkErrorType.CONNECTION_RESET ||
        networkType === NetworkErrorType.CONNECTION_TIMEOUT ||
        networkType === NetworkErrorType.REQUEST_TIMEOUT ||
        networkType === NetworkErrorType.RATE_LIMITED ||
        circuitBreakerType === ErrorType.NETWORK_ERROR ||
        circuitBreakerType === ErrorType.TIMEOUT_ERROR) {
      return ErrorSeverity.MEDIUM;
    }

    // Low severity for other errors
    return ErrorSeverity.LOW;
  }

  /**
   * Generate user-friendly error messages
   */
  private static generateUserMessage(networkType: NetworkErrorType, severity: ErrorSeverity): string {
    const baseMessages = {
      [NetworkErrorType.HTTP2_PROTOCOL]: 'Connection protocol issue detected',
      [NetworkErrorType.CONNECTION_RESET]: 'Connection was interrupted',
      [NetworkErrorType.CONNECTION_TIMEOUT]: 'Connection timed out',
      [NetworkErrorType.DNS_RESOLUTION]: 'Unable to resolve server address',
      [NetworkErrorType.SSL_HANDSHAKE]: 'Secure connection failed',
      [NetworkErrorType.REQUEST_TIMEOUT]: 'Request took too long to complete',
      [NetworkErrorType.RATE_LIMITED]: 'Too many requests - please wait',
      [NetworkErrorType.SERVER_ERROR]: 'Server is experiencing issues',
      [NetworkErrorType.CLIENT_ERROR]: 'Request could not be processed',
      [NetworkErrorType.NETWORK_UNAVAILABLE]: 'Network connection unavailable',
      [NetworkErrorType.CORS_ERROR]: 'Cross-origin request blocked',
      [NetworkErrorType.UNKNOWN_NETWORK]: 'Network error occurred'
    };

    const baseMessage = baseMessages[networkType];

    // Add severity context
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return `${baseMessage}. Immediate attention required.`;
      case ErrorSeverity.HIGH:
        return `${baseMessage}. This may affect application functionality.`;
      case ErrorSeverity.MEDIUM:
        return `${baseMessage}. Please try again.`;
      case ErrorSeverity.LOW:
        return `${baseMessage}. This should resolve automatically.`;
      default:
        return baseMessage;
    }
  }

  /**
   * Generate suggested actions for users
   */
  private static generateSuggestedAction(networkType: NetworkErrorType, severity: ErrorSeverity): string {
    const actionMap = {
      [NetworkErrorType.HTTP2_PROTOCOL]: 'Try refreshing the page or switching to a different network',
      [NetworkErrorType.CONNECTION_RESET]: 'Check your internet connection and try again',
      [NetworkErrorType.CONNECTION_TIMEOUT]: 'Verify your internet connection and retry',
      [NetworkErrorType.DNS_RESOLUTION]: 'Check your internet connection or try again later',
      [NetworkErrorType.SSL_HANDSHAKE]: 'Contact support - there may be a security configuration issue',
      [NetworkErrorType.REQUEST_TIMEOUT]: 'Try again - the server may be busy',
      [NetworkErrorType.RATE_LIMITED]: 'Wait a few moments before trying again',
      [NetworkErrorType.SERVER_ERROR]: 'Try again in a few minutes - the server is experiencing issues',
      [NetworkErrorType.CLIENT_ERROR]: 'Check your input and try again, or contact support',
      [NetworkErrorType.NETWORK_UNAVAILABLE]: 'Check your internet connection',
      [NetworkErrorType.CORS_ERROR]: 'Contact support - there is a configuration issue',
      [NetworkErrorType.UNKNOWN_NETWORK]: 'Try refreshing the page or check your connection'
    };

    return actionMap[networkType];
  }

  /**
   * Collect technical details for debugging
   */
  private static collectTechnicalDetails(
    error: unknown, 
    context?: { url?: string; method?: string },
    timestamp: number = Date.now()
  ): TechnicalErrorDetails {
    const details: TechnicalErrorDetails = {
      timestamp,
      userAgent: navigator.userAgent,
      connectionInfo: {
        online: navigator.onLine
      }
    };

    // Extract error details
    if (error instanceof Error) {
      details.errorName = error.name;
      details.stackTrace = error.stack;
      
      // Try to extract HTTP status if available
      if ('status' in error) {
        details.httpStatus = error.status as number;
      }
      
      // Try to extract error code if available
      if ('code' in error) {
        details.errorCode = error.code as string;
      }
    }

    // Add context information
    if (context) {
      details.url = context.url;
      details.method = context.method;
    }

    // Add connection information if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        details.connectionInfo = {
          ...details.connectionInfo,
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt
        };
      }
    }

    return details;
  }

  /**
   * Check if an error should trigger circuit breaker
   */
  static shouldTriggerCircuitBreaker(errorDetails: NetworkErrorDetails): boolean {
    // Don't trigger circuit breaker for client errors or SSL issues
    if (errorDetails.networkErrorType === NetworkErrorType.CLIENT_ERROR ||
        errorDetails.networkErrorType === NetworkErrorType.SSL_HANDSHAKE ||
        errorDetails.networkErrorType === NetworkErrorType.CORS_ERROR) {
      return false;
    }

    // Don't trigger for authentication/permission errors
    if (errorDetails.classifiedType === ErrorType.PERMISSION_ERROR) {
      return false;
    }

    // Trigger for retryable network errors
    return errorDetails.retryable;
  }

  /**
   * Get retry delay based on error type and attempt count
   */
  static getRetryDelay(errorDetails: NetworkErrorDetails, attemptCount: number): number {
    const baseDelays = {
      [NetworkErrorType.HTTP2_PROTOCOL]: 2000,
      [NetworkErrorType.CONNECTION_RESET]: 1000,
      [NetworkErrorType.CONNECTION_TIMEOUT]: 3000,
      [NetworkErrorType.DNS_RESOLUTION]: 5000,
      [NetworkErrorType.REQUEST_TIMEOUT]: 1500,
      [NetworkErrorType.RATE_LIMITED]: 10000,
      [NetworkErrorType.SERVER_ERROR]: 5000,
      [NetworkErrorType.NETWORK_UNAVAILABLE]: 3000,
      [NetworkErrorType.UNKNOWN_NETWORK]: 2000
    };

    const baseDelay = baseDelays[errorDetails.networkErrorType] || 2000;
    
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attemptCount);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }
}

// Export convenience functions
export const classifyNetworkError = NetworkErrorClassifier.classifyError.bind(NetworkErrorClassifier);
export const shouldTriggerCircuitBreaker = NetworkErrorClassifier.shouldTriggerCircuitBreaker.bind(NetworkErrorClassifier);
export const getRetryDelay = NetworkErrorClassifier.getRetryDelay.bind(NetworkErrorClassifier);