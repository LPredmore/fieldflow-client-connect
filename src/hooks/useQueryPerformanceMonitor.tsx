/**
 * Query Performance Monitor Hook
 * 
 * Provides real-time query performance monitoring and alerting
 * capabilities for database queries across the application.
 */

import { useState, useEffect, useCallback } from 'react';
import { queryLogger, QueryMetrics, QueryLogEntry } from '@/utils/queryLogger';
import { useToast } from '@/hooks/use-toast';

interface PerformanceAlert {
  id: string;
  type: 'slow_query' | 'high_error_rate' | 'circuit_breaker' | 'cache_miss_rate';
  message: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
  data?: any;
}

interface UseQueryPerformanceMonitorOptions {
  enableAlerts?: boolean;
  slowQueryThreshold?: number; // milliseconds
  errorRateThreshold?: number; // percentage
  cacheMissRateThreshold?: number; // percentage
  monitoringInterval?: number; // milliseconds
}

interface QueryPerformanceMonitorResult {
  metrics: QueryMetrics | null;
  recentLogs: QueryLogEntry[];
  alerts: PerformanceAlert[];
  isMonitoring: boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  clearAlerts: () => void;
  exportMetrics: () => string;
  getQueryById: (queryId: string) => QueryLogEntry | undefined;
}

export function useQueryPerformanceMonitor(
  options: UseQueryPerformanceMonitorOptions = {}
): QueryPerformanceMonitorResult {
  const {
    enableAlerts = true,
    slowQueryThreshold = 2000,
    errorRateThreshold = 10, // 10%
    cacheMissRateThreshold = 50, // 50%
    monitoringInterval = 5000 // 5 seconds
  } = options;

  const [metrics, setMetrics] = useState<QueryMetrics | null>(null);
  const [recentLogs, setRecentLogs] = useState<QueryLogEntry[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitoringInterval_, setMonitoringInterval_] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const generateAlertId = () => `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const createAlert = useCallback((
    type: PerformanceAlert['type'],
    message: string,
    severity: PerformanceAlert['severity'],
    data?: any
  ) => {
    const alert: PerformanceAlert = {
      id: generateAlertId(),
      type,
      message,
      severity,
      timestamp: new Date(),
      data
    };

    setAlerts(prev => [alert, ...prev.slice(0, 49)]); // Keep last 50 alerts

    // Show toast notification for high severity alerts
    if (enableAlerts && severity === 'high') {
      toast({
        variant: "destructive",
        title: "Performance Alert",
        description: message,
      });
    }

    return alert;
  }, [enableAlerts, toast]);

  const analyzeMetrics = useCallback((currentMetrics: QueryMetrics) => {
    const newAlerts: PerformanceAlert[] = [];

    // Check for slow queries
    if (currentMetrics.slowQueries.length > 0) {
      const slowestQuery = currentMetrics.slowQueries[0];
      if (slowestQuery.duration && slowestQuery.duration > slowQueryThreshold) {
        newAlerts.push(createAlert(
          'slow_query',
          `Slow query detected: ${slowestQuery.table} took ${slowestQuery.duration}ms`,
          slowestQuery.duration > slowQueryThreshold * 2 ? 'high' : 'medium',
          slowestQuery
        ));
      }
    }

    // Check error rate
    if (currentMetrics.totalQueries > 0) {
      const errorRate = (currentMetrics.failedQueries / currentMetrics.totalQueries) * 100;
      if (errorRate > errorRateThreshold) {
        newAlerts.push(createAlert(
          'high_error_rate',
          `High error rate detected: ${errorRate.toFixed(1)}% of queries failing`,
          errorRate > errorRateThreshold * 2 ? 'high' : 'medium',
          { errorRate, totalQueries: currentMetrics.totalQueries, failedQueries: currentMetrics.failedQueries }
        ));
      }
    }

    // Check circuit breaker activations
    if (currentMetrics.circuitBreakerActivations > 0) {
      newAlerts.push(createAlert(
        'circuit_breaker',
        `Circuit breaker activated ${currentMetrics.circuitBreakerActivations} times`,
        currentMetrics.circuitBreakerActivations > 3 ? 'high' : 'medium',
        { activations: currentMetrics.circuitBreakerActivations }
      ));
    }

    // Check cache miss rate
    const cacheMissRate = (1 - currentMetrics.cacheHitRate) * 100;
    if (cacheMissRate > cacheMissRateThreshold && currentMetrics.totalQueries > 10) {
      newAlerts.push(createAlert(
        'cache_miss_rate',
        `High cache miss rate: ${cacheMissRate.toFixed(1)}% of queries not cached`,
        cacheMissRate > cacheMissRateThreshold * 1.5 ? 'high' : 'low',
        { cacheMissRate, cacheHitRate: currentMetrics.cacheHitRate }
      ));
    }

    return newAlerts;
  }, [slowQueryThreshold, errorRateThreshold, cacheMissRateThreshold, createAlert]);

  const updateMetrics = useCallback(() => {
    try {
      const currentMetrics = queryLogger.getMetrics();
      const currentLogs = queryLogger.getLogs(100);
      
      setMetrics(currentMetrics);
      setRecentLogs(currentLogs);

      // Analyze metrics for alerts
      if (enableAlerts) {
        analyzeMetrics(currentMetrics);
      }

      // Log performance summary
      console.log('📊 [QueryPerformanceMonitor] Metrics Update:', {
        totalQueries: currentMetrics.totalQueries,
        successRate: currentMetrics.totalQueries > 0 
          ? Math.round((currentMetrics.successfulQueries / currentMetrics.totalQueries) * 100)
          : 0,
        avgResponseTime: `${currentMetrics.averageResponseTime}ms`,
        cacheHitRate: `${Math.round(currentMetrics.cacheHitRate * 100)}%`,
        circuitBreakerActivations: currentMetrics.circuitBreakerActivations,
        slowQueries: currentMetrics.slowQueries.length,
        recentErrors: currentMetrics.recentErrors.length
      });

    } catch (error) {
      console.error('[QueryPerformanceMonitor] Error updating metrics:', error);
    }
  }, [enableAlerts, analyzeMetrics]);

  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    console.log('[QueryPerformanceMonitor] Starting performance monitoring...');
    setIsMonitoring(true);
    
    // Initial update
    updateMetrics();
    
    // Set up interval
    const interval = setInterval(updateMetrics, monitoringInterval);
    setMonitoringInterval_(interval);

    // Listen for custom query performance events
    const handleQueryEvent = (event: CustomEvent) => {
      console.log('🔔 [QueryPerformanceMonitor] Query Event:', event.detail);
      
      // Trigger immediate metrics update for important events
      if (event.detail.type === 'query_failed' || event.detail.type === 'query_completed') {
        setTimeout(updateMetrics, 100); // Small delay to ensure logger has processed the event
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('query-performance', handleQueryEvent as EventListener);
      
      // Cleanup function
      return () => {
        window.removeEventListener('query-performance', handleQueryEvent as EventListener);
      };
    }
  }, [isMonitoring, updateMetrics, monitoringInterval]);

  const stopMonitoring = useCallback(() => {
    if (!isMonitoring) return;

    console.log('[QueryPerformanceMonitor] Stopping performance monitoring...');
    setIsMonitoring(false);
    
    if (monitoringInterval_) {
      clearInterval(monitoringInterval_);
      setMonitoringInterval_(null);
    }
  }, [isMonitoring, monitoringInterval_]);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    console.log('[QueryPerformanceMonitor] Alerts cleared');
  }, []);

  const exportMetrics = useCallback(() => {
    const exportData = {
      timestamp: new Date().toISOString(),
      metrics,
      recentLogs: recentLogs.slice(0, 50), // Export last 50 logs
      alerts: alerts.slice(0, 20), // Export last 20 alerts
      configuration: {
        slowQueryThreshold,
        errorRateThreshold,
        cacheMissRateThreshold,
        monitoringInterval
      }
    };

    return JSON.stringify(exportData, null, 2);
  }, [metrics, recentLogs, alerts, slowQueryThreshold, errorRateThreshold, cacheMissRateThreshold, monitoringInterval]);

  const getQueryById = useCallback((queryId: string) => {
    return recentLogs.find(log => log.id === queryId);
  }, [recentLogs]);

  // Auto-start monitoring on mount if enabled
  useEffect(() => {
    if (enableAlerts) {
      startMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [enableAlerts, startMonitoring, stopMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (monitoringInterval_) {
        clearInterval(monitoringInterval_);
      }
    };
  }, [monitoringInterval_]);

  return {
    metrics,
    recentLogs,
    alerts,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    clearAlerts,
    exportMetrics,
    getQueryById
  };
}