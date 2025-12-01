/**
 * Circuit Breaker Recovery UI Component
 * 
 * Displays user-friendly interface when circuit breaker is open,
 * providing recovery options and clear messaging.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw, Clock, ExternalLink } from 'lucide-react';
import { CircuitBreakerStatus } from '@/services/auth/CircuitBreakerRecoveryService';

interface CircuitBreakerRecoveryUIProps {
  status: CircuitBreakerStatus;
  onReset: () => Promise<void>;
  error?: Error;
}

/**
 * CircuitBreakerRecoveryUI Component
 * 
 * Shows when circuit breaker is open, providing user-friendly error message
 * and recovery options.
 */
export function CircuitBreakerRecoveryUI({ status, onReset, error }: CircuitBreakerRecoveryUIProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [resetAttempts, setResetAttempts] = useState(0);
  const [lastResetError, setLastResetError] = useState<Error | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleReset = async () => {
    console.debug('[CircuitBreakerRecoveryUI] Reset button clicked', { resetAttempts });
    setIsResetting(true);
    setLastResetError(null);
    setShowSuccess(false);

    try {
      await onReset();
      
      // Show success feedback
      setShowSuccess(true);
      setResetAttempts(0);
      
      console.debug('[CircuitBreakerRecoveryUI] Reset successful');
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch (err) {
      const resetError = err instanceof Error ? err : new Error('Reset failed');
      console.error('[CircuitBreakerRecoveryUI] Reset failed', resetError);
      
      setLastResetError(resetError);
      setResetAttempts(prev => prev + 1);
    } finally {
      setIsResetting(false);
    }
  };

  const getTimeUntilRetry = (): string | null => {
    if (!status.nextRetryTime) {
      return null;
    }

    const now = Date.now();
    const timeRemaining = status.nextRetryTime - now;

    if (timeRemaining <= 0) {
      return 'Ready to retry';
    }

    const seconds = Math.ceil(timeRemaining / 1000);
    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }

    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  const timeUntilRetry = getTimeUntilRetry();
  const showSupportLink = resetAttempts >= 2;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <CardTitle>System Protection Mode</CardTitle>
          </div>
          <CardDescription>
            The system has temporarily paused to prevent overload
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Main error message */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>What happened?</AlertTitle>
            <AlertDescription>
              We detected multiple failed attempts to load your account information. 
              To protect the system and your data, we've temporarily paused authentication requests.
            </AlertDescription>
          </Alert>

          {/* Success feedback */}
          {showSuccess && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-600">Reset Successful</AlertTitle>
              <AlertDescription className="text-green-600">
                The system has been reset. You should be redirected shortly.
              </AlertDescription>
            </Alert>
          )}

          {/* Reset error feedback */}
          {lastResetError && !showSuccess && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Reset Failed</AlertTitle>
              <AlertDescription>
                {lastResetError.message || 'Unable to reset the system. Please try again.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Status information */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Current Status:</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                {status.state === 'open' && timeUntilRetry && (
                  <>Automatic retry in: {timeUntilRetry}</>
                )}
                {status.state === 'half-open' && (
                  <>Testing connection...</>
                )}
                {status.state === 'closed' && (
                  <>System operational</>
                )}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Failed attempts: {status.failureCount}
            </div>
          </div>

          {/* What you can do */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">What you can do:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Click "Reset and Retry" to attempt recovery immediately</li>
              <li>Wait for the automatic retry (system will test connection automatically)</li>
              <li>Check your internet connection</li>
              <li>Refresh your browser if the issue persists</li>
              {showSupportLink && (
                <li className="font-semibold text-foreground">
                  If problems continue, contact support using the link below
                </li>
              )}
            </ul>
          </div>

          {/* Technical details (dev only) */}
          {import.meta.env.DEV && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer font-semibold">
                Technical Details (Development Only)
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded overflow-auto">
                {JSON.stringify({
                  state: status.state,
                  failureCount: status.failureCount,
                  lastFailureTime: status.lastFailureTime ? new Date(status.lastFailureTime).toISOString() : null,
                  lastSuccessTime: status.lastSuccessTime ? new Date(status.lastSuccessTime).toISOString() : null,
                  nextRetryTime: status.nextRetryTime ? new Date(status.nextRetryTime).toISOString() : null,
                  resetAttempts,
                  error: error?.message
                }, null, 2)}
              </pre>
            </details>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <div className="flex gap-2 w-full">
            <Button 
              onClick={handleReset} 
              disabled={isResetting}
              className="flex items-center gap-2 flex-1"
            >
              <RefreshCw className={`h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
              {isResetting ? 'Resetting...' : 'Reset and Retry'}
            </Button>
          </div>

          {/* Support link after multiple failed attempts */}
          {showSupportLink && (
            <Button 
              variant="outline" 
              className="flex items-center gap-2 w-full"
              onClick={() => {
                // In a real app, this would link to support
                window.open('mailto:support@example.com?subject=Circuit Breaker Issue', '_blank');
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Contact Support
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
