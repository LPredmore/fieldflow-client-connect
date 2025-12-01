import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { usePolicyPerformanceMetrics } from '@/utils/policyPerformanceMonitor';
import { AlertTriangle, Clock, Database, TrendingUp } from 'lucide-react';

/**
 * Dashboard component for monitoring RLS policy performance
 * Displays real-time metrics, alerts, and performance trends
 */
export function PolicyPerformanceDashboard() {
  const metrics = usePolicyPerformanceMetrics();

  const getSeverityColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'destructive';
    if (value >= thresholds.warning) return 'secondary';
    return 'default';
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Policy Performance Dashboard</h2>
        <Badge variant="outline" className="text-sm">
          Last updated: {new Date().toLocaleTimeString()}
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalExecutions}</div>
            <p className="text-xs text-muted-foreground">Last hour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Execution Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.averageExecutionTime}ms</div>
            <Badge 
              variant={getSeverityColor(metrics.averageExecutionTime, { warning: 1000, critical: 2000 })}
              className="text-xs mt-1"
            >
              {metrics.averageExecutionTime > 2000 ? 'Critical' : 
               metrics.averageExecutionTime > 1000 ? 'Warning' : 'Good'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.errorRate}%</div>
            <Badge 
              variant={getSeverityColor(metrics.errorRate, { warning: 5, critical: 10 })}
              className="text-xs mt-1"
            >
              {metrics.errorRate > 10 ? 'Critical' : 
               metrics.errorRate > 5 ? 'Warning' : 'Good'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Slow Queries</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.slowQueries}</div>
            <p className="text-xs text-muted-foreground">&gt; 2 seconds</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {metrics.recentAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.recentAlerts.map((alert, index) => (
              <Alert key={index} variant="destructive">
                <AlertDescription>
                  <div className="flex justify-between items-start">
                    <div>
                      <strong>{alert.type}</strong> - {alert.policyName} on {alert.tableName}
                      <br />
                      <span className="text-sm">
                        Current: {alert.currentValue} | Threshold: {alert.threshold}
                      </span>
                    </div>
                    <Badge variant="destructive">{alert.severity}</Badge>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Top Slow Policies */}
      <Card>
        <CardHeader>
          <CardTitle>Slowest Policies (Last Hour)</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.topSlowPolicies.length > 0 ? (
            <div className="space-y-3">
              {metrics.topSlowPolicies.map((policy, index) => (
                <div key={policy.policyName} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <div>
                      <div className="font-medium">{policy.policyName}</div>
                      <div className="text-sm text-muted-foreground">
                        {policy.executions} executions
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{Math.round(policy.avgTime)}ms</div>
                    <Badge 
                      variant={getSeverityColor(policy.avgTime, { warning: 1000, critical: 2000 })}
                      className="text-xs"
                    >
                      {policy.avgTime > 2000 ? 'Critical' : 
                       policy.avgTime > 1000 ? 'Warning' : 'Good'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No policy executions recorded in the last hour
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 border rounded-lg">
              <div className="font-medium text-green-600">Good Performance</div>
              <div className="text-muted-foreground">
                • Execution time &lt; 1000ms
                • Error rate &lt; 5%
                • No circular dependencies
              </div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="font-medium text-orange-600">Warning Thresholds</div>
              <div className="text-muted-foreground">
                • Execution time 1000-2000ms
                • Error rate 5-10%
                • Occasional slow queries
              </div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="font-medium text-red-600">Critical Issues</div>
              <div className="text-muted-foreground">
                • Execution time &gt; 2000ms
                • Error rate &gt; 10%
                • Infinite recursion detected
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}