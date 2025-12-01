/**
 * Routing Error Page Component
 * 
 * Displays error messages for routing failures with recovery options.
 * 
 * Requirements: 3.7, 7.6
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { AuthError } from '@/services/auth/AuthError';

interface RoutingErrorPageProps {
  error: AuthError;
  onReset: () => void;
}

/**
 * RoutingErrorPage Component
 * 
 * Shows user-friendly error messages for routing failures with options to recover.
 */
export function RoutingErrorPage({ error, onReset }: RoutingErrorPageProps) {
  const handleReset = () => {
    console.debug('[RoutingErrorPage] Reset button clicked');
    onReset();
  };

  const handleGoHome = () => {
    console.debug('[RoutingErrorPage] Go home button clicked');
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <CardTitle>Navigation Error</CardTitle>
          </div>
          <CardDescription>
            We encountered an issue while trying to navigate you to the correct page.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Details</AlertTitle>
            <AlertDescription>
              {error.userMessage}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">What you can try:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Click "Reset and Retry" to clear the error and try again</li>
              <li>Refresh your browser page</li>
              <li>Clear your browser cache and cookies</li>
              <li>If the problem persists, contact support</li>
            </ul>
          </div>

          {import.meta.env.DEV && error.technicalDetails && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer font-semibold">
                Technical Details (Development Only)
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded overflow-auto">
                {JSON.stringify(error.technicalDetails, null, 2)}
              </pre>
            </details>
          )}
        </CardContent>

        <CardFooter className="flex gap-2">
          <Button onClick={handleReset} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Reset and Retry
          </Button>
          <Button onClick={handleGoHome} variant="outline" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Go to Home
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
