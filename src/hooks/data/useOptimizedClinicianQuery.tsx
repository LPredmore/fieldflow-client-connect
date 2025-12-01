/**
 * Optimized Clinician Query Hook
 * 
 * Implements task 7.1 requirements:
 * - 30-second cache with background refresh for clinicians data
 * - Preloading of clinicians data during user authentication
 * - Optimized query structure for clinician profile operations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseQuery, QueryOptions, QueryResult } from './useSupabaseQuery';
import { enhancedQueryCache, QueryMetadata, CacheConfig, CachePriority } from '@/utils/enhancedQueryCache';
import { getCacheConfig } from '@/utils/cacheStrategies';
import { globalBackgroundRefreshManager } from '@/utils/enhancedBackgroundRefresh';
import { supabase } from '@/integrations/supabase/client';

export interface ClinicianQueryOptions<T> extends Omit<QueryOptions<T>, 'table' | 'staleTime'> {
  /** Whether to preload clinician data during authentication */
  preload?: boolean;
  /** Whether to enable background refresh for stale data */
  backgroundRefresh?: boolean;
  /** Custom cache duration in ms (defaults to 30 seconds) */
  cacheDuration?: number;
}

export interface OptimizedClinicianResult<T> extends QueryResult<T> {
  /** Whether data was preloaded during authentication */
  isPreloaded: boolean;
  /** Cache age in milliseconds */
  cacheAge?: number;
  /** Whether background refresh is active */
  isBackgroundRefreshing: boolean;
}

/**
 * Optimized cache configuration for clinicians table
 */
const CLINICIAN_CACHE_CONFIG: CacheConfig = {
  staleTime: 30000,        // 30 seconds as per requirement 5.1
  maxAge: 300000,          // 5 minutes max age
  priority: CachePriority.HIGH,
  backgroundRefresh: true,
  preload: true,
  userSpecific: false
};

/**
 * Preload manager for clinician data during authentication
 */
class ClinicianPreloadManager {
  private preloadedKeys = new Set<string>();
  private preloadPromises = new Map<string, Promise<any>>();
  
  /**
   * Preload clinician data for authenticated user
   */
  async preloadClinicianData(userId: string, tenantId: string): Promise<void> {
    const preloadKey = `clinicians-preload-${userId}`;
    
    if (this.preloadedKeys.has(preloadKey)) {
      console.log(`📋 Clinician data already preloaded for user: ${userId}`);
      return;
    }
    
    // Check if preload is already in progress
    if (this.preloadPromises.has(preloadKey)) {
      await this.preloadPromises.get(preloadKey);
      return;
    }
    
    console.log(`🚀 Preloading clinician data for user: ${userId}`);
    
    const preloadPromise = this.executePreload(userId, tenantId, preloadKey);
    this.preloadPromises.set(preloadKey, preloadPromise);
    
    try {
      await preloadPromise;
      this.preloadedKeys.add(preloadKey);
      console.log(`✅ Clinician data preloaded successfully for user: ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to preload clinician data for user: ${userId}`, error);
    } finally {
      this.preloadPromises.delete(preloadKey);
    }
  }
  
  private async executePreload(userId: string, tenantId: string, preloadKey: string): Promise<void> {
    // Preload user's own clinician profile
    await this.preloadUserClinician(userId, tenantId);
    
    // Preload available clinicians for assignment/scheduling
    await this.preloadAvailableClinicians(tenantId);
    
    // Preload clinician profiles with basic info
    await this.preloadClinicianProfiles(tenantId);
  }
  
  private async preloadUserClinician(userId: string, tenantId: string): Promise<void> {
    const cacheKey = `clinicians-*-{"user_id":"${userId}"}-undefined-${userId}`;
    
    try {
      const { data, error } = await supabase
        .from('clinicians')
        .select('*')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const queryMetadata: QueryMetadata = {
          table: 'clinicians',
          select: '*',
          filters: { user_id: userId },
          userId,
          tenantId
        };
        
        enhancedQueryCache.set(cacheKey, data, CLINICIAN_CACHE_CONFIG, queryMetadata);
        console.log(`💾 Preloaded user clinician profile: ${data.length} records`);
        
        // Schedule background refresh for this data
        globalBackgroundRefreshManager.scheduleRefresh(
          cacheKey,
          'clinicians',
          async () => {
            const { data: refreshData, error } = await supabase
              .from('clinicians')
              .select('*')
              .eq('user_id', userId)
              .eq('tenant_id', tenantId);
            
            if (error) throw error;
            return refreshData || [];
          },
          CachePriority.HIGH
        );
      }
    } catch (error) {
      console.error('Failed to preload user clinician:', error);
    }
  }
  
  private async preloadAvailableClinicians(tenantId: string): Promise<void> {
    const cacheKey = `clinicians-*,profiles!inner(first_name, last_name)-{"clinician_accepting_new_clients":"Yes","clinician_status":"Active"}-undefined-preload`;
    
    try {
      const { data, error } = await supabase
        .from('clinicians')
        .select(`
          *,
          profiles!inner(first_name, last_name)
        `)
        .eq('clinician_accepting_new_clients', 'Yes')
        .eq('clinician_status', 'Active')
        .eq('tenant_id', tenantId);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const queryMetadata: QueryMetadata = {
          table: 'clinicians',
          select: '*,profiles!inner(first_name, last_name)',
          filters: { 
            clinician_accepting_new_clients: 'Yes',
            clinician_status: 'Active'
          },
          userId: 'preload',
          tenantId
        };
        
        enhancedQueryCache.set(cacheKey, data, CLINICIAN_CACHE_CONFIG, queryMetadata);
        console.log(`💾 Preloaded available clinicians: ${data.length} records`);
      }
    } catch (error) {
      console.error('Failed to preload available clinicians:', error);
    }
  }
  
  private async preloadClinicianProfiles(tenantId: string): Promise<void> {
    const cacheKey = `clinicians-id,clinician_status,profiles!inner(first_name,last_name,email)-{}-undefined-preload`;
    
    try {
      const { data, error } = await supabase
        .from('clinicians')
        .select(`
          id,
          clinician_status,
          profiles!inner(first_name, last_name, email)
        `)
        .eq('tenant_id', tenantId)
        .limit(50); // Limit to prevent large preloads
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const queryMetadata: QueryMetadata = {
          table: 'clinicians',
          select: 'id,clinician_status,profiles!inner(first_name,last_name,email)',
          filters: {},
          userId: 'preload',
          tenantId
        };
        
        enhancedQueryCache.set(cacheKey, data, CLINICIAN_CACHE_CONFIG, queryMetadata);
        console.log(`💾 Preloaded clinician profiles: ${data.length} records`);
      }
    } catch (error) {
      console.error('Failed to preload clinician profiles:', error);
    }
  }
  
  /**
   * Check if data has been preloaded for a user
   */
  isPreloaded(userId: string): boolean {
    return this.preloadedKeys.has(`clinicians-preload-${userId}`);
  }
  
  /**
   * Clear preload cache for a user (e.g., on logout)
   */
  clearPreload(userId: string): void {
    const preloadKey = `clinicians-preload-${userId}`;
    this.preloadedKeys.delete(preloadKey);
    this.preloadPromises.delete(preloadKey);
  }
}

// Global preload manager instance
const clinicianPreloadManager = new ClinicianPreloadManager();

/**
 * Optimized useSupabaseQuery hook specifically for clinicians table
 * 
 * Features:
 * - 30-second cache with background refresh
 * - Automatic preloading during authentication
 * - Optimized query structure for clinician operations
 * - Enhanced performance monitoring
 */
export function useOptimizedClinicianQuery<T = any>(
  options: ClinicianQueryOptions<T>
): OptimizedClinicianResult<T> {
  const {
    preload = true,
    backgroundRefresh = true,
    cacheDuration = 30000,
    ...queryOptions
  } = options;
  
  const { user, tenantId } = useAuth();
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [cacheAge, setCacheAge] = useState<number>();
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const preloadInitiatedRef = useRef(false);
  
  // Handle preloading during authentication
  useEffect(() => {
    if (user && tenantId && preload && !preloadInitiatedRef.current) {
      preloadInitiatedRef.current = true;
      
      clinicianPreloadManager.preloadClinicianData(user.id, tenantId)
        .then(() => {
          setIsPreloaded(true);
        })
        .catch((error) => {
          console.error('Preload failed:', error);
        });
    }
  }, [user, tenantId, preload]);
  
  // Create optimized query options for clinicians
  const optimizedOptions: QueryOptions<T> = {
    ...queryOptions,
    table: 'clinicians',
    staleTime: cacheDuration,
    onSuccess: (data) => {
      // Update cache age tracking
      const cacheKey = `clinicians-${queryOptions.select || '*'}-${JSON.stringify(queryOptions.filters || {})}-${JSON.stringify(queryOptions.orderBy)}-${user?.id}`;
      const cacheResult = enhancedQueryCache.get(cacheKey);
      setCacheAge(cacheResult.age);
      setIsBackgroundRefreshing(cacheResult.isRefreshing);
      
      // Call original success callback
      if (queryOptions.onSuccess) {
        queryOptions.onSuccess(data);
      }
    }
  };
  
  // Use the standard query hook with optimized options
  const queryResult = useSupabaseQuery<T>(optimizedOptions);
  
  // Monitor background refresh status
  useEffect(() => {
    if (user) {
      const cacheKey = `clinicians-${queryOptions.select || '*'}-${JSON.stringify(queryOptions.filters || {})}-${JSON.stringify(queryOptions.orderBy)}-${user.id}`;
      
      // Check cache status periodically
      const checkCacheStatus = () => {
        const cacheResult = enhancedQueryCache.get(cacheKey);
        setCacheAge(cacheResult.age);
        setIsBackgroundRefreshing(cacheResult.isRefreshing);
      };
      
      const interval = setInterval(checkCacheStatus, 1000);
      return () => clearInterval(interval);
    }
  }, [user, queryOptions.select, queryOptions.filters, queryOptions.orderBy]);
  
  // Cleanup preload on unmount
  useEffect(() => {
    return () => {
      if (user) {
        // Don't clear preload on component unmount, only on logout
        // clinicianPreloadManager.clearPreload(user.id);
      }
    };
  }, [user]);
  
  return {
    ...queryResult,
    isPreloaded,
    cacheAge,
    isBackgroundRefreshing
  };
}

/**
 * Hook for user's own clinician profile with optimized caching
 */
export function useOptimizedUserClinician<T = any>() {
  const { user } = useAuth();
  
  return useOptimizedClinicianQuery<T>({
    select: '*',
    filters: {
      user_id: user?.id
    },
    enabled: !!user,
    preload: true,
    backgroundRefresh: true
  });
}

/**
 * Hook for available clinicians with optimized caching
 */
export function useOptimizedAvailableClinicians<T = any>() {
  return useOptimizedClinicianQuery<T>({
    select: `
      *,
      profiles!inner(first_name, last_name)
    `,
    filters: {
      clinician_accepting_new_clients: 'Yes',
      clinician_status: 'Active'
    },
    preload: true,
    backgroundRefresh: true
  });
}

/**
 * Hook for clinician profiles (lightweight data for lists/dropdowns)
 */
export function useOptimizedClinicianProfiles<T = any>() {
  return useOptimizedClinicianQuery<T>({
    select: `
      id,
      clinician_status,
      profiles!inner(first_name, last_name, email)
    `,
    orderBy: { column: 'profiles.last_name', ascending: true },
    preload: true,
    backgroundRefresh: true,
    cacheDuration: 60000 // 1 minute for profile lists
  });
}

// Export the preload manager for external use
export { clinicianPreloadManager };