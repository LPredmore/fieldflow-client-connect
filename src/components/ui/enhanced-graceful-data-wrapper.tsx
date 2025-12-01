/**
 * Enhanced Graceful Data Wrapper
 * 
 * Integrates with progressive error recovery system to provide
 * intelligent loading states, error handling, and cache indicators.
 */

import React, { useState, useEffect } from 'react';
import { ProgressiveLoadingIndicator, LoadingSkeleton } from './progressive-loading-indicator';
import { ProgressiveErrorDisplay, CacheDataIndicator } from './progressive-error-display';
import { ErrorType } from '@/utils/circuitBreaker';
import { FallbackLevel, ErrorRecoveryResult } from '@/utils/progressiveErrorRecovery';
import { cn } from '@/lib/utils';

export interface EnhancedGracefulDataWrapperProps {
  children: React.ReactNode;
  /** Whether the query is currently loading */
  loading: boolean;
  /** Error message if query failed */
  error: string | null;
  /** Type of error for appropriate handling */
  errorType?: ErrorType | null;
  /** The data array */
  data: any[] | null;
  /** Whether data is stale but usable */
  isStale?: boolean;
  /** Whether circuit breaker is open */
  isCircuitBreakerOpen?: boolean;
  /** When data was last updated */
  lastUpdated?: Date | null;
  /** Error recovery result from progressive recovery */
  recoveryResult?: ErrorRecoveryResult | null;
  /** Whether this is a retry attempt */
  isRetrying?: boolean;
  /** Current retry attempt number */
  retryAttempt?: number;
  /** Loading duration in milliseconds */
  loadingDuration?: number;
  /** Context for loading messages */
  context?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Refresh callback */
  onRefresh?: () => void;
  /** Empty state configuration */
  emptyState?: {
    title?: string;
    description?: string;
    showRetry?: boolean;
  };
  /** Loading configuration */
  loadingConfig?: {
    showProgress?: boolean;
    skeletonType?: 'list' | 'card' | 'table' | 'form';
    skeletonCount?: number;
    customMessage?: string;
  };
  /** Whether to show cache indicators */
  showCacheIndicators?: boolean;
  /** Whether to show detailed error information */
  showErrorDetails?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function EnhancedGracefulDataWrapper({
  children,
  loading,
  error,
  errorType,
  data,
  isStale = false,
  isCircuitBreakerOpen = false,
  lastUpdated,
  recoveryResult,
  isRetrying = false,
  retryAttempt = 0,
  loadingDuration = 0,
  context = 'data',
  onRetry,
  onRefresh,
  emptyState,
  loadingConfig,
  showCacheIndicators = true,
  showErrorDetails = false,
  className
}: EnhancedGracefulDataWrapperProps) {
  const [showProgressiveLoading, setShowProgressiveLoading] = useState(false);
  
  const hasData = data && data.length > 0;
  const showingRecoveredData = recoveryResult?.success && hasData;
  const cacheAge = lastUpdated ? Date.now() - lastUpdated.getTime() : 0;

  // Show progressive loading for slow queries
  useEffect(() => {
    if (loading && loadingDuration > 3000) {
      setShowProgressiveLoading(true);
    } else {
      setShowProgressiveLoading(false);
    }
  }, [loading, loadingDuration]);

  // Determine cache indicator type
  const getCacheIndicatorType = (): 'stale' | 'expired' | 'offline' => {
    if (isCircuitBreakerOpen) return 'offline';
    if (recoveryResult?.level === FallbackLevel.CACHE_EXPIRED) return 'expired';
    return 'stale';
  };

  // Show loading state
  if (loading && !hasData) {
    if (showProgressiveLoading) {
      return (
        <div className={className}>
          <ProgressiveLoadingIndicator
            isLoading={loading}
            loadingDuration={loadingDuration}
            context={context}
            isRetrying={isRetrying}
            retryAttempt={retryAttempt}
            showProgress={loadingConfig?.showProgress}
            customMessage={loadingConfig?.customMessage}
          />
        </div>
      );
    }

    // Show skeleton loading for fast queries
    return (
      <div className={className}>
        <LoadingSkeleton
          type={loadingConfig?.skeletonType || 'list'}
          count={loadingConfig?.skeletonCount || 3}
        />
      </div>
    );
  }

  // Circuit breaker is open
  if (isCircuitBreakerOpen) {
    if (hasData) {
      return (
        <div className={className}>
          {showCacheIndicators && (
            <CacheDataIndicator
              show={true}
              cacheAge={cacheAge}
              cacheType="offline"
              position="top"
            />
          )}
          {children}
        </div>
      );
    } else {
      return (
        <div className={className}>
          <ProgressiveErrorDisplay
            error="Service temporarily unavailable due to connectivity issues"
            errorType={ErrorType.NETWORK_ERROR}
            recoveryLevel={FallbackLevel.GRACEFUL_DEGRADATION}
            retryable={true}
            onRetry={onRetry}
            isRetrying={isRetrying}
            context={context}
            showDetails={showErrorDetails}
          />
        </div>
      );
    }
  }

  // Error state with recovery
  if (error) {
    // Show recovered data if available
    if (showingRecoveredData) {
      return (
        <div className={className}>
          {/* Show recovery success indicator */}
          {recoveryResult && showCacheIndicators && (
            <CacheDataIndicator
              show={true}
              cacheAge={cacheAge}
              cacheType={getCacheIndicatorType()}
              position="top"
            />
          )}
          
          {/* Show subtle error notification */}
          {recoveryResult?.userMessage && (
            <div className="mb-4">
              <ProgressiveErrorDisplay
                error={recoveryResult.userMessage}
                errorType={errorType}
                recoveryLevel={recoveryResult.level}
                retryable={recoveryResult.retryable}
                retryDelay={recoveryResult.retryDelay}
                showingCachedData={true}
                cacheAge={cacheAge}
                onRetry={onRetry}
                isRetrying={isRetrying}
                context={context}
                showDetails={showErrorDetails}
              />
            </div>
          )}
          
          {children}
        </div>
      );
    }
    
    // Show error without recovered data
    return (
      <div className={className}>
        <ProgressiveErrorDisplay
          error={error}
          errorType={errorType}
          recoveryLevel={recoveryResult?.level}
          retryable={recoveryResult?.retryable ?? true}
          retryDelay={recoveryResult?.retryDelay}
          onRetry={onRetry}
          isRetrying={isRetrying}
          context={context}
          showDetails={showErrorDetails}
        />
      </div>
    );
  }

  // Stale data indicator
  if (isStale && hasData && showCacheIndicators) {
    return (
      <div className={className}>
        <CacheDataIndicator
          show={true}
          cacheAge={cacheAge}
          cacheType="stale"
          position="top"
        />
        {children}
      </div>
    );
  }

  // Empty state
  if (!hasData && !loading) {
    return (
      <div className={className}>
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium text-muted-foreground">
              {emptyState?.title || `No ${context} found`}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {emptyState?.description || `There are no ${context} to display at the moment.`}
            </p>
          </div>
          
          {emptyState?.showRetry !== false && onRetry && (
            <ProgressiveErrorDisplay
              error=""
              retryable={true}
              onRetry={onRetry}
              isRetrying={isRetrying}
              retryButtonText="Load Data"
              className="border-0 bg-transparent p-0"
            />
          )}
        </div>
      </div>
    );
  }

  // Normal state - show data
  return (
    <div className={className}>
      {children}
    </div>
  );
}

/**
 * Hook to manage enhanced graceful data wrapper state
 */
export function useEnhancedDataWrapper({
  loading,
  error,
  data,
  onRetry
}: {
  loading: boolean;
  error: string | null;
  data: any[] | null;
  onRetry?: () => void;
}) {
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [loadingDuration, setLoadingDuration] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Track loading duration
  useEffect(() => {
    if (loading && !loadingStartTime) {
      setLoadingStartTime(Date.now());
    } else if (!loading && loadingStartTime) {
      setLoadingStartTime(null);
      setLoadingDuration(0);
    }
  }, [loading, loadingStartTime]);

  // Update loading duration
  useEffect(() => {
    if (loading && loadingStartTime) {
      const interval = setInterval(() => {
        setLoadingDuration(Date.now() - loadingStartTime);
      }, 100);

      return () => clearInterval(interval);
    }
  }, [loading, loadingStartTime]);

  // Handle retry
  const handleRetry = async () => {
    if (!onRetry) return;
    
    setIsRetrying(true);
    setRetryAttempt(prev => prev + 1);
    
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  // Reset retry count on successful load
  useEffect(() => {
    if (!loading && !error && data) {
      setRetryAttempt(0);
    }
  }, [loading, error, data]);

  return {
    loadingDuration,
    retryAttempt,
    isRetrying,
    handleRetry
  };
}