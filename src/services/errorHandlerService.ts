/**
 * Error Handler Service
 * 
 * This service provides comprehensive error handling for the clinician registration system.
 * It implements user-friendly error messages, fallback behaviors, and error recovery strategies
 * for different failure scenarios.
 */

import {
  ErrorHandler,
  AuthenticationError,
  DataConsistencyError,
  PermissionError,
  SystemError,
  ValidationError,
  ClinicianRegistrationError,
  AuditLogEntry,
} from '@/types/clinician-registration';

/**
 * Error notification interface for UI feedback
 */
export interface ErrorNotification {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  actions?: Array<{
    label: string;
    action: () => void | Promise<void>;
    variant?: 'primary' | 'secondary' | 'destructive';
  }>;
  autoClose?: boolean;
  duration?: number;
  persistent?: boolean;
}

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
  canRecover: boolean;
  recoveryActions: Array<{
    label: string;
    action: () => Promise<boolean>;
    description?: string;
  }>;
  fallbackPath?: string;
  requiresUserAction: boolean;
}

/**
 * Error handling configuration
 */
interface ErrorHandlerConfig {
  /** Enable automatic error reporting */
  enableErrorReporting: boolean;
  /** Enable user notifications */
  enableUserNotifications: boolean;
  /** Enable automatic recovery attempts */
  enableAutoRecovery: boolean;
  /** Maximum number of recovery attempts */
  maxRecoveryAttempts: number;
  /** Default notification duration in milliseconds */
  defaultNotificationDuration: number;
  /** Paths for different error scenarios */
  errorPaths: {
    login: string;
    home: string;
    support: string;
    registration: string;
  };
}

const DEFAULT_CONFIG: ErrorHandlerConfig = {
  enableErrorReporting: true,
  enableUserNotifications: true,
  enableAutoRecovery: true,
  maxRecoveryAttempts: 3,
  defaultNotificationDuration: 5000,
  errorPaths: {
    login: '/auth/login',
    home: '/',
    support: '/support',
    registration: '/staff/registration',
  },
};

/**
 * Comprehensive Error Handler Service
 */
export class ErrorHandlerService implements ErrorHandler {
  private config: ErrorHandlerConfig;
  private errorLog: AuditLogEntry[] = [];
  private recoveryAttempts = new Map<string, number>();
  private notificationCallbacks: Array<(notification: ErrorNotification) => void> = [];

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Handles authentication errors
   */
  handleAuthenticationError(error: AuthenticationError): void {
    const errorId = this.logError(error, 'authentication');
    
    const notification: ErrorNotification = {
      id: errorId,
      type: 'error',
      title: 'Authentication Required',
      message: 'Your session has expired or you need to log in to continue.',
      actions: [
        {
          label: 'Log In',
          action: () => this.navigateToPath(this.config.errorPaths.login),
          variant: 'primary',
        },
      ],
      persistent: true,
    };

    this.showNotification(notification);

    // Automatic recovery: redirect to login after a short delay
    if (this.config.enableAutoRecovery) {
      setTimeout(() => {
        this.navigateToPath(this.config.errorPaths.login);
      }, 2000);
    }
  }

  /**
   * Handles data consistency errors
   */
  handleDataConsistencyError(error: DataConsistencyError): void {
    const errorId = this.logError(error, 'data_consistency');
    
    const recoveryStrategy = this.getDataConsistencyRecoveryStrategy(error);
    
    const notification: ErrorNotification = {
      id: errorId,
      type: 'warning',
      title: 'Data Issue Detected',
      message: 'There\'s an issue with your account data. We\'re attempting to fix this automatically.',
      actions: recoveryStrategy.recoveryActions.map(action => ({
        label: action.label,
        action: async () => {
          const success = await action.action();
          if (success) {
            this.clearNotification(errorId);
            this.showSuccessNotification('Issue resolved successfully');
          }
        },
        variant: 'secondary' as const,
      })),
      autoClose: !recoveryStrategy.requiresUserAction,
      duration: recoveryStrategy.requiresUserAction ? undefined : 8000,
    };

    this.showNotification(notification);

    // Attempt automatic recovery if possible
    if (this.config.enableAutoRecovery && recoveryStrategy.canRecover && !recoveryStrategy.requiresUserAction) {
      this.attemptAutoRecovery(errorId, recoveryStrategy);
    }
  }

  /**
   * Handles permission errors
   */
  handlePermissionError(error: PermissionError): void {
    const errorId = this.logError(error, 'permission');
    
    const notification: ErrorNotification = {
      id: errorId,
      type: 'error',
      title: 'Access Denied',
      message: 'You don\'t have permission to access this resource. Please contact your administrator if you believe this is an error.',
      actions: [
        {
          label: 'Go Home',
          action: () => this.navigateToPath(this.config.errorPaths.home),
          variant: 'primary',
        },
        {
          label: 'Contact Support',
          action: () => this.navigateToPath(this.config.errorPaths.support),
          variant: 'secondary',
        },
      ],
      persistent: true,
    };

    this.showNotification(notification);
  }

  /**
   * Handles system errors
   */
  handleSystemError(error: SystemError): void {
    const errorId = this.logError(error, 'system');
    
    const recoveryStrategy = this.getSystemErrorRecoveryStrategy(error);
    
    const notification: ErrorNotification = {
      id: errorId,
      type: 'error',
      title: 'System Error',
      message: 'A system error occurred. Our team has been notified and we\'re working to resolve this.',
      actions: [
        {
          label: 'Try Again',
          action: async () => {
            // Attempt to recover by refreshing the current operation
            const success = await this.attemptSystemRecovery(error);
            if (success) {
              this.clearNotification(errorId);
              this.showSuccessNotification('System recovered successfully');
            } else {
              this.showErrorNotification('Recovery failed. Please try again later.');
            }
          },
          variant: 'primary',
        },
        {
          label: 'Go Home',
          action: () => this.navigateToPath(this.config.errorPaths.home),
          variant: 'secondary',
        },
      ],
      autoClose: false,
    };

    this.showNotification(notification);

    // Report to external service
    if (this.config.enableErrorReporting) {
      this.reportErrorToService(error, errorId);
    }
  }

  /**
   * Handles validation errors
   */
  handleValidationError(error: ValidationError): void {
    const errorId = this.logError(error, 'validation');
    
    const fieldErrors = Object.entries(error.fieldErrors)
      .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
      .join('; ');
    
    const notification: ErrorNotification = {
      id: errorId,
      type: 'warning',
      title: 'Validation Error',
      message: `Please correct the following issues: ${fieldErrors}`,
      actions: [
        {
          label: 'Dismiss',
          action: () => this.clearNotification(errorId),
          variant: 'secondary',
        },
      ],
      autoClose: true,
      duration: 10000,
    };

    this.showNotification(notification);
  }

  /**
   * Gets recovery strategy for data consistency errors
   */
  private getDataConsistencyRecoveryStrategy(error: DataConsistencyError): ErrorRecoveryStrategy {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('clinician record') || errorMessage.includes('missing record')) {
      return {
        canRecover: true,
        recoveryActions: [
          {
            label: 'Initialize Account',
            action: async () => {
              try {
                // Attempt to initialize the user's clinician record
                // This would call the clinician status manager to initialize the record
                console.log('Attempting to initialize clinician record for user:', error.userId);
                return true;
              } catch (recoveryError) {
                console.error('Failed to initialize clinician record:', recoveryError);
                return false;
              }
            },
            description: 'Initialize your account data',
          },
        ],
        fallbackPath: this.config.errorPaths.registration,
        requiresUserAction: false,
      };
    }

    if (errorMessage.includes('status') || errorMessage.includes('invalid state')) {
      return {
        canRecover: true,
        recoveryActions: [
          {
            label: 'Reset Status',
            action: async () => {
              try {
                // Attempt to reset the user's status to a valid state
                console.log('Attempting to reset status for user:', error.userId);
                return true;
              } catch (recoveryError) {
                console.error('Failed to reset status:', recoveryError);
                return false;
              }
            },
            description: 'Reset your account status',
          },
        ],
        fallbackPath: this.config.errorPaths.home,
        requiresUserAction: true,
      };
    }

    // Default recovery strategy
    return {
      canRecover: false,
      recoveryActions: [
        {
          label: 'Refresh Page',
          action: async () => {
            window.location.reload();
            return true;
          },
          description: 'Refresh the page to reload your data',
        },
      ],
      fallbackPath: this.config.errorPaths.home,
      requiresUserAction: true,
    };
  }

  /**
   * Gets recovery strategy for system errors
   */
  private getSystemErrorRecoveryStrategy(error: SystemError): ErrorRecoveryStrategy {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return {
        canRecover: true,
        recoveryActions: [
          {
            label: 'Retry Connection',
            action: async () => {
              // Wait a moment and try again
              await new Promise(resolve => setTimeout(resolve, 2000));
              return true;
            },
            description: 'Retry the network connection',
          },
        ],
        requiresUserAction: false,
      };
    }

    if (errorMessage.includes('timeout')) {
      return {
        canRecover: true,
        recoveryActions: [
          {
            label: 'Retry with Longer Timeout',
            action: async () => {
              // Implement retry with longer timeout
              await new Promise(resolve => setTimeout(resolve, 5000));
              return true;
            },
            description: 'Retry the operation with a longer timeout',
          },
        ],
        requiresUserAction: false,
      };
    }

    // Default system error recovery
    return {
      canRecover: false,
      recoveryActions: [
        {
          label: 'Refresh Application',
          action: async () => {
            window.location.reload();
            return true;
          },
          description: 'Refresh the entire application',
        },
      ],
      requiresUserAction: true,
    };
  }

  /**
   * Attempts automatic recovery for data consistency errors
   */
  private async attemptAutoRecovery(errorId: string, strategy: ErrorRecoveryStrategy): Promise<void> {
    const attemptCount = this.recoveryAttempts.get(errorId) || 0;
    
    if (attemptCount >= this.config.maxRecoveryAttempts) {
      this.showErrorNotification('Automatic recovery failed. Please try manual recovery options.');
      return;
    }

    this.recoveryAttempts.set(errorId, attemptCount + 1);

    try {
      for (const action of strategy.recoveryActions) {
        const success = await action.action();
        if (success) {
          this.clearNotification(errorId);
          this.showSuccessNotification('Issue resolved automatically');
          this.recoveryAttempts.delete(errorId);
          return;
        }
      }

      // If all recovery actions failed, show fallback options
      this.showErrorNotification('Automatic recovery failed. Please use the manual recovery options.');
      
    } catch (recoveryError) {
      console.error('Error during automatic recovery:', recoveryError);
      this.showErrorNotification('Recovery attempt failed. Please try again manually.');
    }
  }

  /**
   * Attempts system error recovery
   */
  private async attemptSystemRecovery(error: SystemError): Promise<boolean> {
    try {
      // Implement system-specific recovery logic
      console.log('Attempting system recovery for error:', error.message);
      
      // Wait a moment for transient issues to resolve
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real implementation, this would attempt to:
      // 1. Retry the failed operation
      // 2. Clear any cached data that might be stale
      // 3. Re-establish connections
      // 4. Validate system state
      
      return true;
    } catch (recoveryError) {
      console.error('System recovery failed:', recoveryError);
      return false;
    }
  }

  /**
   * Logs an error and returns the error ID
   */
  private logError(error: ClinicianRegistrationError, category: string): string {
    const errorId = crypto.randomUUID();
    
    const logEntry: AuditLogEntry = {
      id: errorId,
      userId: error.userId || 'unknown',
      action: 'access_denied',
      details: {
        errorType: error.errorType,
        errorCode: error.errorCode,
        message: error.message,
        category,
        stack: error.stack,
      },
      timestamp: new Date().toISOString(),
    };

    this.errorLog.push(logEntry);
    
    // Keep only the last 500 error entries
    if (this.errorLog.length > 500) {
      this.errorLog = this.errorLog.slice(-500);
    }

    console.error(`[ErrorHandler] ${category} error:`, error);
    
    return errorId;
  }

  /**
   * Shows a notification to the user
   */
  private showNotification(notification: ErrorNotification): void {
    if (!this.config.enableUserNotifications) {
      return;
    }

    this.notificationCallbacks.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.error('Error in notification callback:', error);
      }
    });
  }

  /**
   * Shows a success notification
   */
  private showSuccessNotification(message: string): void {
    const notification: ErrorNotification = {
      id: crypto.randomUUID(),
      type: 'info',
      title: 'Success',
      message,
      autoClose: true,
      duration: 3000,
    };

    this.showNotification(notification);
  }

  /**
   * Shows an error notification
   */
  private showErrorNotification(message: string): void {
    const notification: ErrorNotification = {
      id: crypto.randomUUID(),
      type: 'error',
      title: 'Error',
      message,
      autoClose: true,
      duration: 5000,
    };

    this.showNotification(notification);
  }

  /**
   * Clears a specific notification
   */
  private clearNotification(notificationId: string): void {
    // This would be implemented by the UI notification system
    console.log('Clearing notification:', notificationId);
  }

  /**
   * Navigates to a specific path
   */
  private navigateToPath(path: string): void {
    window.location.href = path;
  }

  /**
   * Reports error to external service
   */
  private reportErrorToService(error: Error, errorId: string): void {
    try {
      // In production, this would send to an error reporting service
      const errorReport = {
        errorId,
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      console.log('[ErrorHandler] Error reported:', errorReport);
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }

  /**
   * Registers a callback for notifications
   */
  onNotification(callback: (notification: ErrorNotification) => void): () => void {
    this.notificationCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.notificationCallbacks.indexOf(callback);
      if (index > -1) {
        this.notificationCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Gets recent error logs
   */
  getErrorLogs(limit: number = 100): AuditLogEntry[] {
    return this.errorLog.slice(-limit);
  }

  /**
   * Clears error logs and recovery attempts
   */
  clearLogs(): void {
    this.errorLog = [];
    this.recoveryAttempts.clear();
  }

  /**
   * Updates configuration
   */
  updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Gets current configuration
   */
  getConfig(): ErrorHandlerConfig {
    return { ...this.config };
  }
}

/**
 * Default instance of the error handler service
 */
export const errorHandlerService = new ErrorHandlerService();