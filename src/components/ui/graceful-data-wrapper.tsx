import React from 'react';
import { EnhancedEmptyState } from './enhanced-empty-state';
import { CachedDataIndicator } from './cached-data-indicator';
import { ErrorType } from '@/types/errorTypes';

interface GracefulDataWrapperProps {
  children: React.ReactNode;
  loading: boolean;
  error: string | null;
  errorType?: ErrorType | null;
  data: any[] | null;
  isStale?: boolean;
  isCircuitBreakerOpen?: boolean;
  lastUpdated?: Date | null;
  onRetry?: () => void;
  onRefresh?: () => void;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  loadingComponent?: React.ReactNode;
  showCachedIndicator?: boolean;
  className?: string;
}

export function GracefulDataWrapper({
  children,
  loading,
  error,
  errorType,
  data,
  isStale = false,
  isCircuitBreakerOpen = false,
  lastUpdated,
  onRetry,
  onRefresh,
  emptyStateTitle,
  emptyStateDescription,
  loadingComponent,
  showCachedIndicator = true,
  className
}: GracefulDataWrapperProps) {
  const hasData = data && data.length > 0;
  const showStaleIndicator = showCachedIndicator && (isStale || isCircuitBreakerOpen) && hasData;

  // Show loading state only if we don't have any data to display
  if (loading && !hasData) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    
    // Default loading skeleton
    return (
      <div className={className}>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-border rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Circuit breaker is open - show cached data if available, otherwise show error
  if (isCircuitBreakerOpen) {
    if (hasData) {
      return (
        <div className={className}>
          {showStaleIndicator && (
            <div className="mb-4">
              <CachedDataIndicator
                isOffline={true}
                lastUpdated={lastUpdated}
                onRefresh={onRefresh}
              />
            </div>
          )}
          {children}
        </div>
      );
    } else {
      return (
        <div className={className}>
          <EnhancedEmptyState
            type="circuit_breaker"
            title="Service Temporarily Unavailable"
            description="We're experiencing connectivity issues. Please try again in a moment."
            onRetry={onRetry}
            lastUpdated={lastUpdated}
          />
        </div>
      );
    }
  }

  // Error state - show cached data if available, otherwise show error
  if (error) {
    if (hasData) {
      return (
        <div className={className}>
          {showStaleIndicator && (
            <div className="mb-4">
              <CachedDataIndicator
                isStale={true}
                lastUpdated={lastUpdated}
                onRefresh={onRefresh}
              />
            </div>
          )}
          {children}
        </div>
      );
    } else {
      return (
        <div className={className}>
          <EnhancedEmptyState
            type="error"
            error={error}
            errorType={errorType}
            onRetry={onRetry}
          />
        </div>
      );
    }
  }

  // Stale data - show data with indicator
  if (isStale && hasData) {
    return (
      <div className={className}>
        {showStaleIndicator && (
          <div className="mb-4">
            <CachedDataIndicator
              isStale={true}
              lastUpdated={lastUpdated}
              onRefresh={onRefresh}
            />
          </div>
        )}
        {children}
      </div>
    );
  }

  // No data - show empty state
  if (!hasData && !loading) {
    return (
      <div className={className}>
        <EnhancedEmptyState
          type="empty"
          title={emptyStateTitle}
          description={emptyStateDescription}
          onRetry={onRetry}
        />
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