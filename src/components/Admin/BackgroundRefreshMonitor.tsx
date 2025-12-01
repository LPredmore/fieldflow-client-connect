/**
 * Background Refresh Monitor Component
 * 
 * Provides UI for monitoring and controlling the background refresh system
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, 
  Play, 
  Pause, 
  Settings, 
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { 
  useBackgroundRefreshManager,
  RefreshSchedule,
  RefreshMetrics,
  globalBackgroundRefreshManager
} from '@/utils/enhancedBackgroundRefresh';
import { formatDistanceToNow } from 'date-fns';

export function BackgroundRefreshMonitor() {
  const { manager, metrics, scheduleRefresh, setRefreshSchedule, refreshStaleEntries } = useBackgroundRefreshManager();
  const [schedules, setSchedules] = useState<RefreshSchedule[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Update schedules periodically
  useEffect(() => {
    const updateSchedules = () => {
      setSchedules(manager.getAllRefreshSchedules());
    };
    
    updateSchedules();
    const interval = setInterval(updateSchedules, 2000);
    
    return () => clearInterval(interval);
  }, [manager]);
  
  const handleToggleSchedule = (table: string, enabled: boolean) => {
    const schedule = schedules.find(s => s.table === table);
    if (schedule) {
      setRefreshSchedule({
        ...schedule,
        enabled
      });
    }
  };
  
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      refreshStaleEntries();
      // Wait a bit for the refresh to start
      setTimeout(() => setIsRefreshing(false), 2000);
    } catch (error) {
      console.error('Manual refresh failed:', error);
      setIsRefreshing(false);
    }
  };
  
  const getStatusColor = (schedule: RefreshSchedule) => {
    if (!schedule.enabled) return 'secondary';
    
    const now = Date.now();
    if (schedule.nextRefresh && now >= schedule.nextRefresh) {
      return 'destructive'; // Overdue
    }
    
    return 'default';
  };
  
  const getStatusText = (schedule: RefreshSchedule) => {
    if (!schedule.enabled) return 'Disabled';
    
    const now = Date.now();
    if (schedule.nextRefresh) {
      if (now >= schedule.nextRefresh) {
        return 'Overdue';
      }
      return `Next: ${formatDistanceToNow(new Date(schedule.nextRefresh), { addSuffix: true })}`;
    }
    
    return 'Scheduled';
  };
  
  const formatInterval = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };
  
  const successRate = metrics ? 
    (metrics.totalRefreshes > 0 ? (metrics.successfulRefreshes / metrics.totalRefreshes) * 100 : 0) : 0;
  
  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Refreshes</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalRefreshes || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.successfulRefreshes || 0} successful
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
            <Progress value={successRate} className="mt-2" />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.queueStatus.pending || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.queueStatus.active || 0} active
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.averageRefreshTime ? `${Math.round(metrics.averageRefreshTime)}ms` : '0ms'}
            </div>
            <p className="text-xs text-muted-foreground">
              Per refresh
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Background Refresh Controls
          </CardTitle>
          <CardDescription>
            Manage background refresh operations for cached data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button 
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Stale Entries'}
            </Button>
            
            <Badge variant={metrics?.queueStatus.processing ? 'default' : 'secondary'}>
              {metrics?.queueStatus.processing ? 'Processing' : 'Idle'}
            </Badge>
          </div>
        </CardContent>
      </Card>
      
      {/* Refresh Schedules */}
      <Card>
        <CardHeader>
          <CardTitle>Refresh Schedules</CardTitle>
          <CardDescription>
            Configure automatic background refresh for different tables
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {schedules.map((schedule) => (
              <div key={schedule.table} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium capitalize">{schedule.table}</h4>
                    <Badge variant={getStatusColor(schedule)}>
                      {getStatusText(schedule)}
                    </Badge>
                    <Badge variant="outline">
                      Priority: {schedule.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Interval: {formatInterval(schedule.interval)}
                    {schedule.lastRefresh && (
                      <span className="ml-4">
                        Last: {formatDistanceToNow(new Date(schedule.lastRefresh), { addSuffix: true })}
                      </span>
                    )}
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  {metrics?.tableMetrics[schedule.table] && (
                    <div className="text-right text-sm">
                      <div className="font-medium">
                        {metrics.tableMetrics[schedule.table].refreshCount} refreshes
                      </div>
                      <div className="text-muted-foreground">
                        {(metrics.tableMetrics[schedule.table].successRate * 100).toFixed(1)}% success
                      </div>
                    </div>
                  )}
                  
                  <Switch
                    checked={schedule.enabled}
                    onCheckedChange={(enabled) => handleToggleSchedule(schedule.table, enabled)}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Table Metrics */}
      {metrics?.tableMetrics && Object.keys(metrics.tableMetrics).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Table Refresh Metrics</CardTitle>
            <CardDescription>
              Detailed performance metrics for each table
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.values(metrics.tableMetrics).map((tableMetric) => (
                <div key={tableMetric.table} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="capitalize font-medium">{tableMetric.table}</div>
                    {tableMetric.successRate >= 0.9 ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : tableMetric.successRate >= 0.7 ? (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="font-medium">{tableMetric.refreshCount}</div>
                      <div className="text-muted-foreground">Refreshes</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="font-medium">{(tableMetric.successRate * 100).toFixed(1)}%</div>
                      <div className="text-muted-foreground">Success</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="font-medium">{Math.round(tableMetric.averageTime)}ms</div>
                      <div className="text-muted-foreground">Avg Time</div>
                    </div>
                    
                    {tableMetric.nextScheduled && (
                      <div className="text-center">
                        <div className="font-medium">
                          {formatDistanceToNow(new Date(tableMetric.nextScheduled), { addSuffix: true })}
                        </div>
                        <div className="text-muted-foreground">Next</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}