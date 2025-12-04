/**
 * Simplified Supabase Query Hook
 * 
 * Basic data fetching with React state management.
 * No circuit breakers, no deduplication, no complex caching.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthenticationContext';

export interface QueryOptions<T = any> {
  table: string;
  select?: string;
  filters?: Record<string, any>;
  orderBy?: { column: string; ascending?: boolean };
  enabled?: boolean;
  staleTime?: number;
  onSuccess?: (data: T[]) => void;
  onError?: (error: Error) => void;
  // Backward compatibility properties (ignored but kept for compatibility)
  throttleMs?: number;
  transform?: (data: any[]) => T[];
  retryConfig?: any;
  useNetworkResilience?: boolean;
  dependencies?: any[];
}

export interface QueryResult<T = any> {
  data: T[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isRefreshing: boolean;
  // Backward compatibility properties
  isStale?: boolean;
  isCircuitBreakerOpen?: boolean;
  lastUpdated?: Date;
  errorType?: any; // Made any for backward compatibility
}

export function useSupabaseQuery<T = any>(options: QueryOptions<T>): QueryResult<T> {
  const { user } = useAuth();
  
  // Extract stable primitives to prevent infinite loops from user object reference changes
  const userId = user?.id;
  const tenantId = user?.roleContext?.tenantId;
  
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    table,
    select = '*',
    filters,
    orderBy,
    enabled = true,
    onSuccess,
    onError
  } = options;

  // Create refs for callbacks to prevent dependency array changes
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Stabilize filters to prevent infinite loops from object reference changes
  const filtersKey = JSON.stringify(filters);
  const stableFilters = useMemo(() => filters, [filtersKey]);

  // Stabilize orderBy to prevent infinite loops from object reference changes
  const orderByKey = JSON.stringify(orderBy);
  const stableOrderBy = useMemo(() => orderBy, [orderByKey]);

  // Keep callback refs current without triggering re-renders
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  });

  const fetchData = useCallback(async (isRefetch: boolean = false) => {
    // Skip if disabled or no user/tenant when filters require them
    if (!enabled) {
      console.log('⏸️ [useSupabaseQuery] Query skipped', {
        table,
        enabled,
        hasUser: !!userId,
        reason: 'Query not enabled'
      });
      if (!isRefetch) {
        setLoading(false);
      }
      return;
    }

    // Check if we need user/tenant for this query
    const needsUser = stableFilters?.user_id !== undefined || stableFilters?.tenant_id !== undefined;
    if (needsUser && !userId) {
      console.log('⏸️ [useSupabaseQuery] Query skipped - waiting for user', { table });
      if (!isRefetch) {
        setLoading(false);
      }
      return;
    }

    console.log('🔍 [useSupabaseQuery] fetchData called', {
      table,
      enabled,
      hasUser: !!userId,
      userId,
      tenantId,
      isRefetch
    });

    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    if (isRefetch) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // Start query
      let query = supabase.from(table).select(select);

      // Apply filters
      if (stableFilters) {
        Object.entries(stableFilters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            // Replace special user/tenant placeholders
            let filterValue = value;
            if (key === 'user_id' && value === 'current') {
              filterValue = userId;
            } else if (key === 'tenant_id' && (value === 'current' || value === 'auto')) {
              filterValue = tenantId;
            }
            query = query.eq(key, filterValue);
          }
        });
      }

      // Apply ordering
      if (stableOrderBy) {
        query = query.order(stableOrderBy.column, { ascending: stableOrderBy.ascending ?? true });
      }

      // Execute query
      const { data: result, error: queryError } = await query;

      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) {
        console.log('⏸️ [useSupabaseQuery] Query aborted', { table });
        return;
      }

      if (queryError) {
        throw queryError;
      }

      console.log('✅ [useSupabaseQuery] Query successful', {
        table,
        rowCount: result?.length ?? 0
      });

      setData((result as T[]) || null);
      setError(null);

      // Call success callback
      if (onSuccessRef.current && result) {
        onSuccessRef.current(result as T[]);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ [useSupabaseQuery] Query failed', {
        table,
        error: errorMessage
      });

      setError(errorMessage);
      setData(null);

      // Call error callback
      if (onErrorRef.current && err instanceof Error) {
        onErrorRef.current(err);
      }
    } finally {
      if (isRefetch) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
      abortControllerRef.current = null;
    }
  }, [table, select, stableFilters, stableOrderBy, enabled, userId, tenantId]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  // Initial fetch and refetch on dependency changes
  useEffect(() => {
    fetchData(false);

    return () => {
      // Cancel on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    isRefreshing,
    // Backward compatibility properties (set to reasonable defaults)
    isStale: false,
    isCircuitBreakerOpen: false,
    lastUpdated: new Date(),
    errorType: undefined // No circuit breaker, so no errorType
  };
}
