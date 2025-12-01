import React from 'react';
import { Clock, Wifi, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CachedDataIndicatorProps {
  isStale?: boolean;
  isOffline?: boolean;
  lastUpdated?: Date;
  onRefresh?: () => void;
  className?: string;
  compact?: boolean;
}

export function CachedDataIndicator({ 
  isStale = false,
  isOffline = false,
  lastUpdated,
  onRefresh,
  className,
  compact = false
}: CachedDataIndicatorProps) {
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

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50",
        className
      )}>
        {isOffline ? (
          <Wifi className="h-3 w-3 text-muted-foreground" />
        ) : (
          <Clock className="h-3 w-3 text-muted-foreground" />
        )}
        <span className="text-xs text-muted-foreground">
          {isOffline ? 'Offline data' : 'Cached data'}
          {lastUpdated && ` • ${getTimeAgo(lastUpdated)}`}
        </span>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="h-5 w-5 p-0"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20",
      className
    )}>
      <div className="flex items-center gap-3">
        {isOffline ? (
          <Wifi className="h-5 w-5 text-warning" />
        ) : (
          <Clock className="h-5 w-5 text-warning" />
        )}
        <div>
          <p className="text-sm font-medium text-warning">
            {isOffline ? 'Showing offline data' : 'Showing cached data'}
          </p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground">
              Last updated {getTimeAgo(lastUpdated)}
            </p>
          )}
        </div>
      </div>
      {onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      )}
    </div>
  );
}