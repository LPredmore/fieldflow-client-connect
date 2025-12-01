/**
 * Query Performance Dashboard Component
 * 
 * Comprehensive real-time performance monitoring dashboard that displays
 * query metrics, trends, alerts, and system health information.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  queryPerformanceMonitor, 
  AggregatedMetrics, 
  PerformanceAlert,
  PerformanceThresholds 
} from '@/utils/queryPerformanceMonitor';
import { 
  performanceMetricsAggregator, 
  SystemHealthMetrics,
  PerformanceComparison,
  MetricsTimeWindow 
} from '@/utils/performanceMetricsAggregator';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Database, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  Activity,
  Zap,
  Shield,
  Target,
  AlertTriangle,
  Info,
  Settings
} from 'lucide-react';

interface QueryPerformanceDashboardProps {
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function QueryPerformanceDashboard({ 
  className,
  autoRefresh = true,
  refreshInterval = 5000 
}: QueryPerformanceDashboardProps) {
  const [currentMetrics, setCurrentMetrics] = useState<AggregatedMetrics | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealthMetrics | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [comparison, setComparison] = useState<PerformanceComparison | null>(null);
  const [selectedTimeWindow, setSelectedTimeWindow] = useState<string>('last15Minutes');
  const [thresholds, setThresholds] = useState<PerformanceThresholds | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const timeWindows = useMemo(() => performanceMetricsAggregator.createTimeWindows(), []);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const timeWindow = timeWindows[selectedTimeWindow];
      if (!timeWindow) return;

      // Get current metrics
      const metrics = queryPerformanceMonitor.getAggregatedMetrics(timeWindow.duration);
      setCurrentMetrics(metrics);

      // Calculate system health
      const health = performanceMetricsAggregator.calculateSystemHealth(metrics);
      setSystemHealth(health);

      // Get recent alerts
      const recentAlerts = queryPerformanceMonitor.getAlerts(timeWindow.duration);
      setAlerts(recentAlerts);

      // Get performance comparison (current vs previous period)
      const previousTimeWindow = {
        ...timeWindow,
        start: timeWindow.start - timeWindow.duration,
        end: timeWindow.start
      };
      const previousMetrics = queryPerformanceMonitor.getAggregatedMetrics(timeWindow.duration);
      const performanceComparison = performanceMetricsAggregator.comparePerformance(metrics, previousMetrics);
      setComparison(performanceComparison);

      // Get current thresholds
      const currentThresholds = queryPerformanceMonitor.getThresholds();
      setThresholds(currentThresholds);

    } catch (error) {
      console.error('Error refreshing performance data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedTimeWindow, timeWindows]);

  useEffect(() => {
    refreshData();
  }, [selectedTimeWindow, refreshData]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(refreshData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, refreshData]);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatPercentage = (value: number): string => {
    return `${Math.round(value * 100) / 100}%`;
  };

  const getHealthColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthBadgeVariant = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy': return 'default';
      case 'warning': return 'secondary';
      case 'critical': return 'destructive';
    }
  };

  const getAlertIcon = (severity: PerformanceAlert['severity']) => {
    switch (severity) {
      case 'CRITICAL': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'HIGH': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'MEDIUM': return <Info className="h-4 w-4 text-yellow-500" />;
      case 'LOW': return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTrendIcon = (trend: 'improving' | 'stable' | 'degrading') => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'degrading': return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'stable': return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  if (!currentMetrics || !systemHealth) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Database className="h-8 w-8 mx-auto mb-2 text-gray-400 animate-pulse" />
          <p className="text-gray-500">Loading performance metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Query Performance Dashboard</h2>
          <p className="text-gray-600">Real-time monitoring and analysis of database query performance</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedTimeWindow}
            onChange={(e) => setSelectedTimeWindow(e.target.value)}
            className="px-3 py-1 border rounded-md text-sm"
          >
            {Object.entries(timeWindows).map(([key, window]) => (
              <option key={key} value={key}>{window.label}</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            System Health Score
            <Badge className={getHealthColor(systemHealth.healthScore)}>
              {Math.round(systemHealth.healthScore)}/100
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(systemHealth.components).map(([component, data]) => (
              <div key={component} className="text-center">
                <div className="mb-2">
                  <Badge variant={getHealthBadgeVariant(data.status)} className="mb-1">
                    {component}
                  </Badge>
                  <div className={`text-lg font-bold ${getHealthColor(data.score)}`}>
                    {Math.round(data.score)}
                  </div>
                </div>
                <Progress value={data.score} className="h-2" />
                {data.issues.length > 0 && (
                  <p className="text-xs text-red-600 mt-1">{data.issues[0]}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH').length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Performance Alerts</AlertTitle>
          <AlertDescription>
            <div className="space-y-2 mt-2">
              {alerts
                .filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH')
                .slice(0, 3)
                .map((alert, index) => (
                  <div key={index} className="flex items-start gap-2">
                    {getAlertIcon(alert.severity)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs text-gray-600">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Query Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(currentMetrics.averageQueryTime)}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getTrendIcon(currentMetrics.performanceTrend)}
              <span>{currentMetrics.performanceTrend}</span>
              {comparison && (
                <span className={comparison.changes.averageQueryTime > 0 ? 'text-red-500' : 'text-green-500'}>
                  ({comparison.changes.averageQueryTime > 0 ? '+' : ''}{Math.round(comparison.changes.averageQueryTime)}%)
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(currentMetrics.cacheHitRate)}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Target className="h-3 w-3" />
              <span>Target: {thresholds ? formatPercentage(thresholds.minCacheHitRate) : 'N/A'}</span>
              {comparison && (
                <span className={comparison.changes.cacheHitRate > 0 ? 'text-green-500' : 'text-red-500'}>
                  ({comparison.changes.cacheHitRate > 0 ? '+' : ''}{Math.round(comparison.changes.cacheHitRate)}%)
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(currentMetrics.errorRate)}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{currentMetrics.totalQueries - Math.round(currentMetrics.totalQueries * currentMetrics.errorRate / 100)} successful</span>
              {comparison && (
                <span className={comparison.changes.errorRate > 0 ? 'text-red-500' : 'text-green-500'}>
                  ({comparison.changes.errorRate > 0 ? '+' : ''}{Math.round(comparison.changes.errorRate)}%)
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentMetrics.totalQueries.toLocaleString()}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Deduplication: {formatPercentage(currentMetrics.deduplicationSavings)} saved</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
                <CardDescription>Key metrics for {timeWindows[selectedTimeWindow]?.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Average Query Time</span>
                    <div className="text-right">
                      <div className="font-medium">{formatDuration(currentMetrics.averageQueryTime)}</div>
                      <Progress 
                        value={Math.min(100, (currentMetrics.averageQueryTime / (thresholds?.maxQueryTime || 2000)) * 100)} 
                        className="w-20 h-2 mt-1"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Cache Hit Rate</span>
                    <div className="text-right">
                      <div className="font-medium">{formatPercentage(currentMetrics.cacheHitRate)}</div>
                      <Progress value={currentMetrics.cacheHitRate} className="w-20 h-2 mt-1" />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Error Rate</span>
                    <div className="text-right">
                      <div className="font-medium">{formatPercentage(currentMetrics.errorRate)}</div>
                      <Progress 
                        value={Math.min(100, currentMetrics.errorRate * 10)} 
                        className="w-20 h-2 mt-1"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Slow Queries</span>
                    <div className="text-right">
                      <div className="font-medium">{currentMetrics.slowQueryCount}</div>
                      <div className="text-xs text-gray-500">
                        {formatPercentage((currentMetrics.slowQueryCount / Math.max(1, currentMetrics.totalQueries)) * 100)} of total
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>Suggested actions to improve performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {systemHealth.recommendations.map((rec, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'secondary' : 'outline'}>
                            {rec.priority}
                          </Badge>
                          <Badge variant="outline">{rec.effort} effort</Badge>
                        </div>
                        <p className="text-sm font-medium mb-1">{rec.action}</p>
                        <p className="text-xs text-gray-600">{rec.impact}</p>
                      </div>
                    ))}
                    {systemHealth.recommendations.length === 0 && (
                      <div className="text-center py-8">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <p className="text-gray-500">No recommendations at this time</p>
                        <p className="text-xs text-gray-400">System is performing well</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tables" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Table Performance Breakdown</CardTitle>
              <CardDescription>Performance metrics by database table</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {Object.entries(currentMetrics.tableMetrics).map(([table, metrics]) => (
                    <div key={table} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{table}</Badge>
                          <span className="text-sm text-gray-600">{metrics.queryCount} queries</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatDuration(metrics.averageTime)}</div>
                          <div className="text-xs text-gray-500">avg time</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-gray-500">Cache Hit Rate</div>
                          <div className="font-medium">{formatPercentage(metrics.cacheHitRate)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Error Rate</div>
                          <div className="font-medium">{formatPercentage(metrics.errorRate)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Max Time</div>
                          <div className="font-medium">{formatDuration(metrics.maxTime)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {Object.keys(currentMetrics.tableMetrics).length === 0 && (
                    <p className="text-center text-gray-500 py-8">No table metrics available</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Alerts</CardTitle>
              <CardDescription>Recent performance issues and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {alerts.map((alert, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-start gap-3">
                        {getAlertIcon(alert.severity)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={alert.severity === 'CRITICAL' ? 'destructive' : 'secondary'}>
                              {alert.severity}
                            </Badge>
                            <Badge variant="outline">{alert.type}</Badge>
                            {alert.target && <Badge variant="outline">{alert.target}</Badge>}
                          </div>
                          <p className="text-sm font-medium mb-1">{alert.message}</p>
                          <p className="text-xs text-gray-500 mb-2">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                          {alert.suggestions.length > 0 && (
                            <div className="text-xs">
                              <p className="font-medium mb-1">Suggestions:</p>
                              <ul className="list-disc list-inside space-y-1 text-gray-600">
                                {alert.suggestions.slice(0, 2).map((suggestion, i) => (
                                  <li key={i}>{suggestion}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-gray-500">No alerts in this time period</p>
                      <p className="text-xs text-gray-400">System is running smoothly</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>Historical performance analysis and comparisons</CardDescription>
            </CardHeader>
            <CardContent>
              {comparison && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Current Period</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Avg Query Time:</span>
                          <span>{formatDuration(comparison.current.averageQueryTime)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cache Hit Rate:</span>
                          <span>{formatPercentage(comparison.current.cacheHitRate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Error Rate:</span>
                          <span>{formatPercentage(comparison.current.errorRate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Queries:</span>
                          <span>{comparison.current.totalQueries}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Previous Period</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Avg Query Time:</span>
                          <span>{formatDuration(comparison.previous.averageQueryTime)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cache Hit Rate:</span>
                          <span>{formatPercentage(comparison.previous.cacheHitRate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Error Rate:</span>
                          <span>{formatPercentage(comparison.previous.errorRate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Queries:</span>
                          <span>{comparison.previous.totalQueries}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Changes</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="text-center">
                        <div className={`text-lg font-bold ${comparison.changes.averageQueryTime > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {comparison.changes.averageQueryTime > 0 ? '+' : ''}{Math.round(comparison.changes.averageQueryTime)}%
                        </div>
                        <div className="text-xs text-gray-500">Query Time</div>
                        <Badge variant="outline" className="text-xs mt-1">
                          {comparison.significance.averageQueryTime}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-bold ${comparison.changes.cacheHitRate > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {comparison.changes.cacheHitRate > 0 ? '+' : ''}{Math.round(comparison.changes.cacheHitRate)}%
                        </div>
                        <div className="text-xs text-gray-500">Cache Hit Rate</div>
                        <Badge variant="outline" className="text-xs mt-1">
                          {comparison.significance.cacheHitRate}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-bold ${comparison.changes.errorRate > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {comparison.changes.errorRate > 0 ? '+' : ''}{Math.round(comparison.changes.errorRate)}%
                        </div>
                        <div className="text-xs text-gray-500">Error Rate</div>
                        <Badge variant="outline" className="text-xs mt-1">
                          {comparison.significance.errorRate}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-bold ${comparison.changes.totalQueries > 0 ? 'text-blue-500' : 'text-gray-500'}`}>
                          {comparison.changes.totalQueries > 0 ? '+' : ''}{Math.round(comparison.changes.totalQueries)}%
                        </div>
                        <div className="text-xs text-gray-500">Total Queries</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Performance Thresholds
              </CardTitle>
              <CardDescription>Configure alerting thresholds and monitoring settings</CardDescription>
            </CardHeader>
            <CardContent>
              {thresholds && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Max Query Time (ms)</label>
                      <div className="text-lg font-mono">{thresholds.maxQueryTime}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Min Cache Hit Rate (%)</label>
                      <div className="text-lg font-mono">{thresholds.minCacheHitRate}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Max Error Rate (%)</label>
                      <div className="text-lg font-mono">{thresholds.maxErrorRate}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Max Circuit Breaker Activations</label>
                      <div className="text-lg font-mono">{thresholds.maxCircuitBreakerActivations}</div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <p className="text-sm text-gray-600">
                      Thresholds are used to trigger performance alerts and determine system health scores.
                      Contact your system administrator to modify these values.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}