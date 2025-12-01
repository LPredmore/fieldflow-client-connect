/**
 * Progressive Loading Indicator
 * 
 * Shows enhanced loading states with progress for slow queries (>5 seconds)
 * and user-friendly messages based on query context.
 */

import React, { useState, useEffect } from 'react';
import { Loader2, Clock, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProgressiveLoadingProps {
  /** Whether the query is currently loading */
  isLoading: boolean;
  /** Duration in ms that the query has been loading */
  loadingDuration?: number;
  /** Table or context being loaded */
  context?: string;
  /** Whether this is a retry attempt */
  isRetrying?: boolean;
  /** Current retry attempt number */
  retryAttempt?: number;
  /** Whether to show detailed progress for slow queries */
  showProgress?: boolean;
  /** Custom loading message */
  customMessage?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

export function ProgressiveLoadingIndicator({
  isLoading,
  loadingDuration = 0,
  context = 'data',
  isRetrying = false,
  retryAttempt = 0,
  showProgress = true,
  customMessage,
  size = 'md',
  className
}: ProgressiveLoadingProps) {
  const [currentPhase, setCurrentPhase] = useState<'initial' | 'slow' | 'very_slow'>('initial');
  const [progress, setProgress] = useState(0);

  // Update loading phase based on duration
  useEffect(() => {
    if (!isLoading) {
      setCurrentPhase('initial');
      setProgress(0);
      return;
    }

    if (loadingDuration > 10000) {
      setCurrentPhase('very_slow');
    } else if (loadingDuration > 5000) {
      setCurrentPhase('slow');
    } else {
      setCurrentPhase('initial');
    }

    // Simulate progress for slow queries
    if (showProgress && loadingDuration > 5000) {
      const progressPercent = Math.min(90, (loadingDuration / 30000) * 100);
      setProgress(progressPercent);
    }
  }, [isLoading, loadingDuration, showProgress]);

  if (!isLoading) {
    return null;
  }

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  const getMessage = () => {
    if (customMessage) return customMessage;
    
    if (isRetrying) {
      return `Retrying... (attempt ${retryAttempt + 1})`;
    }

    switch (currentPhase) {
      case 'initial':
        return `Loading ${context}...`;
      case 'slow':
        return `Still loading ${context}... This is taking longer than usual.`;
      case 'very_slow':
        return `Loading ${context}... Please wait, we're working on it.`;
      default:
        return `Loading ${context}...`;
    }
  };

  const getIcon = () => {
    switch (currentPhase) {
      case 'initial':
        return <Loader2 className={cn(sizeClasses[size], "animate-spin")} />;
      case 'slow':
        return <Clock className={cn(sizeClasses[size], "animate-pulse")} />;
      case 'very_slow':
        return <AlertCircle className={cn(sizeClasses[size], "animate-pulse text-amber-500")} />;
      default:
        return <Loader2 className={cn(sizeClasses[size], "animate-spin")} />;
    }
  };

  return (
    <div className={cn("flex flex-col items-center space-y-3 p-4", className)}>
      <div className="flex items-center space-x-2">
        {getIcon()}
        <span className={cn(
          "text-sm font-medium",
          currentPhase === 'very_slow' && "text-amber-600"
        )}>
          {getMessage()}
        </span>
      </div>
      
      {/* Progress bar for slow queries */}
      {showProgress && currentPhase !== 'initial' && (
        <div className="w-full max-w-xs">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={cn(
                "h-2 rounded-full transition-all duration-500",
                currentPhase === 'slow' ? "bg-blue-500" : "bg-amber-500"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Additional context for very slow queries */}
      {currentPhase === 'very_slow' && (
        <div className="text-xs text-muted-foreground text-center max-w-sm">
          <p>This query is taking longer than expected. This might be due to:</p>
          <ul className="mt-1 space-y-1 text-left">
            <li>• High server load</li>
            <li>• Large dataset processing</li>
            <li>• Network connectivity issues</li>
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Network Status Indicator
 * Shows connection status and affects loading behavior
 * @deprecated Use NetworkStatusBanner or NetworkStatusIndicator from network-status-banner.tsx instead
 */
export function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center space-x-2 bg-destructive text-destructive-foreground px-3 py-2 rounded-md shadow-lg">
      <WifiOff className="h-4 w-4" />
      <span className="text-sm font-medium">Offline</span>
    </div>
  );
}

/**
 * Loading Skeleton for different content types
 */
export function LoadingSkeleton({ 
  type = 'list',
  count = 3,
  className 
}: {
  type?: 'list' | 'card' | 'table' | 'form';
  count?: number;
  className?: string;
}) {
  const renderSkeleton = () => {
    switch (type) {
      case 'list':
        return Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center space-x-3 p-3">
            <div className="h-10 w-10 bg-muted rounded-full animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
            </div>
          </div>
        ));
      
      case 'card':
        return Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-4 border rounded-lg space-y-3">
            <div className="h-6 bg-muted rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded w-5/6 animate-pulse" />
            </div>
          </div>
        ));
      
      case 'table':
        return (
          <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="flex space-x-4 p-2">
                <div className="h-4 bg-muted rounded flex-1 animate-pulse" />
                <div className="h-4 bg-muted rounded flex-1 animate-pulse" />
                <div className="h-4 bg-muted rounded flex-1 animate-pulse" />
              </div>
            ))}
          </div>
        );
      
      case 'form':
        return Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
            <div className="h-10 bg-muted rounded animate-pulse" />
          </div>
        ));
      
      default:
        return null;
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {renderSkeleton()}
    </div>
  );
}