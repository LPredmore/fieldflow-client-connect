/**
 * Authentication Error Types and Classes
 * 
 * Defines error types and custom error class for authentication operations.
 * 
 * Requirements: 7.3, 7.4, 7.5, 7.6
 */

export enum AuthErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  ROLE_DETECTION_FAILED = 'ROLE_DETECTION_FAILED',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  REDIRECT_LOOP_DETECTED = 'REDIRECT_LOOP_DETECTED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DATA_FETCH_FAILED = 'DATA_FETCH_FAILED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Custom authentication error class
 */
export class AuthError extends Error {
  type: AuthErrorType;
  recoverable: boolean;
  userMessage: string;
  technicalDetails: any;

  constructor(
    type: AuthErrorType,
    message: string,
    userMessage: string,
    recoverable: boolean = true,
    technicalDetails?: any
  ) {
    super(message);
    this.name = 'AuthError';
    this.type = type;
    this.recoverable = recoverable;
    this.userMessage = userMessage;
    this.technicalDetails = technicalDetails;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (typeof (Error as any).captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, AuthError);
    }
  }

  /**
   * Create AuthError from unknown error
   */
  static fromError(error: unknown, type?: AuthErrorType): AuthError {
    if (error instanceof AuthError) {
      return error;
    }

    if (error instanceof Error) {
      const errorType = type || AuthError.detectErrorType(error);
      const userMessage = AuthError.getUserMessage(errorType, error);

      return new AuthError(
        errorType,
        error.message,
        userMessage,
        true,
        { originalError: error }
      );
    }

    return new AuthError(
      AuthErrorType.UNKNOWN_ERROR,
      'An unknown error occurred',
      'Something went wrong. Please try again.',
      true,
      { originalError: error }
    );
  }

  /**
   * Detect error type from error object
   */
  private static detectErrorType(error: Error): AuthErrorType {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return AuthErrorType.NETWORK_ERROR;
    }

    if (message.includes('circuit breaker')) {
      return AuthErrorType.CIRCUIT_BREAKER_OPEN;
    }

    if (message.includes('invalid') || message.includes('credentials')) {
      return AuthErrorType.AUTHENTICATION_FAILED;
    }

    if (message.includes('role') || message.includes('profile')) {
      return AuthErrorType.ROLE_DETECTION_FAILED;
    }

    if (message.includes('permission') || message.includes('access denied')) {
      return AuthErrorType.PERMISSION_DENIED;
    }

    if (message.includes('session') || message.includes('expired')) {
      return AuthErrorType.SESSION_EXPIRED;
    }

    return AuthErrorType.UNKNOWN_ERROR;
  }

  /**
   * Get user-friendly error message
   */
  private static getUserMessage(type: AuthErrorType, error?: Error): string {
    switch (type) {
      case AuthErrorType.NETWORK_ERROR:
        return 'Network connection issue. Please check your internet connection and try again.';

      case AuthErrorType.AUTHENTICATION_FAILED:
        return 'Invalid email or password. Please check your credentials and try again.';

      case AuthErrorType.ROLE_DETECTION_FAILED:
        return 'Unable to determine your account type. Please contact support if this persists.';

      case AuthErrorType.CIRCUIT_BREAKER_OPEN:
        return 'The system is experiencing issues. Please wait a moment and try again.';

      case AuthErrorType.REDIRECT_LOOP_DETECTED:
        return 'Navigation error detected. Please refresh the page or contact support.';

      case AuthErrorType.PERMISSION_DENIED:
        return 'You do not have permission to access this resource.';

      case AuthErrorType.DATA_FETCH_FAILED:
        return 'Failed to load your account data. Please try again.';

      case AuthErrorType.SESSION_EXPIRED:
        return 'Your session has expired. Please log in again.';

      case AuthErrorType.UNKNOWN_ERROR:
      default:
        return error?.message || 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(): boolean {
    return this.recoverable;
  }

  /**
   * Check if error should trigger retry
   */
  shouldRetry(): boolean {
    return this.type === AuthErrorType.NETWORK_ERROR ||
           this.type === AuthErrorType.DATA_FETCH_FAILED;
  }

  /**
   * Get retry delay in milliseconds
   */
  getRetryDelay(attemptNumber: number): number {
    // Exponential backoff: 1s, 2s, 4s
    return Math.min(1000 * Math.pow(2, attemptNumber - 1), 4000);
  }
}
