import React from 'react';
import { 
  Briefcase, 
  Wifi, 
  RefreshCw, 
  AlertTriangle, 
  Database,
  Clock,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ErrorType } from '@/utils/circuitBreaker';

interface EnhancedEmptyStateProps {
  type: 'empty' | 'error' | 'circuit_breaker' | 'stale_data';
  title?: string;
  description?: string;
  error?: string;
  errorType?: ErrorType;
  onRetry?: () => void;
  onRefresh?: () => void;
  showRetry?: boolean;
  className?: string;
  compact?: boolean;
  lastUpdated?: Date;
  cachedDataCount?: number;
}

const getStateIcon = (type: string, errorType?: ErrorType) => {
  switch (type) {
    case 'circuit_breaker':
      return Wifi;
    case 'stale_data':
      return Clock;
    case 'error':
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
    default:
      return Briefcase;
  }
};

const getStateTitle = (type: string, errorType?: ErrorType, title?: string) => {
  if (title) return title;
  
  switch (type) {
    case 'circuit_breaker':
      return 'Service Temporarily Unavailable';
    case 'stale_data':
      return 'Showing Cached Data';
    case 'error':
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
    default:
      return 'No data available';
  }
};

const getStateDescription = (
  type: string, 
  errorType?: ErrorType, 
  description?: string,
  lastUpdated?: Date,
  cachedDataCount?: number
) => {
  if (description) return description;
  
  const timeAgo = lastUpdated ? getTimeAgo(lastUpdated) : null;
  
  switch (type) {
    case 'circuit_breaker':
      return cachedDataCount && cachedDataCount > 0
        ? `We're experiencing connectivity issues. Showing ${cachedDataCount} cached items${timeAgo ? ` from ${timeAgo}` : ''}.`
        : 'We\'re experiencing connectivity issues. Please try again in a moment.';
    case 'stale_data':
      return `Data may be outdated${timeAgo ? ` (last updated ${timeAgo})` : ''}. Refresh to get the latest information.`;
    case 'error':
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
          return 'An unexpected error occurred. Please try again.';
      }
    default:
      return 'No items to display yet.';
  }
};

const getTimeAgo = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export function EnhancedEmptyState({
  type,
  title,
  description,
  error,
  errorType,
  onRetry,
  onRefresh,
  showRetry = true,
  className,
  compact = false,
  lastUpdated,
  cachedDataCount
}: EnhancedEmptyStateProps) {
  const Icon = getStateIcon(type, errorType);
  const stateTitle = getStateTitle(type, errorType, title);
  const stateDescription = getStateDescription(type, errorType, description, lastUpdated, cachedDataCount);

  const getStateColor = () => {
    switch (type) {
      case 'circuit_breaker':
        return 'text-warning';
      case 'stale_data':
        return 'text-warning';
      case 'error':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'circuit_breaker':
        return 'border-warning/20';
      case 'stale_data':
        return 'border-warning/20';
      case 'error':
        return 'border-destructive/20';
      default:
        return 'border-border';
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'circuit_breaker':
        return 'bg-warning/5';
      case 'stale_data':
        return 'bg-warning/5';
      case 'error':
        return 'bg-destructive/5';
      default:
        return 'bg-background';
    }
  };

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-lg border",
        getBorderColor(),
        getBackgroundColor(),
        className
      )}>
        <Icon className={cn("h-5 w-5 flex-shrink-0", getStateColor())} />
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium", getStateColor())}>{stateTitle}</p>
          <p className="text-xs text-muted-foreground truncate">{stateDescription}</p>
        </div>
        {showRetry && (onRetry || onRefresh) && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry || onRefresh}
            className="flex-shrink-0"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            {type === 'stale_data' ? 'Refresh' : 'Retry'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("border", getBorderColor(), className)}>
      <CardContent className={cn(
        "flex flex-col items-center justify-center py-8 px-4 text-center",
        getBackgroundColor()
      )}>
        <Icon className={cn("h-12 w-12 mb-4", getStateColor())} />
        <h3 className={cn("text-lg font-medium mb-2", getStateColor())}>
          {stateTitle}
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          {stateDescription}
        </p>
        {showRetry && (onRetry || onRefresh) && (
          <Button 
            onClick={onRetry || onRefresh} 
            variant={type === 'error' ? 'outline' : 'default'}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {type === 'stale_data' ? 'Refresh Data' : 'Try Again'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}