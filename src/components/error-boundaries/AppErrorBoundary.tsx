/**
 * Application Error Boundary
 * 
 * Comprehensive error boundary that handles different types of application errors
 * with appropriate recovery mechanisms and user feedback.
 * 
 * Requirements addressed:
 * - 1.2: User-friendly error messages for different failure scenarios
 * - 5.4: Error recovery mechanisms and retry options for users
 */

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft, Bug, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorType: 'network' | 'permission' | 'authentication' | 'validation' | 'system' | 'unknown';
  retryCount: number;
  isRetrying: boolean;
}

interface AppErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  maxRetries?: number;
  enableRetry?: boolean;
  showTechnicalDetails?: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: AppErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: 'unknown',
      retryCount: 0,
      isRetrying: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    const errorType = AppErrorBoundary.classifyError(error);
    
    return {
      hasError: true,
      error,
      errorType
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Error caught:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorType: this.state.errorType
    });

    this.setState({ errorInfo });

    // Call onError callback if provided
    this.props.onError?.(error, errorInfo);

    // Log to external error tracking service if available
    this.logErrorToService(error, errorInfo);
  }

  /**
   * Classify error type for appropriate handling
   */
  private static classifyError(error: Error): AppErrorBoundaryState['errorType'] {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorName = error.name?.toLowerCase() || '';
    const errorString = `${errorName} ${errorMessage}`;

    // Network errors
    if (/network|fetch|connection|timeout|http|cors/i.test(errorString)) {
      return 'network';
    }

    // Permission/Authorization errors
    if (/permission|unauthorized|forbidden|access|denied/i.test(errorString)) {
      return 'permission';
    }

    // Authentication errors
    if (/auth|login|token|session|credential/i.test(errorString)) {
      return 'authentication';
    }

    // Validation errors
    if (/validation|invalid|required|format|schema/i.test(errorString)) {
      return 'validation';
    }

    // System errors
    if (/system|internal|server|database|config/i.test(errorString)) {
      return 'system';
    }

    return 'unknown';
  }

  /**
   * Log error to external service (placeholder)
   */
  private logErrorToService(error: Error, errorInfo: React.ErrorInfo) {
    // This would integrate with services like Sentry, LogRocket, etc.
    console.log('[AppErrorBoundary] Logging error to service:', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get error configuration based on type
   */
  private getErrorConfig() {
    const { errorType } = this.state;

    const configs = {
      network: {
        icon: <AlertTriangle className="h-12 w-12 text-orange-500" />,
        title: 'Connection Problem',
        description: 'We\'re having trouble connecting to our servers. This might be a temporary network issue.',
        canRetry: true,
        suggestions: [
          'Check your internet connection',
          'Try refreshing the page',
          'Disable VPN if you\'re using one',
          'Wait a moment and try again'
        ]
      },
      permission: {
        icon: <Shield className="h-12 w-12 text-red-500" />,
        title: 'Access Denied',
        description: 'You don\'t have permission to access this resource. Please contact your administrator.',
        canRetry: false,
        suggestions: [
          'Contact your system administrator',
          'Check if you\'re logged in with the correct account',
          'Request access to this feature',
          'Try logging out and back in'
        ]
      },
      authentication: {
        icon: <Shield className="h-12 w-12 text-yellow-500" />,
        title: 'Authentication Required',
        description: 'Your session has expired or you need to log in to continue.',
        canRetry: false,
        suggestions: [
          'Log in with your credentials',
          'Check if your session has expired',
          'Clear browser cookies and try again',
          'Contact support if you can\'t log in'
        ]
      },
      validation: {
        icon: <AlertTriangle className="h-12 w-12 text-blue-500" />,
        title: 'Invalid Data',
        description: 'The data provided doesn\'t meet the required format or constraints.',
        canRetry: true,
        suggestions: [
          'Check your input for errors',
          'Ensure all required fields are filled',
          'Verify data format requirements',
          'Try submitting again'
        ]
      },
      system: {
        icon: <Zap className="h-12 w-12 text-purple-500" />,
        title: 'System Error',
        description: 'An internal system error occurred. Our team has been notified and is working on a fix.',
        canRetry: true,
        suggestions: [
          'Try again in a few minutes',
          'Clear browser cache and cookies',
          'Try using a different browser',
          'Contact support if the issue persists'
        ]
      },
      unknown: {
        icon: <Bug className="h-12 w-12 text-gray-500" />,
        title: 'Unexpected Error',
        description: 'Something unexpected happened. Our team has been notified.',
        canRetry: true,
        suggestions: [
          'Try refreshing the page',
          'Clear browser cache and cookies',
          'Try using a different browser',
          'Contact support with details of what you were doing'
        ]
      }
    };

    return configs[errorType];
  }

  /**
   * Retry the failed operation
   */
  private handleRetry = async () => {
    const { maxRetries = 3 } = this.props;
    
    if (this.state.retryCount >= maxRetries) {
      console.warn('[AppErrorBoundary] Max retries reached');
      return;
    }

    this.setState({ isRetrying: true });

    // Wait a moment before retrying
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // Reset the error boundary
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorType: 'unknown',
        retryCount: this.state.retryCount + 1,
        isRetrying: false
      });

      console.log('[AppErrorBoundary] Retry successful, resetting boundary');
      
    } catch (retryError) {
      console.error('[AppErrorBoundary] Retry failed:', retryError);
      
      this.setState({
        retryCount: this.state.retryCount + 1,
        isRetrying: false
      });
    }
  };

  /**
   * Navigate to home page
   */
  private handleGoHome = () => {
    window.location.href = '/';
  };

  /**
   * Go back to previous page
   */
  private handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.handleGoHome();
    }
  };

  /**
   * Reset error boundary manually
   */
  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: 'unknown',
      retryCount: 0,
      isRetrying: false
    });
  };

  /**
   * Handle authentication redirect
   */
  private handleLogin = () => {
    window.location.href = '/auth';
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Use custom fallback if provided
    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { error, errorType, retryCount, isRetrying } = this.state;
    const { maxRetries = 3, enableRetry = true, showTechnicalDetails = true } = this.props;
    const config = this.getErrorConfig();

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {config.icon}
            </div>
            
            <div className="flex items-center justify-center gap-2 mb-2">
              <CardTitle className="text-xl">{config.title}</CardTitle>
              <Badge variant="outline" className="text-xs">
                {errorType}
              </Badge>
            </div>
            
            <CardDescription>
              {config.description}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs defaultValue="actions" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="actions">Actions</TabsTrigger>
                <TabsTrigger value="help">Help</TabsTrigger>
                {showTechnicalDetails && (
                  <TabsTrigger value="technical">Technical</TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="actions" className="space-y-4">
                {/* Retry Information */}
                {enableRetry && config.canRetry && retryCount > 0 && (
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="text-sm font-medium mb-1">
                      Retry Attempts: {retryCount} / {maxRetries}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {retryCount >= maxRetries 
                        ? 'Maximum retry attempts reached. Please try again manually.'
                        : 'You can try again or use the navigation options below.'
                      }
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  {enableRetry && config.canRetry && retryCount < maxRetries && (
                    <Button 
                      onClick={this.handleRetry} 
                      disabled={isRetrying}
                      className="w-full"
                    >
                      {isRetrying ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Try Again
                        </>
                      )}
                    </Button>
                  )}
                  
                  {errorType === 'authentication' && (
                    <Button onClick={this.handleLogin} className="w-full">
                      Go to Login
                    </Button>
                  )}
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={this.handleGoBack}
                      className="flex-1"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Go Back
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      onClick={this.handleGoHome}
                      className="flex-1"
                    >
                      <Home className="h-4 w-4 mr-2" />
                      Home
                    </Button>
                  </div>

                  <Button 
                    variant="secondary" 
                    onClick={this.handleReset}
                    className="w-full"
                  >
                    Reset Page
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="help" className="space-y-4">
                <div className="text-sm space-y-2">
                  <p className="font-medium">Troubleshooting Steps:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    {config.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-xs mt-1">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
                  <p className="font-medium mb-1">Need More Help?</p>
                  <p>If the issue persists, please contact our support team with the error details from the Technical tab.</p>
                </div>
              </TabsContent>
              
              {showTechnicalDetails && (
                <TabsContent value="technical" className="space-y-4">
                  {error && (
                    <div className="text-xs space-y-2">
                      <div className="p-3 bg-muted rounded-lg space-y-2">
                        <div><strong>Error Type:</strong> {error.name}</div>
                        <div><strong>Message:</strong> {error.message}</div>
                        <div><strong>Timestamp:</strong> {new Date().toISOString()}</div>
                        <div><strong>URL:</strong> {window.location.href}</div>
                      </div>
                      
                      {this.state.errorInfo && (
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="font-medium mb-1">Component Stack:</div>
                          <pre className="text-xs overflow-auto whitespace-pre-wrap">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                      
                      {error.stack && (
                        <details className="p-3 bg-muted rounded-lg">
                          <summary className="cursor-pointer font-medium">
                            Error Stack Trace
                          </summary>
                          <pre className="mt-2 text-xs overflow-auto whitespace-pre-wrap">
                            {error.stack}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }
}

/**
 * Functional component wrapper for error boundary
 */
interface ErrorBoundaryWrapperProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export function ErrorBoundaryWrapper({ children, onError }: ErrorBoundaryWrapperProps) {
  return (
    <AppErrorBoundary onError={onError}>
      {children}
    </AppErrorBoundary>
  );
}