/**
 * Enhanced useSupabaseQuery Hook with Performance Monitoring and Feature Flags
 * 
 * Extends the existing useSupabaseQuery hook to include comprehensive
 * performance monitoring and metrics collection with feature flag integration.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSupabaseQuery, QueryOptions, QueryResult } from './data/useSupabaseQuery';
import { useQueryPerformanceTracking } from '@/utils/performanceMonitoringIntegration';
import { executeQueryWithFeatureFlags } from '@/utils/featureFlagIntegration';
import { isPerformanceFeatureEnabled } from '@/utils/performanceFeatureFlags';

interface UseSupabaseQueryWithMonitoringOptions {
  /** Query priority for performance monitoring */
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  /** Additional context for monitoring */
  context?: Record<string, unknown>;
  /** Whether to enable performance monitoring (default: true) */
  enableMonitoring?: boolean;
}

/**
 * Enhanced useSupabaseQuery hook with performance monitoring and feature flags
 */
export function useSupabaseQueryWithPerformanceMonitoring<T>(
  options: QueryOptions<T> & UseSupabaseQueryWithMonitoringOptions
) {
  const {
    priority = 'MEDIUM',
    context = {},
    enableMonitoring = true,
    table,
    select = '*',
    filters = {},
    ...queryOptions
  } = options;

  const { startTracking, endTracking } = useQueryPerformanceTracking();
  const queryIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);

  // Check if performance monitoring is enabled via feature flags
  const monitoringEnabled = enableMonitoring && isPerformanceFeatureEnabled('performanceMonitoring');

  // Memoize the tracking functions to avoid dependency issues
  const startTrackingCallback = useCallback(() => {
    if (monitoringEnabled) {
      queryIdRef.current = startTracking(table, priority, {
        select,
        filters,
        ...context
      });
      startTimeRef.current = Date.now();
    }
  }, [table, select, filters, priority, context, monitoringEnabled, startTracking]);

  const endTrackingCallback = useCallback((queryResult: QueryResult<T>) => {
    if (monitoringEnabled && queryIdRef.current) {
      const { data, error, loading } = queryResult;
      
      if (!loading) {
        const endTime = Date.now();
        const duration = endTime - startTimeRef.current;
        
        endTracking(queryIdRef.current, {
          resultCount: Array.isArray(data) ? data.length : data ? 1 : 0,
          errorType: error ? 'query_error' : undefined,
          networkTime: duration,
          processingTime: duration,
          cacheHit: false, // This would be determined by the feature flag system
          deduplicationSaved: false // This would be determined by the feature flag system
        });
        
        queryIdRef.current = null;
      }
    }
  }, [monitoringEnabled, endTracking]);

  // Start performance tracking when query begins
  useEffect(() => {
    startTrackingCallback();
  }, [startTrackingCallback]);

  // Use the original hook with feature flag integration
  const queryResult = useSupabaseQuery<T>({ table, select, filters, ...queryOptions });

  // End performance tracking when query completes
  useEffect(() => {
    endTrackingCallback(queryResult);
  }, [queryResult, endTrackingCallback]);

  return queryResult;
}

/**
 * Hook for monitoring existing queries without changing their implementation
 */
export function useQueryMonitoring<T>(
  queryResult: QueryResult<T>,
  table: string,
  options: UseSupabaseQueryWithMonitoringOptions = {}
) {
  const {
    priority = 'MEDIUM',
    context = {},
    enableMonitoring = true
  } = options;

  const { startTracking, endTracking } = useQueryPerformanceTracking();
  const queryIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const wasLoadingRef = useRef<boolean>(false);

  // Check if performance monitoring is enabled via feature flags
  const monitoringEnabled = enableMonitoring && isPerformanceFeatureEnabled('performanceMonitoring');

  const trackingCallback = useCallback(() => {
    if (monitoringEnabled && queryResult.loading && !wasLoadingRef.current) {
      // Query started
      queryIdRef.current = startTracking(table, priority, context);
      startTimeRef.current = Date.now();
      wasLoadingRef.current = true;
    } else if (monitoringEnabled && !queryResult.loading && wasLoadingRef.current && queryIdRef.current) {
      // Query completed
      const endTime = Date.now();
      const duration = endTime - startTimeRef.current;
      
      endTracking(queryIdRef.current, {
        resultCount: Array.isArray(queryResult.data) ? queryResult.data.length : queryResult.data ? 1 : 0,
        errorType: queryResult.error ? 'query_error' : undefined,
        networkTime: duration,
        processingTime: duration,
        cacheHit: false, // Would need cache integration
        deduplicationSaved: false // Would need deduplication integration
      });
      
      queryIdRef.current = null;
      wasLoadingRef.current = false;
    }
  }, [queryResult.loading, queryResult.error, queryResult.data, table, priority, context, monitoringEnabled, startTracking, endTracking]);

  useEffect(() => {
    trackingCallback();
  }, [trackingCallback]);

  return queryResult;
}

/**
 * Example usage:
 * 
 * // Direct usage with monitoring and feature flags
 * const { data, error, loading } = useSupabaseQueryWithPerformanceMonitoring({
 *   table: 'clinicians',
 *   select: 'id, name, email',
 *   filters: { active: true },
 *   priority: 'HIGH',
 *   context: { component: 'CliniciansList' }
 * });
 * 
 * // Or wrap existing queries with feature flag awareness
 * const cliniciansQuery = useSupabaseQuery({ table: 'clinicians', select: 'id, name, email', filters: { active: true } });
 * useQueryMonitoring(cliniciansQuery, 'clinicians', { priority: 'HIGH' });
 */