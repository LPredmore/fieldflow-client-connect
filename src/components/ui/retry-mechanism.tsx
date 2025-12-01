import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ErrorType } from '@/utils/circuitBreaker';

interface RetryMechanismProps {
  onRetry: () => Promise<void> | void;
  error?: string;
  errorType?: ErrorType;
  maxRetries?: number;
  retryDelay?: number;
  autoRetry?: boolean;
  className?: string;
  compact?: boolean;
}

export function RetryMechanism({
  onRetry,
  error,
  errorType,
  maxRetries = 3,
  retryDelay = 5000,
  autoRetry = false,
  className,
  compact = false
}: RetryMechanismProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [autoRetryEnabled, setAutoRetryEnabled] = useState(autoRetry);

  // Auto-retry countdown effect
  useEffect(() => {
    if (autoRetryEnabled && retryCount < maxRetries && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (autoRetryEnabled && retryCount < maxRetries && countdown === 0) {
      handleRetry();
    }
  }, [countdown, autoRetryEnabled, retryCount, maxRetries]);

  // Start auto-retry countdown when component mounts
  useEffect(() => {
    if (autoRetryEnabled && retryCount < maxRetries) {
      setCountdown(Math.floor(retryDelay / 1000));
    }
  }, [autoRetryEnabled, retryDelay, retryCount, maxRetries]);

  const handleRetry = async () => {
    if (retryCount >= maxRetries) return;
    
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    
    try {
      await onRetry();
      // Reset retry count on success
      setRetryCount(0);
      setAutoRetryEnabled(false);
    } catch (err) {
      // Retry failed, will show updated state
      if (autoRetryEnabled && retryCount + 1 < maxRetries) {
        setCountdown(Math.floor(retryDelay / 1000));
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const handleManualRetry = () => {
    setAutoRetryEnabled(false);
    setCountdown(0);
    handleRetry();
  };

  const toggleAutoRetry = () => {
    setAutoRetryEnabled(!autoRetryEnabled);
    if (!autoRetryEnabled && retryCount < maxRetries) {
      setCountdown(Math.floor(retryDelay / 1000));
    } else {
      setCountdown(0);
    }
  };

  const getRetryMessage = () => {
    if (retryCount >= maxRetries) {
      return 'Maximum retry attempts reached';
    }
    
    if (isRetrying) {
      return 'Retrying...';
    }
    
    if (autoRetryEnabled && countdown > 0) {
      return `Auto-retry in ${countdown}s (attempt ${retryCount + 1}/${maxRetries})`;
    }
    
    if (retryCount > 0) {
      return `Retry attempt ${retryCount}/${maxRetries}`;
    }
    
    return 'Ready to retry';
  };

  const shouldShowAutoRetry = () => {
    // Don't auto-retry for certain error types
    return errorType !== ErrorType.PERMISSION_ERROR && 
           errorType !== ErrorType.SCHEMA_MISMATCH;
  };

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-lg bg-muted/50 border",
        className
      )}>
        <div className="flex items-center gap-2 flex-1">
          {isRetrying ? (
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Wifi className="h-4 w-4 text-muted-foreground" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">{getRetryMessage()}</p>
            {autoRetryEnabled && countdown > 0 && (
              <Progress 
                value={(1 - countdown / Math.floor(retryDelay / 1000)) * 100} 
                className="h-1 mt-1"
              />
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {shouldShowAutoRetry() && retryCount < maxRetries && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAutoRetry}
              className="text-xs"
            >
              {autoRetryEnabled ? 'Cancel' : 'Auto'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRetry}
            disabled={isRetrying || retryCount >= maxRetries}
          >
            {isRetrying ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("border-muted", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {isRetrying ? (
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <Clock className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium">{getRetryMessage()}</p>
              {error && (
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              )}
            </div>
          </div>
        </div>
        
        {autoRetryEnabled && countdown > 0 && (
          <div className="mb-4">
            <Progress 
              value={(1 - countdown / Math.floor(retryDelay / 1000)) * 100} 
              className="h-2"
            />
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <Button
            onClick={handleManualRetry}
            disabled={isRetrying || retryCount >= maxRetries}
            variant="outline"
          >
            {isRetrying ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {retryCount >= maxRetries ? 'Max Retries Reached' : 'Retry Now'}
          </Button>
          
          {shouldShowAutoRetry() && retryCount < maxRetries && (
            <Button
              variant="ghost"
              onClick={toggleAutoRetry}
            >
              {autoRetryEnabled ? 'Cancel Auto-retry' : 'Enable Auto-retry'}
            </Button>
          )}
        </div>
        
        {retryCount >= maxRetries && (
          <p className="text-xs text-muted-foreground mt-2">
            Please check your connection or contact support if the problem persists.
          </p>
        )}
      </CardContent>
    </Card>
  );
}