/**
 * Stale Data Indicator
 * 
 * Visual indicators for cached/stale data with:
 * - Timestamp display
 * - Age calculation
 * - Refresh button
 * - Visual styling based on staleness
 */

import React from 'react';
import { Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StaleDataIndicatorProps {
  lastUpdated: Date | null;
  isStale?: boolean;
  isFetching?: boolean;
  onRefresh?: () => void;
  staleThreshold?: number; // milliseconds
  variant?: 'badge' | 'inline' | 'banner';
  showRefreshButton?: boolean;
}

export const StaleDataIndicator: React.FC<StaleDataIndicatorProps> = ({
  lastUpdated,
  isStale = false,
  isFetching = false,
  onRefresh,
  staleThreshold = 3600000, // 1 hour default
  variant = 'inline',
  showRefreshButton = true
}) => {
  if (!lastUpdated) {
    return null;
  }

  const now = Date.now();
  const age = now - lastUpdated.getTime();
  const isVeryStale = age > staleThreshold;

  const formatAge = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleString();
  };

  if (variant === 'badge') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={isVeryStale ? 'destructive' : isStale ? 'secondary' : 'outline'}
              className="cursor-help"
            >
              <Clock className="h-3 w-3 mr-1" />
              {formatAge(age)}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Last synced: {formatTimestamp(lastUpdated)}</p>
            {isStale && <p className="text-xs text-yellow-600 mt-1">Data may be outdated</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'banner') {
    if (!isStale && !isVeryStale) {
      return null; // Don't show banner for fresh data
    }

    return (
      <div
        className={`
          flex items-center justify-between px-4 py-2 rounded-lg border
          ${isVeryStale
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
          }
        `}
      >
        <div className="flex items-center gap-2">
          <AlertCircle
            className={`h-4 w-4 ${
              isVeryStale
                ? 'text-red-600 dark:text-red-400'
                : 'text-yellow-600 dark:text-yellow-400'
            }`}
          />
          <div>
            <p
              className={`text-sm font-medium ${
                isVeryStale
                  ? 'text-red-900 dark:text-red-200'
                  : 'text-yellow-900 dark:text-yellow-200'
              }`}
            >
              {isVeryStale ? 'Data is outdated' : 'Showing cached data'}
            </p>
            <p
              className={`text-xs ${
                isVeryStale
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-yellow-700 dark:text-yellow-300'
              }`}
            >
              Last synced {formatAge(age)} at {formatTimestamp(lastUpdated)}
            </p>
          </div>
        </div>
        {showRefreshButton && onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            className="ml-4"
          >
            <RefreshCw className={`h-3 w-3 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        )}
      </div>
    );
  }

  // Default: inline variant
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="h-4 w-4" />
      <span>
        Last synced {formatAge(age)}
        {isStale && (
          <span className="text-yellow-600 dark:text-yellow-400 ml-1">(may be outdated)</span>
        )}
      </span>
      {showRefreshButton && onRefresh && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
          className="h-6 px-2"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      )}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground">
              <AlertCircle className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Last synced: {formatTimestamp(lastUpdated)}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

/**
 * Data Table with Stale Indicator
 * 
 * Wrapper component for data tables with built-in stale indicator
 */
interface DataTableWithStaleIndicatorProps {
  children: React.ReactNode;
  lastUpdated: Date | null;
  isStale?: boolean;
  isFetching?: boolean;
  onRefresh?: () => void;
  title?: string;
}

export const DataTableWithStaleIndicator: React.FC<DataTableWithStaleIndicatorProps> = ({
  children,
  lastUpdated,
  isStale,
  isFetching,
  onRefresh,
  title
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {title && <h2 className="text-2xl font-bold">{title}</h2>}
        {lastUpdated && (
          <StaleDataIndicator
            lastUpdated={lastUpdated}
            isStale={isStale}
            isFetching={isFetching}
            onRefresh={onRefresh}
            variant="inline"
          />
        )}
      </div>
      {isStale && (
        <StaleDataIndicator
          lastUpdated={lastUpdated}
          isStale={isStale}
          isFetching={isFetching}
          onRefresh={onRefresh}
          variant="banner"
        />
      )}
      {children}
    </div>
  );
};

/**
 * Stale Data Badge
 * 
 * Simple badge for showing data age
 */
interface StaleDataBadgeProps {
  lastUpdated: Date | null;
  threshold?: number;
}

export const StaleDataBadge: React.FC<StaleDataBadgeProps> = ({
  lastUpdated,
  threshold = 3600000 // 1 hour
}) => {
  if (!lastUpdated) {
    return null;
  }

  const age = Date.now() - lastUpdated.getTime();
  const isStale = age > threshold;

  if (!isStale) {
    return null;
  }

  return (
    <StaleDataIndicator
      lastUpdated={lastUpdated}
      isStale={isStale}
      variant="badge"
      showRefreshButton={false}
    />
  );
};
