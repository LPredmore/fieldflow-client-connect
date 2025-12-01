/**
 * Progressive Error Display Components
 * 
 * Provides user-friendly error messages and recovery options
 * based on error type and recovery strategies.
 */

import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Shield, 
  Database, 
  Clock,
  Info,
  CheckCircle2
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ErrorType } from '@/utils/circuitBreaker';
import { FallbackLevel } from '@/utils/progressiveErrorRecovery';

export interface ProgressiveErrorDisplayProps {
  /** Error message to display */
  error: string;
  /** Type of error for appropriate styling and actions */
  errorType?: ErrorType;
  /** Recovery level being used */
  recoveryLevel?: FallbackLevel;
  /** Whether the error is retryable */
  retryable?: boolean;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Whether showing cached data */
  showingCachedData?: boolean;
  /** Cache age in milliseconds */
  cacheAge?: number;
  /** Retry callback function */
  onRetry?: () => void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
  /** Additional context about the error */
  context?: string;
  /** Custom retry button text */
  retryButtonText?: string;
  /** Whether to show detailed error information */
  showDetails?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function ProgressiveErrorDisplay({
  error,
  errorType,
  recoveryLevel,
  retryable = false,
  retryDelay = 0,
  showingCachedData = false,
  cacheAge = 0,
  onRetry,
  isRetrying = false,
  context,
  retryButtonText,
  showDetails = false,
  className
}: ProgressiveErrorDisplayProps) {
  const [countdown, setCountdown] = useState(0);

  // Handle retry countdown
  useEffect(() => {
    if (retryDelay > 0 && retryable) {
      setCountdown(Math.ceil(retryDelay / 1000));
      
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [retryDelay, retryable]);

  const getErrorIcon = () => {
    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
        return <WifiOff className="h-4 w-4" />;
      case ErrorType.TIMEOUT_ERROR:
        return <Clock className="h-4 w-4" />;
      case ErrorType.PERMISSION_ERROR:
        return <Shield className="h-4 w-4" />;
      case ErrorType.SCHEMA_MISMATCH:
      case ErrorType.POLICY_INFINITE_RECURSION:
      case ErrorType.POLICY_CIRCULAR_DEPENDENCY:
      case ErrorType.POLICY_EVALUATION_ERROR:
        return <Database className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getErrorVariant = () => {
    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
      case ErrorType.TIMEOUT_ERROR:
        return 'default';
      case ErrorType.PERMISSION_ERROR:
        return 'destructive';
      case ErrorType.POLICY_INFINITE_RECURSION:
      case ErrorType.POLICY_CIRCULAR_DEPENDENCY:
      case ErrorType.POLICY_EVALUATION_ERROR:
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getRecoveryLevelBadge = () => {
    if (!recoveryLevel) return null;

    const levelConfig = {
      [FallbackLevel.CACHE_STALE]: {
        label: 'Using Recent Data',
        variant: 'secondary' as const,
        icon: <CheckCircle2 className="h-3 w-3" />
      },
      [FallbackLevel.CACHE_EXPIRED]: {
        label: 'Using Older Data',
        variant: 'outline' as const,
        icon: <Info className="h-3 w-3" />
      },
      [FallbackLevel.OFFLINE_MODE]: {
        label: 'Offline Mode',
        variant: 'outline' as const,
        icon: <WifiOff className="h-3 w-3" />
      },
      [FallbackLevel.GRACEFUL_DEGRADATION]: {
        label: 'Limited Functionality',
        variant: 'destructive' as const,
        icon: <AlertCircle className="h-3 w-3" />
      }
    };

    const config = levelConfig[recoveryLevel];
    if (!config) return null;

    return (
      <Badge variant={config.variant} className="flex items-center space-x-1">
        {config.icon}
        <span>{config.label}</span>
      </Badge>
    );
  };

  const formatCacheAge = (ageMs: number) => {
    const minutes = Math.floor(ageMs / 60000);
    const seconds = Math.floor((ageMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s ago`;
    }
    return `${seconds}s ago`;
  };

  return (
    <Alert variant={getErrorVariant()} className={cn("space-y-3", className)}>
      <div className="flex items-start space-x-2">
        {getErrorIcon()}
        <div className="flex-1 space-y-2">
          <AlertDescription className="font-medium">
            {error}
          </AlertDescription>
          
          {/* Recovery level indicator */}
          {recoveryLevel && (
            <div className="flex items-center space-x-2">
              {getRecoveryLevelBadge()}
              {showingCachedData && cacheAge > 0 && (
                <span className="text-xs text-muted-foreground">
                  Data from {formatCacheAge(cacheAge)}
                </span>
              )}
            </div>
          )}
          
          {/* Context information */}
          {context && (
            <p className="text-sm text-muted-foreground">
              Context: {context}
            </p>
          )}
          
          {/* Detailed error information */}
          {showDetails && errorType && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Error Type:</strong> {errorType}</p>
              {recoveryLevel && (
                <p><strong>Recovery Level:</strong> {FallbackLevel[recoveryLevel]}</p>
              )}
            </div>
          )}
          
          {/* Retry section */}
          {retryable && onRetry && (
            <div className="flex items-center space-x-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isRetrying || countdown > 0}
                className="flex items-center space-x-2"
              >
                <RefreshCw className={cn(
                  "h-3 w-3",
                  isRetrying && "animate-spin"
                )} />
                <span>
                  {isRetrying 
                    ? 'Retrying...' 
                    : countdown > 0 
                      ? `Retry in ${countdown}s`
                      : retryButtonText || 'Try Again'
                  }
                </span>
              </Button>
              
              {countdown > 0 && (
                <span className="text-xs text-muted-foreground">
                  Automatic retry in {countdown} seconds
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Alert>
  );
}

/**
 * Cache Data Indicator
 * Shows subtle indicator when displaying cached data due to errors
 */
export interface CacheDataIndicatorProps {
  /** Whether to show the indicator */
  show: boolean;
  /** Age of cached data in milliseconds */
  cacheAge: number;
  /** Type of cached data being shown */
  cacheType?: 'stale' | 'expired' | 'offline';
  /** Position of the indicator */
  position?: 'top' | 'bottom' | 'inline';
  /** Additional CSS classes */
  className?: string;
}

export function CacheDataIndicator({
  show,
  cacheAge,
  cacheType = 'stale',
  position = 'top',
  className
}: CacheDataIndicatorProps) {
  if (!show) return null;

  const formatAge = (ageMs: number) => {
    const minutes = Math.floor(ageMs / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`;
    }
    if (minutes > 0) {
      return `${minutes}m ago`;
    }
    return 'Just now';
  };

  const getIndicatorConfig = () => {
    switch (cacheType) {
      case 'stale':
        return {
          icon: <Info className="h-3 w-3" />,
          text: 'Showing recent data',
          variant: 'secondary' as const
        };
      case 'expired':
        return {
          icon: <Clock className="h-3 w-3" />,
          text: 'Showing older data',
          variant: 'outline' as const
        };
      case 'offline':
        return {
          icon: <WifiOff className="h-3 w-3" />,
          text: 'Showing offline data',
          variant: 'outline' as const
        };
      default:
        return {
          icon: <Info className="h-3 w-3" />,
          text: 'Showing cached data',
          variant: 'secondary' as const
        };
    }
  };

  const config = getIndicatorConfig();
  
  const positionClasses = {
    top: 'mb-4',
    bottom: 'mt-4',
    inline: 'my-2'
  };

  return (
    <div className={cn(
      "flex items-center justify-center",
      positionClasses[position],
      className
    )}>
      <Badge variant={config.variant} className="flex items-center space-x-1 text-xs">
        {config.icon}
        <span>{config.text}</span>
        <span className="text-muted-foreground">•</span>
        <span>{formatAge(cacheAge)}</span>
      </Badge>
    </div>
  );
}

/**
 * Error Recovery Status
 * Shows the current recovery attempt and strategy
 */
export interface ErrorRecoveryStatusProps {
  /** Current recovery level being attempted */
  currentLevel: FallbackLevel;
  /** Total number of recovery levels available */
  totalLevels: number;
  /** Whether recovery is in progress */
  isRecovering: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function ErrorRecoveryStatus({
  currentLevel,
  totalLevels,
  isRecovering,
  className
}: ErrorRecoveryStatusProps) {
  const getLevelDescription = (level: FallbackLevel) => {
    switch (level) {
      case FallbackLevel.CACHE_STALE:
        return 'Trying recent cached data';
      case FallbackLevel.CACHE_EXPIRED:
        return 'Trying older cached data';
      case FallbackLevel.OFFLINE_MODE:
        return 'Switching to offline mode';
      case FallbackLevel.GRACEFUL_DEGRADATION:
        return 'Enabling limited functionality';
      default:
        return 'Attempting recovery';
    }
  };

  return (
    <div className={cn("flex items-center space-x-2 text-sm text-muted-foreground", className)}>
      <div className="flex items-center space-x-1">
        {isRecovering && <RefreshCw className="h-3 w-3 animate-spin" />}
        <span>{getLevelDescription(currentLevel)}</span>
      </div>
      <div className="flex space-x-1">
        {Array.from({ length: totalLevels }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 w-4 rounded-full",
              i < currentLevel ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  );
}