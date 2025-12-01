/**
 * Enhanced Background Refresh System
 * 
 * Implements task 7.4 requirements:
 * - Background refresh queue for stale cache entries
 * - Background refresh scheduling based on table priority
 * - Background refresh without blocking UI operations
 */

import { enhancedQueryCache, CachePriority } from './enhancedQueryCache';
import { getCacheConfig, backgroundRefreshQueue } from './cacheStrategies';
import { supabase } from '@/integrations/supabase/client';

export interface RefreshSchedule {
  /** Table name */
  table: string;
  /** Refresh interval in milliseconds */
  interval: number;
  /** Priority for scheduling */
  priority: CachePriority;
  /** Whether refresh is currently enabled */
  enabled: boolean;
  /** Last refresh timestamp */
  lastRefresh?: number;
  /** Next scheduled refresh timestamp */
  nextRefresh?: number;
}

export interface RefreshMetrics {
  /** Total refreshes completed */
  totalRefreshes: number;
  /** Successful refreshes */
  successfulRefreshes: number;
  /** Failed refreshes */
  failedRefreshes: number;
  /** Average refresh duration */
  averageRefreshTime: number;
  /** Refreshes by table */
  tableMetrics: Record<string, TableRefreshMetrics>;
  /** Current queue status */
  queueStatus: {
    pending: number;
    active: number;
    processing: boolean;
  };
}

export interface TableRefreshMetrics {
  table: string;
  refreshCount: number;
  successRate: number;
  averageTime: number;
  lastRefresh?: number;
  nextScheduled?: number;
}

export interface RefreshConfiguration {
  /** Maximum concurrent refreshes */
  maxConcurrentRefreshes: number;
  /** Refresh retry attempts */
  maxRetryAttempts: number;
  /** Base retry delay in ms */
  baseRetryDelay: number;
  /** Whether to enable automatic scheduling */
  enableAutoScheduling: boolean;
  /** Minimum interval between refreshes for same table */
  minRefreshInterval: number;
}

/**
 * Enhanced Background Refresh Manager
 * 
 * Provides intelligent background refresh scheduling and execution
 * without blocking UI operations.
 */
export class EnhancedBackgroundRefreshManager {
  private schedules = new Map<string, RefreshSchedule>();
  private metrics: RefreshMetrics;
  private config: RefreshConfiguration;
  private schedulerInterval?: NodeJS.Timeout;
  private isRunning = false;
  
  constructor(config: Partial<RefreshConfiguration> = {}) {
    this.config = {
      maxConcurrentRefreshes: 3,
      maxRetryAttempts: 3,
      baseRetryDelay: 2000,
      enableAutoScheduling: true,
      minRefreshInterval: 30000, // 30 seconds minimum
      ...config
    };
    
    this.metrics = this.initializeMetrics();
    this.initializeDefaultSchedules();
  }
  
  /**
   * Start the background refresh system
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🚀 Starting Enhanced Background Refresh Manager');
    
    if (this.config.enableAutoScheduling) {
      this.startScheduler();
    }
  }
  
  /**
   * Stop the background refresh system
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    console.log('🛑 Stopping Enhanced Background Refresh Manager');
    
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = undefined;
    }
  }
  
  /**
   * Schedule a background refresh for a specific cache entry
   */
  scheduleRefresh(
    cacheKey: string,
    table: string,
    refreshFunction: () => Promise<unknown[]>,
    priority: CachePriority = CachePriority.MEDIUM
  ): void {
    if (!this.isRunning) {
      console.warn('Background refresh manager is not running');
      return;
    }
    
    const now = Date.now();
    const schedule = this.schedules.get(table);
    
    // Check if we should throttle this refresh
    if (schedule?.lastRefresh && 
        (now - schedule.lastRefresh) < this.config.minRefreshInterval) {
      console.log(`⏳ Throttling refresh for ${table} - too soon since last refresh`);
      return;
    }
    
    console.log(`📅 Scheduling background refresh for ${table} (priority: ${priority})`);
    
    // Add to background refresh queue
    backgroundRefreshQueue.enqueue(cacheKey, table, priority, async () => {
      const startTime = Date.now();
      
      try {
        const result = await refreshFunction();
        
        // Update metrics
        this.updateRefreshMetrics(table, true, Date.now() - startTime);
        
        // Update schedule
        if (schedule) {
          schedule.lastRefresh = now;
          schedule.nextRefresh = now + schedule.interval;
        }
        
        console.log(`✅ Background refresh completed for ${table}`);
        return result;
        
      } catch (error) {
        // Update metrics
        this.updateRefreshMetrics(table, false, Date.now() - startTime);
        
        console.error(`❌ Background refresh failed for ${table}:`, error);
        throw error;
      }
    });
  }
  
  /**
   * Add or update a refresh schedule for a table
   */
  setRefreshSchedule(schedule: RefreshSchedule): void {
    this.schedules.set(schedule.table, {
      ...schedule,
      nextRefresh: schedule.nextRefresh || Date.now() + schedule.interval
    });
    
    console.log(`📋 Set refresh schedule for ${schedule.table}: ${schedule.interval}ms interval`);
  }
  
  /**
   * Remove a refresh schedule for a table
   */
  removeRefreshSchedule(table: string): void {
    this.schedules.delete(table);
    console.log(`🗑️ Removed refresh schedule for ${table}`);
  }
  
  /**
   * Get current refresh metrics
   */
  getMetrics(): RefreshMetrics {
    // Update queue status
    const queueStatus = backgroundRefreshQueue.getStatus();
    this.metrics.queueStatus = {
      pending: queueStatus.queueSize,
      active: queueStatus.activeRefreshes,
      processing: queueStatus.processing
    };
    
    return { ...this.metrics };
  }
  
  /**
   * Get refresh schedule for a table
   */
  getRefreshSchedule(table: string): RefreshSchedule | undefined {
    return this.schedules.get(table);
  }
  
  /**
   * Get all refresh schedules
   */
  getAllRefreshSchedules(): RefreshSchedule[] {
    return Array.from(this.schedules.values());
  }
  
  /**
   * Trigger immediate refresh for stale cache entries
   */
  refreshStaleEntries(): void {
    if (!this.isRunning) return;
    
    console.log('🔍 Checking for stale cache entries to refresh');
    
    const cacheMetrics = enhancedQueryCache.getMetrics();
    let refreshCount = 0;
    
    // Check each table's cache entries
    for (const [table, tableMetrics] of Object.entries(cacheMetrics.tableMetrics)) {
      const cacheConfig = getCacheConfig(table);
      
      if (cacheConfig.backgroundRefresh && tableMetrics.entries > 0) {
        // This is a simplified check - in a real implementation, we'd need
        // access to individual cache entries to check staleness
        const schedule = this.schedules.get(table);
        const now = Date.now();
        
        if (schedule?.enabled && 
            schedule.nextRefresh && 
            now >= schedule.nextRefresh) {
          
          console.log(`🔄 Triggering scheduled refresh for ${table}`);
          
          // Create a generic refresh function for the table
          const refreshFunction = async () => {
            const { data, error } = await supabase
              .from(table)
              .select('*')
              .limit(100); // Limit to prevent large refreshes
            
            if (error) throw error;
            return data || [];
          };
          
          this.scheduleRefresh(
            `${table}-scheduled-refresh-${now}`,
            table,
            refreshFunction,
            cacheConfig.priority
          );
          
          refreshCount++;
        }
      }
    }
    
    if (refreshCount > 0) {
      console.log(`📊 Scheduled ${refreshCount} background refreshes for stale entries`);
    }
  }
  
  /**
   * Update configuration
   */
  updateConfiguration(newConfig: Partial<RefreshConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Updated background refresh configuration:', newConfig);
    
    // Restart scheduler if auto-scheduling setting changed
    if ('enableAutoScheduling' in newConfig) {
      if (this.schedulerInterval) {
        clearInterval(this.schedulerInterval);
        this.schedulerInterval = undefined;
      }
      
      if (newConfig.enableAutoScheduling && this.isRunning) {
        this.startScheduler();
      }
    }
  }
  
  // Private methods
  
  private initializeMetrics(): RefreshMetrics {
    return {
      totalRefreshes: 0,
      successfulRefreshes: 0,
      failedRefreshes: 0,
      averageRefreshTime: 0,
      tableMetrics: {},
      queueStatus: {
        pending: 0,
        active: 0,
        processing: false
      }
    };
  }
  
  private initializeDefaultSchedules(): void {
    // High priority tables - refresh more frequently
    this.setRefreshSchedule({
      table: 'clinicians',
      interval: 60000, // 1 minute
      priority: CachePriority.HIGH,
      enabled: true
    });
    
    this.setRefreshSchedule({
      table: 'customers',
      interval: 120000, // 2 minutes
      priority: CachePriority.MEDIUM,
      enabled: true
    });
    
    // Settings refresh less frequently
    this.setRefreshSchedule({
      table: 'settings',
      interval: 600000, // 10 minutes
      priority: CachePriority.CRITICAL,
      enabled: false // Settings don't need automatic refresh
    });
    
    // Treatment approaches - reference data
    this.setRefreshSchedule({
      table: 'treatment_approaches',
      interval: 1800000, // 30 minutes
      priority: CachePriority.HIGH,
      enabled: true
    });
    
    // Appointments - frequently changing
    this.setRefreshSchedule({
      table: 'appointments',
      interval: 30000, // 30 seconds
      priority: CachePriority.MEDIUM,
      enabled: true
    });
  }
  
  private startScheduler(): void {
    // Run scheduler every 30 seconds
    this.schedulerInterval = setInterval(() => {
      this.refreshStaleEntries();
    }, 30000);
    
    console.log('⏰ Background refresh scheduler started');
  }
  
  private updateRefreshMetrics(table: string, success: boolean, duration: number): void {
    this.metrics.totalRefreshes++;
    
    if (success) {
      this.metrics.successfulRefreshes++;
    } else {
      this.metrics.failedRefreshes++;
    }
    
    // Update average refresh time
    this.metrics.averageRefreshTime = 
      ((this.metrics.averageRefreshTime * (this.metrics.totalRefreshes - 1)) + duration) / 
      this.metrics.totalRefreshes;
    
    // Update table-specific metrics
    if (!this.metrics.tableMetrics[table]) {
      this.metrics.tableMetrics[table] = {
        table,
        refreshCount: 0,
        successRate: 0,
        averageTime: 0,
        lastRefresh: undefined,
        nextScheduled: undefined
      };
    }
    
    const tableMetrics = this.metrics.tableMetrics[table];
    tableMetrics.refreshCount++;
    tableMetrics.averageTime = 
      ((tableMetrics.averageTime * (tableMetrics.refreshCount - 1)) + duration) / 
      tableMetrics.refreshCount;
    tableMetrics.lastRefresh = Date.now();
    
    // Update success rate
    const tableSuccesses = success ? 1 : 0;
    tableMetrics.successRate = 
      ((tableMetrics.successRate * (tableMetrics.refreshCount - 1)) + tableSuccesses) / 
      tableMetrics.refreshCount;
    
    // Update next scheduled time
    const schedule = this.schedules.get(table);
    if (schedule) {
      tableMetrics.nextScheduled = schedule.nextRefresh;
    }
  }
}

/**
 * React hook for background refresh management
 */
import { useState, useEffect } from 'react';

export function useBackgroundRefreshManager() {
  const [manager] = useState(() => new EnhancedBackgroundRefreshManager());
  const [metrics, setMetrics] = useState<RefreshMetrics>();
  
  useEffect(() => {
    manager.start();
    
    // Update metrics periodically
    const metricsInterval = setInterval(() => {
      setMetrics(manager.getMetrics());
    }, 5000);
    
    return () => {
      manager.stop();
      clearInterval(metricsInterval);
    };
  }, [manager]);
  
  return {
    manager,
    metrics,
    scheduleRefresh: manager.scheduleRefresh.bind(manager),
    setRefreshSchedule: manager.setRefreshSchedule.bind(manager),
    removeRefreshSchedule: manager.removeRefreshSchedule.bind(manager),
    refreshStaleEntries: manager.refreshStaleEntries.bind(manager),
    updateConfiguration: manager.updateConfiguration.bind(manager)
  };
}

// Global background refresh manager instance
export const globalBackgroundRefreshManager = new EnhancedBackgroundRefreshManager();

// Auto-start the global manager
if (typeof window !== 'undefined') {
  globalBackgroundRefreshManager.start();
}