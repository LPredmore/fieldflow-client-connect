/**
 * Higher-Order Component for Error Boundary Integration
 * 
 * Provides easy integration of error boundaries with any component.
 * 
 * Requirements addressed:
 * - 1.2: Error recovery mechanisms and retry options
 * - 5.4: User-friendly error pages for different failure scenarios
 */

import React, { ComponentType } from 'react';
import { AppErrorBoundary } from './AppErrorBoundary';

interface WithErrorBoundaryOptions {
  type?: 'network' | 'app';
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  maxRetries?: number;
  enableRetry?: boolean;
  showTechnicalDetails?: boolean;
  showNetworkStatus?: boolean;
}

/**
 * Higher-order component that wraps a component with an error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  options: WithErrorBoundaryOptions = {}
) {
  const {
    type = 'app',
    fallback,
    onError,
    maxRetries = 3,
    enableRetry = true,
    showTechnicalDetails = true,
    showNetworkStatus = true
  } = options;

  const WrappedComponent = (props: P) => {
    const ErrorBoundaryComponent = AppErrorBoundary;
    
    const boundaryProps = type === 'network' 
      ? {
          fallback,
          onError,
          maxRetries,
          showNetworkStatus
        }
      : {
          fallback,
          onError,
          maxRetries,
          enableRetry,
          showTechnicalDetails
        };

    return (
      <ErrorBoundaryComponent {...boundaryProps}>
        <Component {...props} />
      </ErrorBoundaryComponent>
    );
  };

  // Preserve component name for debugging
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Decorator for class components
 */
export function ErrorBoundary(options: WithErrorBoundaryOptions = {}) {
  return function <T extends ComponentType<any>>(target: T): T {
    return withErrorBoundary(target, options) as T;
  };
}

/**
 * Hook for functional components to add error boundary protection
 */
export function useErrorBoundaryProtection(options: WithErrorBoundaryOptions = {}) {
  const [error, setError] = React.useState<Error | null>(null);

  const captureError = React.useCallback((error: Error) => {
    if (options.onError) {
      options.onError(error, { componentStack: '' });
    }
    setError(error);
  }, [options.onError]);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  // Throw error to be caught by error boundary
  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return {
    captureError,
    resetError,
    hasError: !!error
  };
}

/**
 * Component wrapper that provides error boundary protection
 */
interface ErrorBoundaryProviderProps {
  children: React.ReactNode;
  type?: 'network' | 'app';
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export function ErrorBoundaryProvider({ 
  children, 
  type = 'app',
  fallback,
  onError 
}: ErrorBoundaryProviderProps) {
  const ErrorBoundaryComponent = AppErrorBoundary;
  
  return (
    <ErrorBoundaryComponent fallback={fallback} onError={onError}>
      {children}
    </ErrorBoundaryComponent>
  );
}

/**
 * Async error handler for promises and async operations
 */
export function createAsyncErrorHandler(
  onError?: (error: Error) => void
) {
  return (error: Error) => {
    console.error('[AsyncErrorHandler] Async operation failed:', error);
    
    if (onError) {
      onError(error);
    } else {
      // Create a synthetic error info object
      const errorInfo: React.ErrorInfo = {
        componentStack: 'Async operation error'
      };
      
      // This would typically be handled by a global error handler
      // or error reporting service
      console.error('[AsyncErrorHandler] Unhandled async error:', {
        error: error.message,
        stack: error.stack
      });
    }
  };
}

/**
 * Safe async wrapper that catches errors and reports them
 */
export function safeAsync<T extends any[], R>(
  asyncFn: (...args: T) => Promise<R>,
  onError?: (error: Error) => void
) {
  return async (...args: T): Promise<R | null> => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      const errorHandler = createAsyncErrorHandler(onError);
      errorHandler(error as Error);
      return null;
    }
  };
}