import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useSupabaseQuery } from './data/useSupabaseQuery';

interface TreatmentApproach {
  id: number;
  approaches: string | null;
  specialty: string | null;
  created_at: string;
}

// Simplified performance monitoring interfaces
interface PerformanceMetrics {
  fetchDuration: number;
  filterDuration: number;
  dataSize: number;
  filteredSize: number;
  timestamp: Date;
}

interface CacheMetrics {
  totalRequests: number;
  cacheSize: number;
}

interface DebugInfo {
  hookId: string;
  specialty: string | null;
  errorCount: number;
  retryCount: number;
}

interface UseTreatmentApproachesOptions {
  specialty?: string | null;
}

// Enhanced error types for specific error handling
export type TreatmentApproachErrorType = 'NETWORK_ERROR' | 'NO_DATA' | 'FILTER_ERROR';

export interface TreatmentApproachError {
  type: TreatmentApproachErrorType;
  message: string;
  specialty?: string;
  timestamp: Date;
  originalError?: unknown;
}

interface UseTreatmentApproachesResult {
  approaches: string[];
  loading: boolean;
  error: TreatmentApproachError | null;
  refetch: () => Promise<void>;
  allApproaches: TreatmentApproach[];
  retry: () => Promise<void>;
  // Performance monitoring and debugging
  performanceMetrics: PerformanceMetrics | null;
  cacheMetrics: CacheMetrics;
  debugInfo: DebugInfo;
}

// Simplified global metrics
const globalMetrics: CacheMetrics = {
  totalRequests: 0,
  cacheSize: 0
};

export function useTreatmentApproaches(options: UseTreatmentApproachesOptions = {}): UseTreatmentApproachesResult {
  const { specialty } = options;
  
  // Generate unique hook ID for debugging
  const hookId = useRef(`hook-${Math.random().toString(36).substring(2, 9)}`).current;
  
  // Simplified performance monitoring state
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  
  // State for enhanced error handling
  const [enhancedError, setEnhancedError] = useState<TreatmentApproachError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Always fetch all treatment approaches data on hook initialization
  const { data, loading, error: rawError, refetch } = useSupabaseQuery<TreatmentApproach>({
    table: 'treatment_approaches',
    select: '*',
    orderBy: { column: 'approaches', ascending: true },
    // Removed enabled: !!specialty to always fetch data
  });

  // Simplified performance monitoring for data fetching
  useEffect(() => {
    if (!loading && data) {
      // Update global metrics
      globalMetrics.totalRequests++;
      globalMetrics.cacheSize = data.length;
      
      // Create basic performance metrics
      const metrics: PerformanceMetrics = {
        fetchDuration: 0, // Simplified - not tracking exact timing to avoid complexity
        filterDuration: 0,
        dataSize: data.length,
        filteredSize: 0,
        timestamp: new Date()
      };
      
      setPerformanceMetrics(metrics);
      
      // Production logging - only log significant events
      if (process.env.NODE_ENV === 'development') {
        console.log(`[useTreatmentApproaches:${hookId}] Data loaded`, {
          dataCount: data.length,
          specialty,
          timestamp: new Date().toISOString()
        });
      }
    }
  }, [data, loading, specialty, hookId]);

  // Enhanced error processing with specific error messages for different failure scenarios
  const processedError = useMemo(() => {
    if (!rawError && !enhancedError) return null;
    
    // If we have a raw error from the query, convert it to enhanced error
    if (rawError) {
      let errorType: TreatmentApproachErrorType;
      let message: string;
      
      // More specific error detection based on error content
      const errorString = String(rawError).toLowerCase();
      
      if (errorString.includes('network') || 
          errorString.includes('fetch') || 
          errorString.includes('connection') ||
          errorString.includes('timeout') ||
          errorString.includes('offline')) {
        errorType = 'NETWORK_ERROR';
        message = 'Unable to connect to the server. Please check your internet connection and try again.';
      } else if (errorString.includes('unauthorized') || 
                 errorString.includes('forbidden') ||
                 errorString.includes('authentication')) {
        errorType = 'NETWORK_ERROR';
        message = 'Authentication error. Please refresh the page and try again.';
      } else if (errorString.includes('not found') || 
                 errorString.includes('404') ||
                 errorString.includes('empty') ||
                 errorString.includes('no data')) {
        errorType = 'NO_DATA';
        message = 'Treatment approaches data is currently unavailable. Please contact support if this persists.';
      } else {
        errorType = 'NO_DATA';
        message = 'An unexpected error occurred while loading treatment approaches. Please try again or contact support.';
      }
      
      const processedError: TreatmentApproachError = {
        type: errorType,
        message,
        specialty,
        timestamp: new Date(),
        originalError: rawError
      };
      
      // Always log errors for debugging
      console.error('[useTreatmentApproaches] Database error processed', {
        errorType,
        message,
        originalError: rawError,
        specialty,
        retryCount,
        timestamp: new Date().toISOString()
      });
      
      // Track error count for debugging
      setErrorCount(prev => prev + 1);
      
      return processedError;
    }
    
    return enhancedError;
  }, [rawError, enhancedError, specialty, retryCount]);

  // Simplified retry functionality
  const retry = useCallback(async () => {
    try {
      const newRetryCount = retryCount + 1;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[useTreatmentApproaches:${hookId}] Retry attempt ${newRetryCount}`);
      }
      
      // Clear any existing errors before retry
      setEnhancedError(null);
      setRetryCount(newRetryCount);
      
      // Simple delay
      await new Promise(resolve => setTimeout(resolve, 1000 * newRetryCount));
      
      await refetch();
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[useTreatmentApproaches:${hookId}] Retry successful`);
      }
      
      // Reset retry count on successful retry
      setRetryCount(0);
      
    } catch (error) {
      console.error(`[useTreatmentApproaches:${hookId}] Retry failed`, error);
      
      // Provide simple error message
      const retryError: TreatmentApproachError = {
        type: 'NETWORK_ERROR',
        message: 'Retry failed. Please try again.',
        specialty,
        timestamp: new Date(),
        originalError: error
      };
      
      setEnhancedError(retryError);
      setErrorCount(prev => prev + 1);
    }
  }, [refetch, retryCount, specialty, hookId]);

  // Development-only hook initialization logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[useTreatmentApproaches] Hook initialized', {
      specialty,
      dataLoaded: !!data,
      dataCount: data?.length || 0,
      loading,
      hasError: !!processedError,
      errorType: processedError?.type,
      retryCount,
      timestamp: new Date().toISOString()
    });
  }

  // Client-side filtering using useMemo based on specialty parameter
  const approaches = useMemo(() => {
    const startTime = performance.now();
    
    try {
      // Development-only filtering operation logging
      if (process.env.NODE_ENV === 'development') {
        console.log('[useTreatmentApproaches] Starting filtering operation', {
          specialty,
          specialtyType: typeof specialty,
          allDataCount: data?.length || 0,
          hasSpecialty: !!specialty,
          loading,
          hasError: !!processedError,
          timestamp: new Date().toISOString(),
          startTime
        });
      }

      // Handle null/undefined specialty gracefully - return empty array
      if (specialty === null || specialty === undefined || specialty === '') {
        if (process.env.NODE_ENV === 'development') {
          const endTime = performance.now();
          console.log('[useTreatmentApproaches] No specialty provided, returning empty array gracefully', {
            specialty,
            specialtyType: typeof specialty,
            processingTime: endTime - startTime,
            timestamp: new Date().toISOString()
          });
        }
        return [];
      }

      // If we're still loading, return empty array (loading state will be handled separately)
      if (loading) {
        if (process.env.NODE_ENV === 'development') {
          const endTime = performance.now();
          console.log('[useTreatmentApproaches] Still loading, returning empty array', {
            processingTime: endTime - startTime
          });
        }
        return [];
      }

      // If there's an error, return empty array (error will be displayed)
      if (processedError) {
        if (process.env.NODE_ENV === 'development') {
          const endTime = performance.now();
          console.log('[useTreatmentApproaches] Error state, returning empty array', {
            errorType: processedError.type,
            errorMessage: processedError.message,
            processingTime: endTime - startTime
          });
        }
        return [];
      }

      // If no data loaded yet, return empty array
      if (!data || data.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          const endTime = performance.now();
          console.log('[useTreatmentApproaches] No data available for filtering', {
            dataExists: !!data,
            dataLength: data?.length || 0,
            processingTime: endTime - startTime
          });
        }
        return [];
      }
      
      // Normalize specialty for case-insensitive matching
      const normalizedSpecialty = specialty.trim().toLowerCase();
      
      // Performance tracking for filtering operation
      const filterStartTime = performance.now();
      
      // Filter by specialty with case-insensitive matching and extract unique approaches
      const filtered = data
        .filter(item => {
          // Handle null/undefined item specialty gracefully
          if (!item.specialty) {
            return false;
          }
          
          // Case-insensitive specialty matching for robustness
          const normalizedItemSpecialty = item.specialty.trim().toLowerCase();
          const matches = normalizedItemSpecialty === normalizedSpecialty;
          
          // Debug logging for specialty matching (development only)
          if (!matches && process.env.NODE_ENV === 'development') {
            console.debug('[useTreatmentApproaches] Specialty mismatch', {
              itemSpecialty: item.specialty,
              normalizedItemSpecialty,
              targetSpecialty: specialty,
              normalizedTargetSpecialty: normalizedSpecialty,
              approaches: item.approaches
            });
          }
          
          return matches;
        })
        .map(item => item.approaches)
        .filter((approach): approach is string => Boolean(approach))
        .sort((a, b) => a.localeCompare(b));

      const filterEndTime = performance.now();
      const endTime = performance.now();
      
      // Simple performance tracking
      const filterDuration = filterEndTime - filterStartTime;
      
      // Development-only performance logging
      if (process.env.NODE_ENV === 'development') {
        console.log(`[useTreatmentApproaches:${hookId}] Filtering complete`, {
          specialty,
          totalDataCount: data.length,
          filteredCount: filtered.length,
          filterDuration,
          timestamp: new Date().toISOString()
        });
      }

      return filtered;
    } catch (error) {
      const endTime = performance.now();
      // Always log filtering errors
      console.error('[useTreatmentApproaches] Filtering error', {
        error,
        specialty,
        dataCount: data?.length || 0,
        processingTime: endTime - startTime,
        timestamp: new Date().toISOString()
      });
      
      // Enhanced fallback behavior for filtering errors
      let fallbackApproaches: string[] = [];
      let errorMessage = 'Error filtering treatment approaches. Please try refreshing the page.';
      
      try {
        // Attempt to provide fallback data - return all approaches if filtering fails
        if (data && data.length > 0) {
          fallbackApproaches = data
            .map(item => item.approaches)
            .filter((approach): approach is string => Boolean(approach))
            .sort((a, b) => a.localeCompare(b));
          
          errorMessage = 'Unable to filter by specialty. Showing all available treatment approaches instead.';
          
          // Always log fallback behavior for debugging
          console.warn('[useTreatmentApproaches] Providing fallback data due to filtering error', {
            fallbackCount: fallbackApproaches.length,
            specialty,
            timestamp: new Date().toISOString()
          });
        }
      } catch (fallbackError) {
        // Always log critical fallback failures
        console.error('[useTreatmentApproaches] Fallback data extraction also failed', {
          fallbackError,
          originalError: error,
          timestamp: new Date().toISOString()
        });
      }
      
      // Set enhanced filter error with fallback information
      setEnhancedError({
        type: 'FILTER_ERROR',
        message: errorMessage,
        specialty,
        timestamp: new Date(),
        originalError: error
      });
      
      setErrorCount(prev => prev + 1);
      
      // Return fallback approaches if available, otherwise empty array
      return fallbackApproaches;
    }
  }, [data, specialty, loading, processedError, hookId]);

  // Create final performance metrics
  const finalPerformanceMetrics = useMemo(() => {
    if (performanceMetrics) {
      return {
        ...performanceMetrics,
        filteredSize: approaches.length
      };
    }
    return null;
  }, [performanceMetrics, approaches.length]);

  // Enhanced refetch function that resets error state
  const enhancedRefetch = useCallback(async () => {
    setEnhancedError(null);
    setRetryCount(0);
    await refetch();
  }, [refetch]);

  // Create simplified debug info
  const debugInfo: DebugInfo = {
    hookId,
    specialty,
    errorCount,
    retryCount
  };

  // Development-only final logging
  if (process.env.NODE_ENV === 'development') {
    console.log(`[useTreatmentApproaches:${hookId}] Hook complete`, {
      specialty,
      approachesCount: approaches.length,
      loading,
      hasError: !!processedError,
      errorCount,
      retryCount,
      timestamp: new Date().toISOString()
    });
  }

  return {
    approaches,
    loading,
    error: processedError,
    refetch: enhancedRefetch,
    allApproaches: data || [], // Provide access to all approaches for debugging
    retry,
    // Performance monitoring and debugging tools
    performanceMetrics: finalPerformanceMetrics,
    cacheMetrics: globalMetrics,
    debugInfo,
  };
}
