import React from 'react';
import { AlertTriangle, RefreshCw, Wifi, Shield, Clock, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ErrorType } from '@/utils/circuitBreaker';

interface ErrorStateProps {
  error: string;
  errorType?: ErrorType;
  onRetry?: () => void;
  showRetry?: boolean;
  className?: string;
  compact?: boolean;
}

const getErrorIcon = (errorType?: ErrorType) => {
  switch (errorType) {
    case ErrorType.NETWORK_ERROR:
      return Wifi;
    case ErrorType.PERMISSION_ERROR:
      return Shield;
    case ErrorType.TIMEOUT_ERROR:
      return Clock;
    case ErrorType.SCHEMA_MISMATCH:
      return Database;
    default:
      return AlertTriangle;
  }
};

const getErrorTitle = (errorType?: ErrorType) => {
  switch (errorType) {
    case ErrorType.NETWORK_ERROR:
      return 'Connection Problem';
    case ErrorType.PERMISSION_ERROR:
      return 'Access Denied';
    case ErrorType.TIMEOUT_ERROR:
      return 'Request Timeout';
    case ErrorType.SCHEMA_MISMATCH:
      return 'Data Structure Issue';
    default:
      return 'Something went wrong';
  }
};

const getErrorDescription = (errorType?: ErrorType, error?: string) => {
  switch (errorType) {
    case ErrorType.NETWORK_ERROR:
      return 'Please check your internet connection and try again.';
    case ErrorType.PERMISSION_ERROR:
      return 'You don\'t have permission to access this data.';
    case ErrorType.TIMEOUT_ERROR:
      return 'The request took too long to complete. Please try again.';
    case ErrorType.SCHEMA_MISMATCH:
      return 'There\'s a data structure mismatch. Please contact support.';
    default:
      return error || 'An unexpected error occurred. Please try again.';
  }
};

export function ErrorState({ 
  error, 
  errorType, 
  onRetry, 
  showRetry = true, 
  className,
  compact = false
}: ErrorStateProps) {
  const Icon = getErrorIcon(errorType);
  const title = getErrorTitle(errorType);
  const description = getErrorDescription(errorType, error);

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20",
        className
      )}>
        <Icon className="h-5 w-5 text-destructive flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        </div>
        {showRetry && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="flex-shrink-0"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("border-destructive/20", className)}>
      <CardContent className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <Icon className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          {description}
        </p>
        {showRetry && onRetry && (
          <Button onClick={onRetry} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}