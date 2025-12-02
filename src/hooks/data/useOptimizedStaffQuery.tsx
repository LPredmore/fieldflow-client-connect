/**
 * Optimized Staff Query Hook
 * 
 * Implements task 7.1 requirements:
 * - 30-second cache with background refresh for staff data
 * - Preloading of staff data during user authentication
 * - Optimized query structure for staff profile operations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseQuery, QueryOptions, QueryResult } from './useSupabaseQuery';
import { enhancedQueryCache, QueryMetadata, CacheConfig, CachePriority } from '@/utils/enhancedQueryCache';
import { getCacheConfig } from '@/utils/cacheStrategies';
import { globalBackgroundRefreshManager } from '@/utils/enhancedBackgroundRefresh';
import { supabase } from '@/integrations/supabase/client';

export interface StaffQueryOptions<T> extends Omit<QueryOptions<T>, 'table' | 'staleTime'> {
  /** Whether to preload staff data during authentication */
  preload?: boolean;
  /** Whether to enable background refresh for stale data */
  backgroundRefresh?: boolean;
  /** Custom cache duration in ms (defaults to 30 seconds) */
  cacheDuration?: number;
}

export interface OptimizedStaffResult<T> extends QueryResult<T> {
  /** Whether data was preloaded during authentication */
  isPreloaded: boolean;
  /** Cache age in milliseconds */
  cacheAge?: number;
  /** Whether background refresh is active */
  isBackgroundRefreshing: boolean;
}

/**
 * Optimized cache configuration for staff table
 */
const STAFF_CACHE_CONFIG: CacheConfig = {
  staleTime: 30000,        // 30 seconds as per requirement 5.1
  maxAge: 300000,          // 5 minutes max age
  priority: CachePriority.HIGH,
  backgroundRefresh: true,
  preload: true,
  userSpecific: false
};

/**
 * Preload manager for staff data during authentication
 */
class StaffPreloadManager {
  private preloadedKeys = new Set<string>();
  private preloadPromises = new Map<string, Promise<any>>();
  
  /**
   * Preload staff data for authenticated user
   */
  async preloadStaffData(userId: string, tenantId: string): Promise<void> {
    const preloadKey = `staff-preload-${userId}`;
    
    if (this.preloadedKeys.has(preloadKey)) {
      console.log(`📋 Staff data already preloaded for user: ${userId}`);
      return;
    }
    
    // Check if preload is already in progress
    if (this.preloadPromises.has(preloadKey)) {
      await this.preloadPromises.get(preloadKey);
      return;
    }
    
    console.log(`🚀 Preloading staff data for user: ${userId}`);
    
    const preloadPromise = this.executePreload(userId, tenantId, preloadKey);
    this.preloadPromises.set(preloadKey, preloadPromise);
    
    try {
      await preloadPromise;
      this.preloadedKeys.add(preloadKey);
      console.log(`✅ Staff data preloaded successfully for user: ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to preload staff data for user: ${userId}`, error);
    } finally {
      this.preloadPromises.delete(preloadKey);
    }
  }
  
  private async executePreload(userId: string, tenantId: string, preloadKey: string): Promise<void> {
    // Preload user's own staff profile
    await this.preloadUserStaff(userId, tenantId);
    
    // Preload available staff for assignment/scheduling
    await this.preloadAvailableStaff(tenantId);
    
    // Preload staff profiles with basic info
    await this.preloadStaffProfiles(tenantId);
  }
  
  private async preloadUserStaff(userId: string, tenantId: string): Promise<void> {
    const cacheKey = `staff-*-{"profile_id":"${userId}"}-undefined-${userId}`;
    
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('profile_id', userId)
        .eq('tenant_id', tenantId);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const queryMetadata: QueryMetadata = {
          table: 'staff',
          select: '*',
          filters: { profile_id: userId },
          userId,
          tenantId
        };
        
        enhancedQueryCache.set(cacheKey, data, STAFF_CACHE_CONFIG, queryMetadata);
        console.log(`💾 Preloaded user staff profile: ${data.length} records`);
        
        // Schedule background refresh for this data
        globalBackgroundRefreshManager.scheduleRefresh(
          cacheKey,
          'staff',
          async () => {
            const { data: refreshData, error } = await supabase
              .from('staff')
              .select('*')
              .eq('profile_id', userId)
              .eq('tenant_id', tenantId);
            
            if (error) throw error;
            return refreshData || [];
          },
          CachePriority.HIGH
        );
      }
    } catch (error) {
      console.error('Failed to preload user staff:', error);
    }
  }
  
  private async preloadAvailableStaff(tenantId: string): Promise<void> {
    const cacheKey = `staff-*-{"prov_status":["Active","New"]}-undefined-preload`;
    
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .in('prov_status', ['Active', 'New'])
        .eq('tenant_id', tenantId);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const queryMetadata: QueryMetadata = {
          table: 'staff',
          select: '*',
          filters: { 
            prov_status: ['Active', 'New']
          },
          userId: 'preload',
          tenantId
        };
        
        enhancedQueryCache.set(cacheKey, data, STAFF_CACHE_CONFIG, queryMetadata);
        console.log(`💾 Preloaded available staff: ${data.length} records`);
      }
    } catch (error) {
      console.error('Failed to preload available staff:', error);
    }
  }
  
  private async preloadStaffProfiles(tenantId: string): Promise<void> {
    const cacheKey = `staff-id,prov_status,prov_name_f,prov_name_l-{}-undefined-preload`;
    
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('id, prov_status, prov_name_f, prov_name_l')
        .eq('tenant_id', tenantId)
        .limit(50); // Limit to prevent large preloads
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const queryMetadata: QueryMetadata = {
          table: 'staff',
          select: 'id,prov_status,prov_name_f,prov_name_l',
          filters: {},
          userId: 'preload',
          tenantId
        };
        
        enhancedQueryCache.set(cacheKey, data, STAFF_CACHE_CONFIG, queryMetadata);
        console.log(`💾 Preloaded staff profiles: ${data.length} records`);
      }
    } catch (error) {
      console.error('Failed to preload staff profiles:', error);
    }
  }
  
  /**
   * Check if data has been preloaded for a user
   */
  isPreloaded(userId: string): boolean {
    return this.preloadedKeys.has(`staff-preload-${userId}`);
  }
  
  /**
   * Clear preload cache for a user (e.g., on logout)
   */
  clearPreload(userId: string): void {
    const preloadKey = `staff-preload-${userId}`;
    this.preloadedKeys.delete(preloadKey);
    this.preloadPromises.delete(preloadKey);
  }
}

// Global preload manager instance
const staffPreloadManager = new StaffPreloadManager();

/**
 * Optimized useSupabaseQuery hook specifically for staff table
 * 
 * Features:
 * - 30-second cache with background refresh
 * - Automatic preloading during authentication
 * - Optimized query structure for staff operations
 * - Enhanced performance monitoring
 */
export function useOptimizedStaffQuery<T = any>(
  options: StaffQueryOptions<T>
): OptimizedStaffResult<T> {
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
      
      staffPreloadManager.preloadStaffData(user.id, tenantId)
        .then(() => {
          setIsPreloaded(true);
        })
        .catch((error) => {
          console.error('Preload failed:', error);
        });
    }
  }, [user, tenantId, preload]);
  
  // Create optimized query options for staff
  const optimizedOptions: QueryOptions<T> = {
    ...queryOptions,
    table: 'staff',
    staleTime: cacheDuration,
    onSuccess: (data) => {
      // Update cache age tracking
      const cacheKey = `staff-${queryOptions.select || '*'}-${JSON.stringify(queryOptions.filters || {})}-${JSON.stringify(queryOptions.orderBy)}-${user?.id}`;
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
      const cacheKey = `staff-${queryOptions.select || '*'}-${JSON.stringify(queryOptions.filters || {})}-${JSON.stringify(queryOptions.orderBy)}-${user.id}`;
      
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
  
  return {
    ...queryResult,
    isPreloaded,
    cacheAge,
    isBackgroundRefreshing
  };
}

/**
 * Hook for user's own staff profile with optimized caching
 */
export function useOptimizedUserStaff<T = any>() {
  const { user } = useAuth();
  
  return useOptimizedStaffQuery<T>({
    select: '*',
    filters: {
      profile_id: user?.id
    },
    enabled: !!user,
    preload: true,
    backgroundRefresh: true
  });
}

/**
 * Hook for available staff with optimized caching
 * Includes both 'Active' and 'New' status staff (newly registered)
 */
export function useOptimizedAvailableStaff<T = any>() {
  const { tenantId } = useAuth();
  
  const result = useOptimizedStaffQuery<T>({
    select: '*',
    filters: {
      tenant_id: tenantId,
    },
    preload: true,
    backgroundRefresh: true
  });
  
  // Filter client-side to include both Active and New staff
  const filteredData = (result.data as any[])?.filter(
    (s: any) => s.prov_status === 'Active' || s.prov_status === 'New'
  ) as T | undefined;
  
  return {
    ...result,
    data: filteredData
  };
}

/**
 * Hook for staff profiles (lightweight data for lists/dropdowns)
 */
export function useOptimizedStaffProfiles<T = any>() {
  return useOptimizedStaffQuery<T>({
    select: 'id, prov_status, prov_name_f, prov_name_l',
    orderBy: { column: 'prov_name_l', ascending: true },
    preload: true,
    backgroundRefresh: true,
    cacheDuration: 60000 // 1 minute for profile lists
  });
}

// Export the preload manager for external use
export { staffPreloadManager };
