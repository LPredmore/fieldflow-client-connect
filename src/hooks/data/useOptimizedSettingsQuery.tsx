/**
 * Optimized Settings Query Hook
 * 
 * Implements task 7.3 requirements:
 * - 5-minute cache for settings data (changes infrequently)
 * - Preloading of settings during application initialization
 * - Settings-specific error handling and fallback strategies
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseQuery, QueryOptions, QueryResult } from './useSupabaseQuery';
import { enhancedQueryCache, QueryMetadata, CacheConfig, CachePriority } from '@/utils/enhancedQueryCache';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/types/database';

type Settings = Database['public']['Tables']['settings']['Row'];
type SettingsInsert = Database['public']['Tables']['settings']['Insert'];

export interface SettingsQueryOptions<T> extends Omit<QueryOptions<T>, 'table' | 'staleTime'> {
  /** Whether to preload settings during app initialization */
  preload?: boolean;
  /** Whether to enable fallback strategies for errors */
  enableFallback?: boolean;
  /** Custom cache duration in ms (defaults to 5 minutes) */
  cacheDuration?: number;
}

export interface OptimizedSettingsResult<T> extends QueryResult<T> {
  /** Whether data was preloaded during initialization */
  isPreloaded: boolean;
  /** Cache age in milliseconds */
  cacheAge?: number;
  /** Whether fallback data is being used */
  isFallback: boolean;
  /** Settings-specific error information */
  settingsError?: SettingsError;
}

export interface SettingsError {
  type: 'permission' | 'network' | 'validation' | 'missing' | 'unknown';
  message: string;
  canRetry: boolean;
  fallbackAvailable: boolean;
}

/**
 * Optimized cache configuration for settings table
 */
const SETTINGS_CACHE_CONFIG: CacheConfig = {
  staleTime: 300000,       // 5 minutes as per requirement 5.3
  maxAge: 1800000,         // 30 minutes max age
  priority: CachePriority.CRITICAL,
  backgroundRefresh: false, // Settings don't need background refresh
  preload: true,
  userSpecific: false
};

/**
 * Default settings fallback data
 */
const DEFAULT_SETTINGS_FALLBACK: Partial<Settings> = {
  business_name: 'Your Business',
  business_email: '',
  business_phone: '',
  business_address: null,
  logo_url: null,
  business_website: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

/**
 * Settings preload and fallback manager
 */
class SettingsManager {
  private preloadedTenants = new Set<string>();
  private preloadPromises = new Map<string, Promise<any>>();
  private fallbackData = new Map<string, Partial<Settings>>();
  
  /**
   * Preload settings for a tenant during app initialization
   */
  async preloadSettings(tenantId: string): Promise<void> {
    if (this.preloadedTenants.has(tenantId)) {
      console.log(`⚙️ Settings already preloaded for tenant: ${tenantId}`);
      return;
    }
    
    // Check if preload is already in progress
    if (this.preloadPromises.has(tenantId)) {
      await this.preloadPromises.get(tenantId);
      return;
    }
    
    console.log(`🚀 Preloading settings for tenant: ${tenantId}`);
    
    const preloadPromise = this.executePreload(tenantId);
    this.preloadPromises.set(tenantId, preloadPromise);
    
    try {
      await preloadPromise;
      this.preloadedTenants.add(tenantId);
      console.log(`✅ Settings preloaded successfully for tenant: ${tenantId}`);
    } catch (error) {
      console.error(`❌ Failed to preload settings for tenant: ${tenantId}`, error);
      // Set fallback data on preload failure
      this.setFallbackData(tenantId, DEFAULT_SETTINGS_FALLBACK);
    } finally {
      this.preloadPromises.delete(tenantId);
    }
  }
  
  private async executePreload(tenantId: string): Promise<void> {
    const cacheKey = `settings-*-{"tenant_id":"${tenantId}"}-undefined-${tenantId}`;
    
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();
      
      if (error) {
        // If no settings found, this is expected for new tenants
        if (error.code === 'PGRST116') {
          console.log(`📝 No settings found for tenant ${tenantId} - will use defaults`);
          this.setFallbackData(tenantId, DEFAULT_SETTINGS_FALLBACK);
          return;
        }
        throw error;
      }
      
      if (data) {
        const queryMetadata: QueryMetadata = {
          table: 'settings',
          select: '*',
          filters: { tenant_id: tenantId },
          userId: 'preload',
          tenantId
        };
        
        enhancedQueryCache.set(cacheKey, [data], SETTINGS_CACHE_CONFIG, queryMetadata);
        console.log(`💾 Preloaded settings for tenant: ${tenantId}`);
      }
    } catch (error) {
      console.error('Failed to preload settings:', error);
      throw error;
    }
  }
  
  /**
   * Set fallback data for a tenant
   */
  setFallbackData(tenantId: string, fallbackData: Partial<Settings>): void {
    this.fallbackData.set(tenantId, {
      ...DEFAULT_SETTINGS_FALLBACK,
      ...fallbackData,
      tenant_id: tenantId
    });
  }
  
  /**
   * Get fallback data for a tenant
   */
  getFallbackData(tenantId: string): Partial<Settings> | null {
    return this.fallbackData.get(tenantId) || null;
  }
  
  /**
   * Check if settings have been preloaded for a tenant
   */
  isPreloaded(tenantId: string): boolean {
    return this.preloadedTenants.has(tenantId);
  }
  
  /**
   * Clear preload cache for a tenant
   */
  clearPreload(tenantId: string): void {
    this.preloadedTenants.delete(tenantId);
    this.preloadPromises.delete(tenantId);
    this.fallbackData.delete(tenantId);
  }
  
  /**
   * Classify settings-specific errors
   */
  classifyError(error: any): SettingsError {
    if (error.code === 'PGRST116') {
      return {
        type: 'missing',
        message: 'No settings found for this organization',
        canRetry: false,
        fallbackAvailable: true
      };
    }
    
    if (error.code === '42501' || error.message?.includes('permission')) {
      return {
        type: 'permission',
        message: 'Insufficient permissions to access settings',
        canRetry: false,
        fallbackAvailable: true
      };
    }
    
    if (error.code === '23505' || error.message?.includes('duplicate')) {
      return {
        type: 'validation',
        message: 'Settings validation error',
        canRetry: false,
        fallbackAvailable: true
      };
    }
    
    if (error.name === 'NetworkError' || error.message?.includes('network')) {
      return {
        type: 'network',
        message: 'Network error loading settings',
        canRetry: true,
        fallbackAvailable: true
      };
    }
    
    return {
      type: 'unknown',
      message: error.message || 'Unknown error loading settings',
      canRetry: true,
      fallbackAvailable: true
    };
  }
}

// Global settings manager instance
const settingsManager = new SettingsManager();

/**
 * Optimized useSupabaseQuery hook specifically for settings table
 * 
 * Features:
 * - 5-minute cache (settings change infrequently)
 * - Automatic preloading during app initialization
 * - Settings-specific error handling and fallback strategies
 * - Enhanced performance monitoring
 */
export function useOptimizedSettingsQuery<T = any>(
  options: SettingsQueryOptions<T> = {}
): OptimizedSettingsResult<T> {
  const {
    preload = true,
    enableFallback = true,
    cacheDuration = 300000,
    ...queryOptions
  } = options;
  
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [cacheAge, setCacheAge] = useState<number>();
  const [isFallback, setIsFallback] = useState(false);
  const [settingsError, setSettingsError] = useState<SettingsError>();
  const preloadInitiatedRef = useRef(false);
  
  // Handle preloading during app initialization
  useEffect(() => {
    if (tenantId && preload && !preloadInitiatedRef.current) {
      preloadInitiatedRef.current = true;
      
      settingsManager.preloadSettings(tenantId)
        .then(() => {
          setIsPreloaded(true);
        })
        .catch((error) => {
          console.error('Settings preload failed:', error);
          const classifiedError = settingsManager.classifyError(error);
          setSettingsError(classifiedError);
          
          if (enableFallback) {
            setIsFallback(true);
          }
        });
    }
  }, [tenantId, preload, enableFallback]);
  
  // Create optimized query options for settings
  const optimizedOptions: QueryOptions<T> = {
    ...queryOptions,
    table: 'settings',
    staleTime: cacheDuration,
    filters: {
      tenant_id: 'auto',
      ...queryOptions.filters
    },
    onSuccess: (data) => {
      // Update cache age tracking
      const cacheKey = `settings-${queryOptions.select || '*'}-${JSON.stringify({ tenant_id: 'auto', ...queryOptions.filters })}-${JSON.stringify(queryOptions.orderBy)}-${user?.id}`;
      const cacheResult = enhancedQueryCache.get(cacheKey);
      setCacheAge(cacheResult.age);
      setIsFallback(false);
      setSettingsError(undefined);
      
      // Call original success callback
      if (queryOptions.onSuccess) {
        queryOptions.onSuccess(data);
      }
    },
    onError: (error) => {
      const classifiedError = settingsManager.classifyError(error);
      setSettingsError(classifiedError);
      
      // Handle settings-specific errors
      if (enableFallback && classifiedError.fallbackAvailable && tenantId) {
        const fallbackData = settingsManager.getFallbackData(tenantId);
        if (fallbackData) {
          console.log('🔄 Using fallback settings data');
          setIsFallback(true);
          
          // Show user-friendly message
          toast({
            title: "Using default settings",
            description: classifiedError.message + " - Using default configuration.",
            variant: classifiedError.type === 'missing' ? 'default' : 'destructive'
          });
        }
      } else {
        // Show error toast for non-fallback scenarios
        toast({
          title: "Settings Error",
          description: classifiedError.message,
          variant: "destructive"
        });
      }
      
      // Call original error callback
      if (queryOptions.onError) {
        queryOptions.onError(error);
      }
    }
  };
  
  // Use the standard query hook with optimized options
  const queryResult = useSupabaseQuery<T>(optimizedOptions);
  
  // Apply fallback data if needed
  const finalData = isFallback && tenantId && (queryResult.data?.length ?? 0) === 0
    ? [settingsManager.getFallbackData(tenantId) as T]
    : queryResult.data;
  
  // Monitor cache status
  useEffect(() => {
    if (user && tenantId) {
      const cacheKey = `settings-${queryOptions.select || '*'}-${JSON.stringify({ tenant_id: 'auto', ...queryOptions.filters })}-${JSON.stringify(queryOptions.orderBy)}-${user.id}`;
      
      // Check cache status periodically
      const checkCacheStatus = () => {
        const cacheResult = enhancedQueryCache.get(cacheKey);
        setCacheAge(cacheResult.age);
      };
      
      const interval = setInterval(checkCacheStatus, 5000); // Check every 5 seconds
      return () => clearInterval(interval);
    }
  }, [user, tenantId, queryOptions.select, queryOptions.filters, queryOptions.orderBy]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tenantId) {
        // Don't clear preload on component unmount, only on tenant change
        // settingsManager.clearPreload(tenantId);
      }
    };
  }, [tenantId]);
  
  return {
    ...queryResult,
    data: finalData,
    isPreloaded,
    cacheAge,
    isFallback,
    settingsError
  };
}

/**
 * Hook for tenant settings with optimized caching and fallback
 */
export function useOptimizedSettings() {
  return useOptimizedSettingsQuery<Settings>({
    select: '*',
    preload: true,
    enableFallback: true
  });
}

/**
 * Hook for specific settings fields (lightweight queries)
 */
export function useOptimizedSettingsFields(fields: string[]) {
  return useOptimizedSettingsQuery<Partial<Settings>>({
    select: fields.join(', '),
    preload: true,
    enableFallback: true,
    cacheDuration: 600000 // 10 minutes for field-specific queries
  });
}

/**
 * Hook for business branding settings (logo, colors, name)
 */
export function useOptimizedBrandingSettings() {
  return useOptimizedSettingsQuery<Partial<Settings>>({
    select: 'business_name, logo_url, primary_color, secondary_color',
    preload: true,
    enableFallback: true,
    cacheDuration: 600000 // 10 minutes for branding
  });
}

/**
 * Hook for appointment settings
 */
export function useOptimizedAppointmentSettings() {
  return useOptimizedSettingsQuery<Partial<Settings>>({
    select: 'appointment_buffer_minutes, max_appointments_per_day, allow_online_booking, require_appointment_confirmation, send_reminder_emails, reminder_hours_before',
    preload: true,
    enableFallback: true,
    cacheDuration: 300000 // 5 minutes for appointment settings
  });
}

// Export the settings manager for external use
export { settingsManager, DEFAULT_SETTINGS_FALLBACK, type Settings, type SettingsInsert };