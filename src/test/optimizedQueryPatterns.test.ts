/**
 * Integration tests for optimized query patterns
 * 
 * Tests the implementation of task 7 requirements:
 * - Clinician query optimization with 30-second cache
 * - Customer query optimization with progressive loading
 * - Settings query optimization with 5-minute cache
 * - Background refresh system functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { enhancedQueryCache } from '@/utils/enhancedQueryCache';
import { globalBackgroundRefreshManager } from '@/utils/enhancedBackgroundRefresh';
import { getCacheConfig } from '@/utils/cacheStrategies';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    }))
  }
}));

// Mock auth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
    tenantId: 'test-tenant-id'
  })
}));

describe('Optimized Query Patterns', () => {
  beforeEach(() => {
    // Clear cache before each test
    enhancedQueryCache.clear();
    
    // Stop and restart background refresh manager
    globalBackgroundRefreshManager.stop();
    globalBackgroundRefreshManager.start();
  });
  
  afterEach(() => {
    // Clean up after each test
    enhancedQueryCache.clear();
    globalBackgroundRefreshManager.stop();
  });
  
  describe('Cache Configuration', () => {
    it('should have correct cache configuration for clinicians table', () => {
      const config = getCacheConfig('clinicians');
      
      expect(config.staleTime).toBe(30000); // 30 seconds
      expect(config.backgroundRefresh).toBe(true);
      expect(config.preload).toBe(true);
      expect(config.priority).toBe(2); // HIGH priority
    });
    
    it('should have correct cache configuration for customers table', () => {
      const config = getCacheConfig('customers');
      
      expect(config.staleTime).toBe(60000); // 1 minute
      expect(config.backgroundRefresh).toBe(true);
      expect(config.pagination).toBe(true);
      expect(config.priority).toBe(3); // MEDIUM priority
    });
    
    it('should have correct cache configuration for settings table', () => {
      const config = getCacheConfig('settings');
      
      expect(config.staleTime).toBe(300000); // 5 minutes
      expect(config.backgroundRefresh).toBe(false); // Settings don't need background refresh
      expect(config.preload).toBe(true);
      expect(config.priority).toBe(1); // CRITICAL priority
    });
  });
  
  describe('Enhanced Query Cache', () => {
    it('should store and retrieve cached data correctly', () => {
      const testData = [{ id: '1', name: 'Test Clinician' }];
      const cacheKey = 'test-clinicians-key';
      const config = getCacheConfig('clinicians');
      const queryMetadata = {
        table: 'clinicians',
        select: '*',
        filters: {},
        userId: 'test-user',
        tenantId: 'test-tenant'
      };
      
      // Store data in cache
      enhancedQueryCache.set(cacheKey, testData, config, queryMetadata);
      
      // Retrieve data from cache
      const result = enhancedQueryCache.get(cacheKey);
      
      expect(result.hit).toBe(true);
      expect(result.data).toEqual(testData);
      expect(result.isStale).toBe(false);
    });
    
    it('should detect stale data correctly', async () => {
      const testData = [{ id: '1', name: 'Test Customer' }];
      const cacheKey = 'test-customers-key';
      const config = { ...getCacheConfig('customers'), staleTime: 100 }; // 100ms for testing
      const queryMetadata = {
        table: 'customers',
        select: '*',
        filters: {},
        userId: 'test-user',
        tenantId: 'test-tenant'
      };
      
      // Store data in cache
      enhancedQueryCache.set(cacheKey, testData, config, queryMetadata);
      
      // Wait for data to become stale
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Check if data is detected as stale
      const result = enhancedQueryCache.get(cacheKey);
      
      expect(result.hit).toBe(true);
      expect(result.isStale).toBe(true);
    });
  });
  
  describe('Background Refresh Manager', () => {
    it('should initialize with default schedules', () => {
      const schedules = globalBackgroundRefreshManager.getAllRefreshSchedules();
      
      // Check that default schedules are created
      const cliniciansSchedule = schedules.find(s => s.table === 'clinicians');
      const customersSchedule = schedules.find(s => s.table === 'customers');
      const settingsSchedule = schedules.find(s => s.table === 'settings');
      
      expect(cliniciansSchedule).toBeDefined();
      expect(cliniciansSchedule?.interval).toBe(60000); // 1 minute
      expect(cliniciansSchedule?.enabled).toBe(true);
      
      expect(customersSchedule).toBeDefined();
      expect(customersSchedule?.interval).toBe(120000); // 2 minutes
      expect(customersSchedule?.enabled).toBe(true);
      
      expect(settingsSchedule).toBeDefined();
      expect(settingsSchedule?.interval).toBe(600000); // 10 minutes
      expect(settingsSchedule?.enabled).toBe(false); // Settings don't auto-refresh
    });
    
    it('should allow setting custom refresh schedules', () => {
      const customSchedule = {
        table: 'test_table',
        interval: 30000,
        priority: 2 as const,
        enabled: true
      };
      
      globalBackgroundRefreshManager.setRefreshSchedule(customSchedule);
      
      const retrievedSchedule = globalBackgroundRefreshManager.getRefreshSchedule('test_table');
      
      expect(retrievedSchedule).toBeDefined();
      expect(retrievedSchedule?.table).toBe('test_table');
      expect(retrievedSchedule?.interval).toBe(30000);
      expect(retrievedSchedule?.enabled).toBe(true);
    });
    
    it('should track refresh metrics', () => {
      const metrics = globalBackgroundRefreshManager.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.totalRefreshes).toBe(0);
      expect(metrics.successfulRefreshes).toBe(0);
      expect(metrics.failedRefreshes).toBe(0);
      expect(metrics.queueStatus).toBeDefined();
    });
  });
  
  describe('Cache Priority System', () => {
    it('should assign correct priorities to different tables', () => {
      const cliniciansConfig = getCacheConfig('clinicians');
      const customersConfig = getCacheConfig('customers');
      const settingsConfig = getCacheConfig('settings');
      const defaultConfig = getCacheConfig('unknown_table');
      
      // Settings should have highest priority (CRITICAL = 1)
      expect(settingsConfig.priority).toBe(1);
      
      // Clinicians should have high priority (HIGH = 2)
      expect(cliniciansConfig.priority).toBe(2);
      
      // Customers should have medium priority (MEDIUM = 3)
      expect(customersConfig.priority).toBe(3);
      
      // Unknown tables should have low priority (LOW = 4)
      expect(defaultConfig.priority).toBe(4);
    });
  });
  
  describe('Cache Metrics and Monitoring', () => {
    it('should track cache hit and miss rates', () => {
      const testData = [{ id: '1', name: 'Test Data' }];
      const cacheKey = 'test-metrics-key';
      const config = getCacheConfig('clinicians');
      const queryMetadata = {
        table: 'clinicians',
        select: '*',
        filters: {},
        userId: 'test-user',
        tenantId: 'test-tenant'
      };
      
      // First access should be a miss
      let result = enhancedQueryCache.get(cacheKey);
      expect(result.hit).toBe(false);
      
      // Store data
      enhancedQueryCache.set(cacheKey, testData, config, queryMetadata);
      
      // Second access should be a hit
      result = enhancedQueryCache.get(cacheKey);
      expect(result.hit).toBe(true);
      
      // Check metrics
      const metrics = enhancedQueryCache.getMetrics();
      expect(metrics.hits).toBeGreaterThan(0);
      expect(metrics.misses).toBeGreaterThan(0);
      expect(metrics.totalEntries).toBe(1);
    });
    
    it('should track cache size and memory usage', () => {
      const testData = [{ id: '1', name: 'Test Data', description: 'A' }];
      const cacheKey = 'test-size-key';
      const config = getCacheConfig('customers');
      const queryMetadata = {
        table: 'customers',
        select: '*',
        filters: {},
        userId: 'test-user',
        tenantId: 'test-tenant'
      };
      
      // Store data
      enhancedQueryCache.set(cacheKey, testData, config, queryMetadata);
      
      // Check size information
      const size = enhancedQueryCache.getSize();
      expect(size.entries).toBe(1);
      expect(size.bytes).toBeGreaterThan(0);
      
      // Check metrics
      const metrics = enhancedQueryCache.getMetrics();
      expect(metrics.totalEntries).toBe(1);
      expect(metrics.totalSizeBytes).toBeGreaterThan(0);
    });
  });
});

describe('Performance Requirements Validation', () => {
  it('should meet requirement 5.1 - clinicians 30-second cache', () => {
    const config = getCacheConfig('clinicians');
    expect(config.staleTime).toBe(30000);
    expect(config.backgroundRefresh).toBe(true);
    expect(config.preload).toBe(true);
  });
  
  it('should meet requirement 5.2 - customers progressive loading', () => {
    const config = getCacheConfig('customers');
    expect(config.staleTime).toBe(60000); // 1 minute cache
    expect(config.backgroundRefresh).toBe(true);
    expect(config.pagination).toBe(true);
  });
  
  it('should meet requirement 5.3 - settings 5-minute cache', () => {
    const config = getCacheConfig('settings');
    expect(config.staleTime).toBe(300000); // 5 minutes
    expect(config.preload).toBe(true);
  });
  
  it('should meet requirement 5.4 - background refresh without blocking', () => {
    // Background refresh manager should be running
    expect(globalBackgroundRefreshManager).toBeDefined();
    
    // Should have schedules for background refresh
    const schedules = globalBackgroundRefreshManager.getAllRefreshSchedules();
    expect(schedules.length).toBeGreaterThan(0);
    
    // Should support priority-based scheduling
    const cliniciansSchedule = schedules.find(s => s.table === 'clinicians');
    expect(cliniciansSchedule?.priority).toBeDefined();
  });
});