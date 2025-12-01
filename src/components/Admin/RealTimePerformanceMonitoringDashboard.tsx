/**
 * Real-Time Performance Monitoring Dashboard
 * 
 * Provides comprehensive real-time monitoring of system performance,
 * alerts, and feature flag health with automated alerting capabilities.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  performanceAlertingSystem,
  MonitoringDashboardData,
  Alert as SystemAlert,
  AlertRule,
  SystemMetrics,
  PerformanceTrend
} from '@/utils/performanceAlertingSystem';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  BarChart3,
  Clock,
  Zap,
  Shield,
  Database,
  Cpu,
  RefreshCw,
  Bell,
  BellOff,
  Settings,
  AlertCircle
} from 'lucide-react';

interface RealTimeMonitoringProps {
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Whether to show advanced controls */
  showAdvancedControls?: boolean;
  /** Whether to enable sound alerts */
  enableSoundAlerts?: boolean;
}

export const RealTimePerformanceMonitoringDashboard: React.FC<RealTimeMonitoringProps> = ({
  refreshInterval = 5000, // 5 seconds
  showAdvancedControls = false,
  enableSoundAlerts = false
}) => {
  const [dashboardData, setDashboardData] = useState<MonitoringDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<SystemAlert | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Refresh dashboard data
  const refreshData = useCallback(async () => {
    try {
      const data = performanceAlertingSystem.getMonitoringDashboardData();
      setDashboardData(data);
      setLastUpdated(new Date());
      
      // Play sound for new critical alerts if enabled
      if (enableSoundAlerts && data.activeAlerts.some(alert => 
        alert.severity === 'critical' && 
        Date.now() - alert.timestamp < refreshInterval * 2
      )) {
        // Would play alert sound here
        console.log('🔊 Critical alert sound would play');
      }
    } catch (error) {
      console.error('Error refreshing monitoring data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshInterval, enableSoundAlerts]);

  // Auto-refresh data
  useEffect(() => {
    refreshData();
    
    if (autoRefresh) {
      const interval = setInterval(refreshData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshData, autoRefresh, refreshInterval]);

  // Handle alert resolution
  const handleResolveAlert = (alertId: string) => {
    performanceAlertingSystem.resolveAlert(alertId, 'Manual resolution from dashboard');
    refreshData();
  };

  // Handle alert rule toggle
  const handleToggleAlertRule = (ruleId: string, enabled: boolean) => {
    performanceAlertingSystem.updateAlertRule(ruleId, { enabled });
    refreshData();
  };

  // Get trend icon
  const getTrendIcon = (trend: 'improving' | 'stable' | 'degrading') => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'degrading': return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'stable': return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  // Get alert severity color
  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'warning': return 'bg-yellow-500 text-black';
      case 'info': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  // Get health status color
  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Format metric value
  const formatMetricValue = (value: number, type: string) => {
    switch (type) {
      case 'response_time':
        return `${value.toFixed(0)}ms`;
      case 'percentage':
        return `${(value * 100).toFixed(1)}%`;
      case 'bytes':
        return `${(value / 1024 / 1024).toFixed(1)}MB`;
      default:
        return value.toFixed(2);
    }
  };

  if (isLoading && !dashboardData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading real-time monitoring dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
        <p>Failed to load monitoring data</p>
        <Button onClick={refreshData} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Real-Time Performance Monitoring</h2>
          <p className="text-muted-foreground">
            Live system performance metrics and alerting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
          >
            {autoRefresh ? <Bell className="h-4 w-4 mr-2" /> : <BellOff className="h-4 w-4 mr-2" />}
            Auto Refresh
          </Button>
          <Button onClick={refreshData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Active Alerts Banner */}
      {dashboardData.activeAlerts.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">
            {dashboardData.activeAlerts.length} Active Alert{dashboardData.activeAlerts.length > 1 ? 's' : ''}
          </AlertTitle>
          <AlertDescription className="text-red-700">
            <div className="mt-2 space-y-1">
              {dashboardData.activeAlerts.slice(0, 3).map(alert => (
                <div key={alert.id} className="flex items-center justify-between">
                  <span>{alert.message}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResolveAlert(alert.id)}
                    className="ml-2"
                  >
                    Resolve
                  </Button>
                </div>
              ))}
              {dashboardData.activeAlerts.length > 3 && (
                <p className="text-sm">...and {dashboardData.activeAlerts.length - 3} more</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Health Score</p>
                <p className="text-2xl font-bold">
                  {dashboardData.alertingMetrics.healthScore.toFixed(0)}%
                </p>
              </div>
              <Activity className={`h-8 w-8 ${
                dashboardData.alertingMetrics.healthScore >= 90 ? 'text-green-600' :
                dashboardData.alertingMetrics.healthScore >= 70 ? 'text-yellow-600' : 'text-red-600'
              }`} />
            </div>
            <Progress 
              value={dashboardData.alertingMetrics.healthScore} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Response Time</p>
                <p className="text-2xl font-bold">
                  {dashboardData.currentMetrics.responseTime.average.toFixed(0)}ms
                </p>
              </div>
              <Clock className={`h-8 w-8 ${
                dashboardData.currentMetrics.responseTime.average < 1000 ? 'text-green-600' :
                dashboardData.currentMetrics.responseTime.average < 2000 ? 'text-yellow-600' : 'text-red-600'
              }`} />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              P95: {dashboardData.currentMetrics.responseTime.p95.toFixed(0)}ms
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                <p className="text-2xl font-bold">
                  {(dashboardData.currentMetrics.errorRate * 100).toFixed(2)}%
                </p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${
                dashboardData.currentMetrics.errorRate < 0.01 ? 'text-green-600' :
                dashboardData.currentMetrics.errorRate < 0.05 ? 'text-yellow-600' : 'text-red-600'
              }`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cache Hit Rate</p>
                <p className="text-2xl font-bold">
                  {(dashboardData.currentMetrics.cacheMetrics.hitRate * 100).toFixed(1)}%
                </p>
              </div>
              <Database className={`h-8 w-8 ${
                dashboardData.currentMetrics.cacheMetrics.hitRate > 0.7 ? 'text-green-600' :
                dashboardData.currentMetrics.cacheMetrics.hitRate > 0.5 ? 'text-yellow-600' : 'text-red-600'
              }`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metrics">Live Metrics</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {dashboardData.activeAlerts.length > 0 && (
              <Badge className="ml-2 bg-red-500 text-white">
                {dashboardData.activeAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="trends">Performance Trends</TabsTrigger>
          <TabsTrigger value="features">Feature Health</TabsTrigger>
        </TabsList>

        {/* Live Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* System Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  System Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Average Response Time:</span>
                    <span className="font-mono">
                      {dashboardData.currentMetrics.responseTime.average.toFixed(0)}ms
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>95th Percentile:</span>
                    <span className="font-mono">
                      {dashboardData.currentMetrics.responseTime.p95.toFixed(0)}ms
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>99th Percentile:</span>
                    <span className="font-mono">
                      {dashboardData.currentMetrics.responseTime.p99.toFixed(0)}ms
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Error Rate:</span>
                    <span className="font-mono">
                      {(dashboardData.currentMetrics.errorRate * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Resources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  System Resources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>CPU Usage:</span>
                      <span>{dashboardData.currentMetrics.systemLoad.cpuUsage.toFixed(1)}%</span>
                    </div>
                    <Progress value={dashboardData.currentMetrics.systemLoad.cpuUsage} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Memory Usage:</span>
                      <span>{dashboardData.currentMetrics.systemLoad.memoryUsage.toFixed(1)}%</span>
                    </div>
                    <Progress value={dashboardData.currentMetrics.systemLoad.memoryUsage} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Active Queries:</span>
                    <span className="font-mono">
                      {dashboardData.currentMetrics.systemLoad.activeQueries}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Circuit Breaker:</span>
                    <Badge variant={dashboardData.currentMetrics.circuitBreakerState === 'CLOSED' ? 'default' : 'destructive'}>
                      {dashboardData.currentMetrics.circuitBreakerState}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cache Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Cache Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Hit Rate:</span>
                      <span>{(dashboardData.currentMetrics.cacheMetrics.hitRate * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={dashboardData.currentMetrics.cacheMetrics.hitRate * 100} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Miss Rate:</span>
                      <span>{(dashboardData.currentMetrics.cacheMetrics.missRate * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={dashboardData.currentMetrics.cacheMetrics.missRate * 100} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Cache Size:</span>
                    <span className="font-mono">
                      {(dashboardData.currentMetrics.cacheMetrics.totalSize / 1024 / 1024).toFixed(1)}MB
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Deduplication Savings:</span>
                    <span className="font-mono">
                      {dashboardData.currentMetrics.deduplicationSavings.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Alert Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Alert Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Active Alerts:</span>
                    <Badge variant={dashboardData.activeAlerts.length > 0 ? 'destructive' : 'default'}>
                      {dashboardData.activeAlerts.length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Alerts (24h):</span>
                    <span className="font-mono">{dashboardData.alertingMetrics.alertsLast24h}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Total Rules:</span>
                    <span className="font-mono">{dashboardData.alertingMetrics.totalRules}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Avg Resolution:</span>
                    <span className="font-mono">
                      {(dashboardData.alertingMetrics.avgResolutionTime / 1000 / 60).toFixed(1)}min
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Active Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Active Alerts</CardTitle>
                <CardDescription>
                  Currently active system alerts requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData.activeAlerts.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No active alerts</p>
                    </div>
                  ) : (
                    dashboardData.activeAlerts.map(alert => (
                      <div key={alert.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={getAlertSeverityColor(alert.severity)}>
                                {alert.severity}
                              </Badge>
                              <span className="font-semibold">{alert.ruleName}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {alert.message}
                            </p>
                            <div className="text-xs text-muted-foreground">
                              Triggered: {new Date(alert.timestamp).toLocaleString()}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveAlert(alert.id)}
                          >
                            Resolve
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Alert History</CardTitle>
                <CardDescription>
                  Recently resolved or triggered alerts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData.recentAlerts.slice(0, 5).map(alert => (
                    <div key={alert.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={alert.active ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {alert.active ? 'Active' : 'Resolved'}
                          </Badge>
                          <span className="text-sm font-medium">{alert.ruleName}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {alert.message}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {dashboardData.performanceTrends.map(trend => (
              <Card key={trend.metric}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{trend.metric.replace('_', ' ').toUpperCase()}</span>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(trend.trend)}
                      <span className={`text-sm ${
                        trend.changePercent > 0 ? 'text-green-600' : 
                        trend.changePercent < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {trend.changePercent > 0 ? '+' : ''}{trend.changePercent.toFixed(1)}%
                      </span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Trend:</span>
                      <Badge variant={trend.trend === 'improving' ? 'default' : 
                                   trend.trend === 'degrading' ? 'destructive' : 'secondary'}>
                        {trend.trend}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Based on {trend.dataPoints.length} data points over the last hour
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Feature Health Tab */}
        <TabsContent value="features" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {dashboardData.featureFlagHealth.map(feature => (
              <Card key={feature.feature}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{feature.feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                    <Badge variant={feature.enabled ? 'default' : 'secondary'}>
                      {feature.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Rollout Progress:</span>
                        <span className="text-sm">{feature.rolloutPercentage}%</span>
                      </div>
                      <Progress value={feature.rolloutPercentage} />
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Health Status:</span>
                      <Badge className={
                        feature.health === 'healthy' ? 'bg-green-500 text-white' :
                        feature.health === 'warning' ? 'bg-yellow-500 text-black' :
                        'bg-red-500 text-white'
                      }>
                        {feature.health}
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm">Performance Impact:</span>
                      <span className={`text-sm ${
                        feature.performanceImpact > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {feature.performanceImpact > 0 ? '+' : ''}{(feature.performanceImpact * 100).toFixed(1)}%
                      </span>
                    </div>

                    {feature.recentIssues.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">Recent Issues:</span>
                        <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                          {feature.recentIssues.map((issue, index) => (
                            <li key={index}>• {issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Last updated: {lastUpdated.toLocaleString()}</span>
        <span>Refresh interval: {refreshInterval / 1000}s</span>
      </div>
    </div>
  );
};