/**
 * Query Monitoring Dashboard Component
 * 
 * Displays comprehensive query performance metrics and logs
 * for debugging and monitoring database query performance.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { queryLogger, QueryMetrics, QueryLogEntry } from '@/utils/queryLogger';
import { AlertCircle, CheckCircle, Clock, Database, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

interface QueryMonitoringDashboardProps {
  className?: string;
}

export function QueryMonitoringDashboard({ className }: QueryMonitoringDashboardProps) {
  const [metrics, setMetrics] = useState<QueryMetrics | null>(null);
  const [logs, setLogs] = useState<QueryLogEntry[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refreshData = () => {
    setMetrics(queryLogger.getMetrics());
    setLogs(queryLogger.getLogs(50));
  };

  useEffect(() => {
    refreshData();
    
    if (autoRefresh) {
      const interval = setInterval(refreshData, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'complex': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getErrorTypeColor = (errorType: string) => {
    switch (errorType) {
      case 'schema_mismatch': return 'bg-red-100 text-red-800';
      case 'network_error': return 'bg-orange-100 text-orange-800';
      case 'permission_error': return 'bg-purple-100 text-purple-800';
      case 'timeout_error': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!metrics) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Database className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-500">Loading query metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Query Monitoring Dashboard</h2>
          <p className="text-gray-600">Real-time database query performance and monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto Refresh On' : 'Auto Refresh Off'}
          </Button>
          <Button variant="outline" size="sm" onClick={refreshData}>
            Refresh Now
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => queryLogger.clearLogs()}
            className="text-red-600 hover:text-red-700"
          >
            Clear Logs
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalQueries}</div>
            <p className="text-xs text-muted-foreground">
              Last 5 minutes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.totalQueries > 0 
                ? Math.round((metrics.successfulQueries / metrics.totalQueries) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.successfulQueries} / {metrics.totalQueries} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(metrics.averageResponseTime)}</div>
            <p className="text-xs text-muted-foreground">
              Average query duration
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(metrics.cacheHitRate * 100)}%</div>
            <p className="text-xs text-muted-foreground">
              Queries served from cache
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Circuit Breaker Status */}
      {metrics.circuitBreakerActivations > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Circuit Breaker Activations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700">
              Circuit breaker has been activated {metrics.circuitBreakerActivations} times in the last 5 minutes.
              This indicates repeated query failures that may require attention.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Detailed Tabs */}
      <Tabs defaultValue="recent" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="recent">Recent Queries</TabsTrigger>
          <TabsTrigger value="slow">Slow Queries</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Query Activity</CardTitle>
              <CardDescription>Last 50 database queries with performance details</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{log.table}</Badge>
                          <Badge className={getComplexityColor(log.queryComplexity)}>
                            {log.queryComplexity}
                          </Badge>
                          {log.cacheHit && <Badge variant="secondary">cached</Badge>}
                          {log.circuitBreakerOpen && <Badge variant="destructive">circuit open</Badge>}
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          {log.select.length > 60 ? `${log.select.substring(0, 60)}...` : log.select}
                        </p>
                        <p className="text-xs text-gray-500">
                          {log.timestamp.toLocaleTimeString()} • 
                          {Object.keys(log.filters).length} filters • 
                          {log.resultCount !== undefined ? `${log.resultCount} results` : 'no results'}
                        </p>
                      </div>
                      <div className="text-right">
                        {log.success ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {log.duration ? formatDuration(log.duration) : 'N/A'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Failed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Slow Queries</CardTitle>
              <CardDescription>Queries taking longer than 2 seconds to complete</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {metrics.slowQueries.map((log) => (
                    <div key={log.id} className="p-3 border rounded-lg bg-yellow-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{log.table}</Badge>
                          <Badge className={getComplexityColor(log.queryComplexity)}>
                            {log.queryComplexity}
                          </Badge>
                          <Badge variant="destructive">
                            {formatDuration(log.duration || 0)}
                          </Badge>
                        </div>
                        <span className="text-sm text-gray-500">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-1">
                        Select: {log.select}
                      </p>
                      <p className="text-xs text-gray-600">
                        Filters: {JSON.stringify(log.filters)} • 
                        Results: {log.resultCount || 0}
                      </p>
                      {log.performanceMetrics.networkTime && (
                        <p className="text-xs text-gray-500 mt-1">
                          Network: {formatDuration(log.performanceMetrics.networkTime)} • 
                          Processing: {formatDuration(log.performanceMetrics.processingTime || 0)}
                        </p>
                      )}
                    </div>
                  ))}
                  {metrics.slowQueries.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No slow queries detected</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>Failed queries with error details</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {metrics.recentErrors.map((log) => (
                    <div key={log.id} className="p-3 border rounded-lg bg-red-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{log.table}</Badge>
                          {log.error && (
                            <Badge className={getErrorTypeColor(log.error.type)}>
                              {log.error.type}
                            </Badge>
                          )}
                          {log.retryCount && log.retryCount > 0 && (
                            <Badge variant="secondary">
                              {log.retryCount} retries
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-red-700 mb-1">
                        {log.error?.message || 'Unknown error'}
                      </p>
                      <p className="text-xs text-gray-600">
                        Table: {log.table} • Duration: {formatDuration(log.duration || 0)}
                      </p>
                      {log.error?.code && (
                        <p className="text-xs text-gray-500 mt-1">
                          Code: {log.error.code}
                        </p>
                      )}
                    </div>
                  ))}
                  {metrics.recentErrors.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No recent errors</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Error Breakdown</CardTitle>
                <CardDescription>Errors by type in the last 5 minutes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(metrics.errorsByType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <Badge className={getErrorTypeColor(type)}>{type}</Badge>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                  {Object.keys(metrics.errorsByType).length === 0 && (
                    <p className="text-center text-gray-500 py-4">No errors in this period</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Queries:</span>
                    <span className="font-medium">{metrics.totalQueries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Successful:</span>
                    <span className="font-medium text-green-600">{metrics.successfulQueries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Failed:</span>
                    <span className="font-medium text-red-600">{metrics.failedQueries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Response:</span>
                    <span className="font-medium">{formatDuration(metrics.averageResponseTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Cache Hit Rate:</span>
                    <span className="font-medium">{Math.round(metrics.cacheHitRate * 100)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Circuit Breaker:</span>
                    <span className="font-medium">
                      {metrics.circuitBreakerActivations > 0 ? (
                        <span className="text-orange-600">{metrics.circuitBreakerActivations} activations</span>
                      ) : (
                        <span className="text-green-600">Stable</span>
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}