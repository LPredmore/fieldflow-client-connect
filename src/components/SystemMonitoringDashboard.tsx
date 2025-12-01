/**
 * System Monitoring Dashboard
 * 
 * This component provides a comprehensive dashboard for monitoring the clinician
 * registration routing system. It displays performance metrics, system health,
 * audit logs, and alerts in real-time.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Download,
  RefreshCw,
  Shield,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import {
  systemMonitoringService,
  PerformanceMetrics,
  SystemHealth,
  EnhancedAuditLogEntry,
  AuditEventType,
} from '@/services/systemMonitoringService';
import { cn } from '@/lib/utils';

interface MonitoringDashboardProps {
  /** Whether to auto-refresh data */
  autoRefresh?: boolean;
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;
  /** Whether to show detailed metrics */
  showDetailedMetrics?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * System status indicator component
 */
const SystemStatusIndicator: React.FC<{
  status: SystemHealth['status'];
  size?: 'sm' | 'md' | 'lg';
}> = ({ status, size = 'md' }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'healthy':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          label: 'Healthy',
        };
      case 'degraded':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          label: 'Degraded',
        };
      case 'unhealthy':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          label: 'Unhealthy',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';

  return (
    <div className={cn('flex items-center gap-2', size === 'sm' && 'text-sm')}>
      <div className={cn('rounded-full p-1', config.bgColor)}>
        <Icon className={cn(iconSize, config.color)} />
      </div>
      <span className={cn('font-medium', config.color)}>{config.label}</span>
    </div>
  );
};

/**
 * Metric card component
 */
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'stable';
  icon?: React.ReactNode;
  status?: 'good' | 'warning' | 'error';
}> = ({ title, value, description, trend, icon, status = 'good' }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'good':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', getStatusColor())}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-2">
            <TrendingUp className={cn(
              'h-3 w-3 mr-1',
              trend === 'up' ? 'text-green-600' : 
              trend === 'down' ? 'text-red-600' : 'text-gray-600'
            )} />
            <span className="text-xs text-muted-foreground">
              {trend === 'up' ? 'Increasing' : trend === 'down' ? 'Decreasing' : 'Stable'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Audit log table component
 */
const AuditLogTable: React.FC<{
  logs: EnhancedAuditLogEntry[];
  onExport: () => void;
}> = ({ logs, onExport }) => {
  const getSeverityBadge = (severity: string) => {
    const variants = {
      info: 'default',
      warning: 'secondary',
      error: 'destructive',
      critical: 'destructive',
    } as const;

    return (
      <Badge variant={variants[severity as keyof typeof variants] || 'default'}>
        {severity}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Recent Audit Logs</h3>
        <Button onClick={onExport} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Timestamp</th>
                <th className="px-4 py-3 text-left font-medium">Event</th>
                <th className="px-4 py-3 text-left font-medium">Severity</th>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Source</th>
                <th className="px-4 py-3 text-left font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs">
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{log.eventType}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {getSeverityBadge(log.severity)}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono">
                    {log.userId.substring(0, 8)}...
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {log.source}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-xs truncate">
                    {JSON.stringify(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {logs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No audit logs available
        </div>
      )}
    </div>
  );
};

/**
 * Main monitoring dashboard component
 */
export const SystemMonitoringDashboard: React.FC<MonitoringDashboardProps> = ({
  autoRefresh = true,
  refreshInterval = 30000,
  showDetailedMetrics = true,
  className,
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [auditLogs, setAuditLogs] = useState<EnhancedAuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch all monitoring data
      const [currentMetrics, currentHealth, currentLogs] = await Promise.all([
        Promise.resolve(systemMonitoringService.getPerformanceMetrics()),
        systemMonitoringService.performHealthCheck(),
        Promise.resolve(systemMonitoringService.getAuditLogs(50)),
      ]);

      setMetrics(currentMetrics);
      setHealth(currentHealth);
      setAuditLogs(currentLogs);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to refresh monitoring data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial data load
    refreshData();

    // Set up auto-refresh
    if (autoRefresh) {
      const interval = setInterval(refreshData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshData, autoRefresh, refreshInterval]);

  const handleExportLogs = useCallback(() => {
    try {
      const csvData = systemMonitoringService.exportAuditLogs('csv');
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  }, []);

  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading monitoring data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">System Monitoring</h1>
          <p className="text-muted-foreground">
            Clinician Registration Routing System
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {lastRefresh && (
            <span className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={refreshData} variant="outline" size="sm">
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <span className="text-sm font-medium">Overall Status</span>
                <SystemStatusIndicator status={health.status} size="lg" />
              </div>
              
              {Object.entries(health.components).map(([component, status]) => (
                <div key={component} className="space-y-2">
                  <span className="text-sm font-medium capitalize">{component}</span>
                  <SystemStatusIndicator status={status} />
                </div>
              ))}
            </div>

            {/* Alerts */}
            {health.alerts.length > 0 && (
              <div className="mt-6 space-y-2">
                <h4 className="font-medium">Active Alerts</h4>
                {health.alerts.map((alert) => (
                  <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>
                      {alert.severity.toUpperCase()} - {alert.component || 'System'}
                    </AlertTitle>
                    <AlertDescription>{alert.message}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      {metrics && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="routing">Routing</TabsTrigger>
            <TabsTrigger value="registration">Registration</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Requests"
                value={metrics.system.totalRequests}
                description="All system requests"
                icon={<Activity className="h-4 w-4" />}
              />
              
              <MetricCard
                title="Error Rate"
                value={`${metrics.system.errorRate.toFixed(2)}%`}
                description="System-wide error rate"
                status={metrics.system.errorRate > 5 ? 'error' : metrics.system.errorRate > 2 ? 'warning' : 'good'}
                icon={<AlertTriangle className="h-4 w-4" />}
              />
              
              <MetricCard
                title="Active Users"
                value={metrics.system.activeUsers}
                description="Currently active users"
                icon={<Users className="h-4 w-4" />}
              />
              
              <MetricCard
                title="Uptime"
                value={`${Math.floor(metrics.system.uptime / 3600)}h`}
                description="System uptime"
                icon={<Clock className="h-4 w-4" />}
              />
            </div>
          </TabsContent>

          <TabsContent value="routing" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Route Operations"
                value={metrics.routeGuard.totalOperations}
                description="Total routing decisions"
                icon={<Shield className="h-4 w-4" />}
              />
              
              <MetricCard
                title="Avg Response Time"
                value={`${metrics.routeGuard.averageResponseTime.toFixed(0)}ms`}
                description="Route guard response time"
                status={metrics.routeGuard.averageResponseTime > 2000 ? 'error' : 
                        metrics.routeGuard.averageResponseTime > 1000 ? 'warning' : 'good'}
                icon={<Clock className="h-4 w-4" />}
              />
              
              <MetricCard
                title="Cache Hit Rate"
                value={`${metrics.routeGuard.cacheHitRate.toFixed(1)}%`}
                description="Staff type cache efficiency"
                status={metrics.routeGuard.cacheHitRate < 70 ? 'warning' : 'good'}
                icon={<Database className="h-4 w-4" />}
              />
            </div>

            {showDetailedMetrics && (
              <Card>
                <CardHeader>
                  <CardTitle>Staff Type Detection</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm font-medium">Total Operations</span>
                      <div className="text-2xl font-bold">{metrics.staffTypeDetection.totalOperations}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Cache Hit Rate</span>
                      <div className="text-2xl font-bold">{metrics.staffTypeDetection.cacheHitRate.toFixed(1)}%</div>
                      <Progress value={metrics.staffTypeDetection.cacheHitRate} className="mt-2" />
                    </div>
                    <div>
                      <span className="text-sm font-medium">Error Rate</span>
                      <div className="text-2xl font-bold">{metrics.staffTypeDetection.errorRate.toFixed(2)}%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="registration" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricCard
                title="Total Attempts"
                value={metrics.registrationFlow.totalAttempts}
                description="Registration attempts"
                icon={<Users className="h-4 w-4" />}
              />
              
              <MetricCard
                title="Successful"
                value={metrics.registrationFlow.successfulRegistrations}
                description="Completed registrations"
                status="good"
                icon={<CheckCircle className="h-4 w-4" />}
              />
              
              <MetricCard
                title="Failed"
                value={metrics.registrationFlow.failedRegistrations}
                description="Failed registrations"
                status={metrics.registrationFlow.failedRegistrations > 0 ? 'warning' : 'good'}
                icon={<XCircle className="h-4 w-4" />}
              />
              
              <MetricCard
                title="Avg Completion"
                value={`${(metrics.registrationFlow.averageCompletionTime / 1000).toFixed(1)}s`}
                description="Average completion time"
                icon={<Clock className="h-4 w-4" />}
              />
            </div>

            {showDetailedMetrics && Object.keys(metrics.registrationFlow.commonFailureReasons).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Common Failure Reasons</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(metrics.registrationFlow.commonFailureReasons).map(([reason, count]) => (
                      <div key={reason} className="flex justify-between items-center">
                        <span className="text-sm">{reason}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <AuditLogTable logs={auditLogs} onExport={handleExportLogs} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default SystemMonitoringDashboard;