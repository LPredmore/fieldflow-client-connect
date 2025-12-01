/**
 * Performance Feature Flag Dashboard
 * 
 * Provides real-time monitoring and manual control of performance feature flags
 * with rollback capabilities and performance metrics visualization.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  TrendingDown,
  Settings,
  BarChart3,
  Shield,
  Zap
} from 'lucide-react';

import { getIntegratedPerformanceSystem } from '@/utils/featureFlagIntegration';
import { getPerformanceFeatureFlags } from '@/utils/performanceFeatureFlags';
import type { PerformanceFeatureFlags, PerformanceMetrics } from '@/utils/performanceFeatureFlags';

interface FeatureStatus {
  enabled: boolean;
  rolloutPercentage: number;
  description: string;
}

interface PerformanceAlert {
  id: string;
  feature: string;
  metric: string;
  threshold: number;
  currentValue: number;
  severity: 'warning' | 'error';
  timestamp: number;
}

export const PerformanceFeatureFlagDashboard: React.FC = () => {
  const [featureStatus, setFeatureStatus] = useState<Record<string, FeatureStatus>>({});
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    try {
      const performanceSystem = getIntegratedPerformanceSystem();
      const flagManager = getPerformanceFeatureFlags();
      
      // Get feature status
      const status = performanceSystem.getFeatureStatus();
      setFeatureStatus(status);

      // Get performance metrics (in a real app, this would come from the metrics collector)
      const mockMetrics: PerformanceMetrics = {
        averageQueryTime: 850,
        errorRate: 0.012,
        cacheHitRate: 0.78,
        circuitBreakerActivations: 2,
        authSkippedQueries: 1,
        userSatisfactionScore: 4.3
      };
      setPerformanceMetrics(mockMetrics);

      // Generate alerts based on metrics
      generateAlerts(mockMetrics, status);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  const generateAlerts = (metrics: PerformanceMetrics, status: Record<string, FeatureStatus>) => {
    const newAlerts: PerformanceAlert[] = [];

    // Check for performance issues
    if (metrics.averageQueryTime > 1500) {
      newAlerts.push({
        id: 'slow-queries',
        feature: 'general',
        metric: 'averageQueryTime',
        threshold: 1500,
        currentValue: metrics.averageQueryTime,
        severity: metrics.averageQueryTime > 2000 ? 'error' : 'warning',
        timestamp: Date.now()
      });
    }

    if (metrics.errorRate > 0.02) {
      newAlerts.push({
        id: 'high-error-rate',
        feature: 'general',
        metric: 'errorRate',
        threshold: 0.02,
        currentValue: metrics.errorRate,
        severity: 'error',
        timestamp: Date.now()
      });
    }

    if (metrics.cacheHitRate < 0.6) {
      newAlerts.push({
        id: 'low-cache-hit-rate',
        feature: 'enhancedCaching',
        metric: 'cacheHitRate',
        threshold: 0.6,
        currentValue: metrics.cacheHitRate,
        severity: 'warning',
        timestamp: Date.now()
      });
    }

    setAlerts(newAlerts);
  };

  const handleFeatureToggle = async (featureName: string, enabled: boolean) => {
    try {
      const performanceSystem = getIntegratedPerformanceSystem();
      performanceSystem.manuallyToggleFeature(featureName, enabled);
      
      // Refresh status
      await loadDashboardData();
      
      console.log(`Feature ${featureName} ${enabled ? 'enabled' : 'disabled'} manually`);
    } catch (error) {
      console.error(`Failed to toggle feature ${featureName}:`, error);
    }
  };

  const getFeatureIcon = (featureName: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      enhancedCaching: <Zap className="h-4 w-4" />,
      requestDeduplication: <BarChart3 className="h-4 w-4" />,
      smartCircuitBreaker: <Shield className="h-4 w-4" />,
      authQueryCoordination: <Settings className="h-4 w-4" />,
      performanceMonitoring: <Activity className="h-4 w-4" />,
      queryPrioritization: <TrendingUp className="h-4 w-4" />,
      progressiveErrorRecovery: <CheckCircle className="h-4 w-4" />,
      backgroundRefresh: <TrendingDown className="h-4 w-4" />
    };
    return iconMap[featureName] || <Settings className="h-4 w-4" />;
  };

  const formatMetricValue = (value: number, type: string) => {
    switch (type) {
      case 'time':
        return `${Math.round(value)}ms`;
      case 'percentage':
        return `${(value * 100).toFixed(1)}%`;
      case 'score':
        return `${value.toFixed(1)}/5.0`;
      default:
        return value.toString();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading performance dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Feature Flags</h2>
          <p className="text-muted-foreground">
            Monitor and control query performance optimizations
          </p>
        </div>
        <Button onClick={loadDashboardData} variant="outline">
          <Activity className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Alert key={alert.id} variant={alert.severity === 'error' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                Performance Alert: {alert.metric}
              </AlertTitle>
              <AlertDescription>
                Current value: {formatMetricValue(alert.currentValue, 
                  alert.metric.includes('Time') ? 'time' : 
                  alert.metric.includes('Rate') ? 'percentage' : 'default'
                )} 
                (threshold: {formatMetricValue(alert.threshold,
                  alert.metric.includes('Time') ? 'time' : 
                  alert.metric.includes('Rate') ? 'percentage' : 'default'
                )})
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <Tabs defaultValue="features" className="space-y-4">
        <TabsList>
          <TabsTrigger value="features">Feature Flags</TabsTrigger>
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
          <TabsTrigger value="rollout">Rollout Status</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(featureStatus).map(([featureName, status]) => (
              <Card key={featureName}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {getFeatureIcon(featureName)}
                    {featureName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </CardTitle>
                  <Switch
                    checked={status.enabled}
                    onCheckedChange={(enabled) => handleFeatureToggle(featureName, enabled)}
                  />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge variant={status.enabled ? 'default' : 'secondary'}>
                        {status.enabled ? (
                          <><CheckCircle className="h-3 w-3 mr-1" /> Enabled</>
                        ) : (
                          <><XCircle className="h-3 w-3 mr-1" /> Disabled</>
                        )}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>Rollout</span>
                        <span>{status.rolloutPercentage}%</span>
                      </div>
                      <Progress value={status.rolloutPercentage} className="h-2" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {status.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          {performanceMetrics && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Query Time</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMetricValue(performanceMetrics.averageQueryTime, 'time')}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Target: &lt; 1000ms
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMetricValue(performanceMetrics.cacheHitRate, 'percentage')}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Target: &gt; 75%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMetricValue(performanceMetrics.errorRate, 'percentage')}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Target: &lt; 1%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Circuit Breaker Activations</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {performanceMetrics.circuitBreakerActivations}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last hour
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Auth Skipped Queries</CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {performanceMetrics.authSkippedQueries}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last hour
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">User Satisfaction</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMetricValue(performanceMetrics.userSatisfactionScore, 'score')}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Based on performance metrics
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="rollout" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rollout Strategy</CardTitle>
              <CardDescription>
                Features are gradually rolled out with automatic rollback triggers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(featureStatus).map(([featureName, status]) => (
                  <div key={featureName} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getFeatureIcon(featureName)}
                      <div>
                        <p className="font-medium">
                          {featureName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {status.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={status.enabled ? 'default' : 'secondary'}>
                        {status.rolloutPercentage}% rollout
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {status.enabled ? 'Active' : 'Disabled'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};