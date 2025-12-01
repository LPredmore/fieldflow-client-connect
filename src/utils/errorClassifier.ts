/**
 * Enhanced Error Classification System
 * 
 * Provides comprehensive error categorization and retry strategy determination
 * for all network, protocol, authentication, and server errors.
 */

export enum ErrorCategory {
  NETWORK = 'network',
  PROTOCOL = 'protocol',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  SERVER = 'server',
  CLIENT = 'client',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ClassifiedError {
  category: ErrorCategory;
  isRetryable: boolean;
  retryDelay: number;
  maxRetries: number;
  severity: ErrorSeverity;
  userMessage: string;
  technicalDetails: string;
  originalError: unknown;
  shouldSwitchProtocol: boolean;
  shouldUseCache: boolean;
}

export interface RetryStrategy {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

/**
 * Error Classifier
 * 
 * Analyzes errors and provides classification with appropriate recovery strategies
 */
export class ErrorClassifier {
  // HTTP/2 Protocol Error Patterns
  private static readonly HTTP2_ERRORS = [
    'ERR_HTTP2_PROTOCOL_ERROR',
    'ERR_HTTP2_STREAM_ERROR',
    'ERR_HTTP2_SESSION_ERROR',
    'HTTP2_HEADER_TIMEOUT',
    'HTTP2_SESSION_ERROR',
    'ERR_HTTP2_INVALID_SESSION',
    'ERR_HTTP2_FRAME_ERROR'
  ];

  // Network Error Patterns
  private static readonly NETWORK_ERRORS = [
    'ERR_CONNECTION_RESET',
    'ERR_CONNECTION_CLOSED',
    'ERR_CONNECTION_REFUSED',
    'ERR_NETWORK',
    'ECONNRESET',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ENETUNREACH',
    'EHOSTUNREACH',
    'Failed to fetch',
    'NetworkError',
    'Network request failed'
  ];

  // Timeout Error Patterns
  private static readonly TIMEOUT_ERRORS = [
    'ETIMEDOUT',
    'ESOCKETTIMEDOUT',
    'timeout',
    'timed out',
    'Request timeout',
    'AbortError',  // Catches our defensive timeout aborts
    'aborted'      // Catches abort signals
  ];

  // Authentication Error Patterns
  private static readonly AUTH_ERRORS = [
    'Invalid login credentials',
    'Email not confirmed',
    'Invalid token',
    'Token expired',
    'Unauthorized',
    'Authentication failed'
  ];

  /**
   * Classify an error and determine appropriate handling strategy
   */
  static classify(error: unknown): ClassifiedError {
    const errorMessage = this.extractErrorMessage(error);
    const errorCode = this.extractErrorCode(error);
    const httpStatus = this.extractHttpStatus(error);

    // Check for HTTP/2 protocol errors
    if (this.isHttp2Error(errorMessage, errorCode)) {
      return this.classifyProtocolError(error, errorMessage);
    }

    // Check for network errors
    if (this.isNetworkError(errorMessage, errorCode)) {
      return this.classifyNetworkError(error, errorMessage);
    }

    // Check for timeout errors
    if (this.isTimeoutError(errorMessage, errorCode)) {
      return this.classifyTimeoutError(error, errorMessage);
    }

    // Check for HTTP status-based errors
    if (httpStatus) {
      return this.classifyHttpError(error, httpStatus, errorMessage);
    }

    // Check for authentication errors
    if (this.isAuthError(errorMessage)) {
      return this.classifyAuthError(error, errorMessage);
    }

    // Default to unknown error
    return this.classifyUnknownError(error, errorMessage);
  }

  /**
   * Check if error is HTTP/2 protocol related
   */
  private static isHttp2Error(message: string, code?: string): boolean {
    return this.HTTP2_ERRORS.some(pattern => 
      message.includes(pattern) || code === pattern
    ) || message.toLowerCase().includes('http2') || 
       message.toLowerCase().includes('protocol error');
  }

  /**
   * Check if error is network related
   */
  private static isNetworkError(message: string, code?: string): boolean {
    return this.NETWORK_ERRORS.some(pattern => 
      message.includes(pattern) || code === pattern
    ) || !navigator.onLine;
  }

  /**
   * Check if error is timeout related
   */
  private static isTimeoutError(message: string, code?: string): boolean {
    return this.TIMEOUT_ERRORS.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase()) || code === pattern
    );
  }

  /**
   * Check if error is authentication related
   */
  private static isAuthError(message: string): boolean {
    return this.AUTH_ERRORS.some(pattern => 
      message.includes(pattern)
    );
  }

  /**
   * Classify HTTP/2 protocol error
   */
  private static classifyProtocolError(error: unknown, message: string): ClassifiedError {
    return {
      category: ErrorCategory.PROTOCOL,
      isRetryable: true,
      retryDelay: 0, // Immediate retry with protocol switch
      maxRetries: 3,
      severity: ErrorSeverity.HIGH,
      userMessage: 'Connection protocol issue detected. Switching to alternative connection method...',
      technicalDetails: `HTTP/2 Protocol Error: ${message}`,
      originalError: error,
      shouldSwitchProtocol: true,
      shouldUseCache: true
    };
  }

  /**
   * Classify network error
   */
  private static classifyNetworkError(error: unknown, message: string): ClassifiedError {
    const isOffline = !navigator.onLine;
    
    return {
      category: ErrorCategory.NETWORK,
      isRetryable: !isOffline, // Don't retry if completely offline
      retryDelay: 1000, // 1 second base delay
      maxRetries: 3,
      severity: isOffline ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH,
      userMessage: isOffline 
        ? 'You appear to be offline. Using cached data where available.'
        : 'Network connection issue. Retrying...',
      technicalDetails: `Network Error: ${message}`,
      originalError: error,
      shouldSwitchProtocol: false,
      shouldUseCache: true
    };
  }

  /**
   * Classify timeout error
   */
  private static classifyTimeoutError(error: unknown, message: string): ClassifiedError {
    // Check if this is an abort-based timeout (our defensive timeout)
    const isAbortTimeout = message.includes('abort') || 
                           message.includes('Abort') ||
                           (error instanceof Error && error.name === 'AbortError');
    
    return {
      category: ErrorCategory.TIMEOUT,
      isRetryable: true,
      retryDelay: isAbortTimeout ? 0 : 2000, // Immediate retry for abort timeouts
      maxRetries: 3,
      severity: ErrorSeverity.MEDIUM,
      userMessage: 'Request is taking longer than expected. Retrying...',
      technicalDetails: `Timeout Error: ${message}`,
      originalError: error,
      shouldSwitchProtocol: isAbortTimeout, // Switch protocol on abort timeouts
      shouldUseCache: true
    };
  }

  /**
   * Classify HTTP status code error
   */
  private static classifyHttpError(error: unknown, status: number, message: string): ClassifiedError {
    // 401 Unauthorized
    if (status === 401) {
      return {
        category: ErrorCategory.AUTHENTICATION,
        isRetryable: false,
        retryDelay: 0,
        maxRetries: 0,
        severity: ErrorSeverity.CRITICAL,
        userMessage: 'Your session has expired. Please sign in again.',
        technicalDetails: `Authentication Error (401): ${message}`,
        originalError: error,
        shouldSwitchProtocol: false,
        shouldUseCache: false
      };
    }

    // 403 Forbidden
    if (status === 403) {
      return {
        category: ErrorCategory.AUTHORIZATION,
        isRetryable: false,
        retryDelay: 0,
        maxRetries: 0,
        severity: ErrorSeverity.HIGH,
        userMessage: 'You do not have permission to access this resource.',
        technicalDetails: `Authorization Error (403): ${message}`,
        originalError: error,
        shouldSwitchProtocol: false,
        shouldUseCache: true // Use cached data if available
      };
    }

    // 404 Not Found
    if (status === 404) {
      return {
        category: ErrorCategory.CLIENT,
        isRetryable: false,
        retryDelay: 0,
        maxRetries: 0,
        severity: ErrorSeverity.LOW,
        userMessage: 'The requested resource was not found.',
        technicalDetails: `Not Found (404): ${message}`,
        originalError: error,
        shouldSwitchProtocol: false,
        shouldUseCache: false
      };
    }

    // 400-499 Client Errors
    if (status >= 400 && status < 500) {
      return {
        category: ErrorCategory.CLIENT,
        isRetryable: false,
        retryDelay: 0,
        maxRetries: 0,
        severity: ErrorSeverity.MEDIUM,
        userMessage: 'There was a problem with your request. Please try again.',
        technicalDetails: `Client Error (${status}): ${message}`,
        originalError: error,
        shouldSwitchProtocol: false,
        shouldUseCache: false
      };
    }

    // 500 Internal Server Error
    if (status === 500) {
      return {
        category: ErrorCategory.SERVER,
        isRetryable: true,
        retryDelay: 5000, // 5 second base delay
        maxRetries: 3,
        severity: ErrorSeverity.HIGH,
        userMessage: 'Server error occurred. Retrying...',
        technicalDetails: `Server Error (500): ${message}`,
        originalError: error,
        shouldSwitchProtocol: false,
        shouldUseCache: true
      };
    }

    // 502 Bad Gateway
    if (status === 502) {
      return {
        category: ErrorCategory.SERVER,
        isRetryable: true,
        retryDelay: 5000,
        maxRetries: 3,
        severity: ErrorSeverity.HIGH,
        userMessage: 'Gateway error. Retrying...',
        technicalDetails: `Bad Gateway (502): ${message}`,
        originalError: error,
        shouldSwitchProtocol: false,
        shouldUseCache: true
      };
    }

    // 503 Service Unavailable
    if (status === 503) {
      return {
        category: ErrorCategory.SERVER,
        isRetryable: true,
        retryDelay: 10000, // 10 second base delay
        maxRetries: 3,
        severity: ErrorSeverity.HIGH,
        userMessage: 'Service temporarily unavailable. Retrying...',
        technicalDetails: `Service Unavailable (503): ${message}`,
        originalError: error,
        shouldSwitchProtocol: false,
        shouldUseCache: true
      };
    }

    // 504 Gateway Timeout
    if (status === 504) {
      return {
        category: ErrorCategory.TIMEOUT,
        isRetryable: true,
        retryDelay: 5000,
        maxRetries: 3,
        severity: ErrorSeverity.HIGH,
        userMessage: 'Gateway timeout. Retrying...',
        technicalDetails: `Gateway Timeout (504): ${message}`,
        originalError: error,
        shouldSwitchProtocol: false,
        shouldUseCache: true
      };
    }

    // Other 500-599 Server Errors
    if (status >= 500 && status < 600) {
      return {
        category: ErrorCategory.SERVER,
        isRetryable: true,
        retryDelay: 5000,
        maxRetries: 3,
        severity: ErrorSeverity.HIGH,
        userMessage: 'Server error occurred. Retrying...',
        technicalDetails: `Server Error (${status}): ${message}`,
        originalError: error,
        shouldSwitchProtocol: false,
        shouldUseCache: true
      };
    }

    // Unknown HTTP error
    return this.classifyUnknownError(error, message);
  }

  /**
   * Classify authentication error
   */
  private static classifyAuthError(error: unknown, message: string): ClassifiedError {
    return {
      category: ErrorCategory.AUTHENTICATION,
      isRetryable: false,
      retryDelay: 0,
      maxRetries: 0,
      severity: ErrorSeverity.CRITICAL,
      userMessage: 'Authentication failed. Please check your credentials and try again.',
      technicalDetails: `Authentication Error: ${message}`,
      originalError: error,
      shouldSwitchProtocol: false,
      shouldUseCache: false
    };
  }

  /**
   * Classify unknown error
   */
  private static classifyUnknownError(error: unknown, message: string): ClassifiedError {
    return {
      category: ErrorCategory.UNKNOWN,
      isRetryable: true,
      retryDelay: 2000,
      maxRetries: 2,
      severity: ErrorSeverity.MEDIUM,
      userMessage: 'An unexpected error occurred. Retrying...',
      technicalDetails: `Unknown Error: ${message}`,
      originalError: error,
      shouldSwitchProtocol: false,
      shouldUseCache: true
    };
  }

  /**
   * Get retry strategy for classified error
   */
  static getRetryStrategy(classifiedError: ClassifiedError): RetryStrategy {
    const baseDelay = classifiedError.retryDelay;
    
    return {
      maxAttempts: classifiedError.maxRetries,
      baseDelay: baseDelay,
      maxDelay: Math.min(baseDelay * 8, 30000), // Max 30 seconds
      backoffMultiplier: 2,
      jitterFactor: 0.1 // 10% jitter
    };
  }

  /**
   * Extract error message from various error types
   */
  private static extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object') {
      if ('message' in error && typeof error.message === 'string') {
        return error.message;
      }
      if ('error' in error && typeof error.error === 'string') {
        return error.error;
      }
      if ('details' in error && typeof error.details === 'string') {
        return error.details;
      }
    }
    
    return String(error);
  }

  /**
   * Extract error code from error object
   */
  private static extractErrorCode(error: unknown): string | undefined {
    if (error && typeof error === 'object') {
      if ('code' in error && typeof error.code === 'string') {
        return error.code;
      }
      if ('name' in error && typeof error.name === 'string') {
        return error.name;
      }
    }
    return undefined;
  }

  /**
   * Extract HTTP status code from error object
   */
  private static extractHttpStatus(error: unknown): number | undefined {
    if (error && typeof error === 'object') {
      if ('status' in error && typeof error.status === 'number') {
        return error.status;
      }
      if ('statusCode' in error && typeof error.statusCode === 'number') {
        return error.statusCode;
      }
      if ('code' in error && typeof error.code === 'number') {
        return error.code;
      }
    }
    return undefined;
  }

  /**
   * Check if error should trigger protocol switch
   */
  static shouldSwitchProtocol(error: unknown): boolean {
    const classified = this.classify(error);
    return classified.shouldSwitchProtocol;
  }

  /**
   * Check if error should use cached data
   */
  static shouldUseCache(error: unknown): boolean {
    const classified = this.classify(error);
    return classified.shouldUseCache;
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: unknown): boolean {
    const classified = this.classify(error);
    return classified.isRetryable;
  }
}
