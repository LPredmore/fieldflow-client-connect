/**
 * Enhanced Query Cache System
 * 
 * Provides intelligent caching with table-specific configurations,
 * background refresh capabilities, and comprehensive metrics tracking.
 */

export interface EnhancedCacheEntry<T = unknown> {
  /** The cached data */
  data: T[];
  /** Timestamp when data was cached */
  timestamp: number;
  /** Time in ms after which data is considered stale */
  staleTime: number;
  /** Cache priority level for eviction strategies */
  priority: CachePriority;
  /** Promise for background refresh operation */
  backgroundRefreshPromise?: Promise<T[]>;
  /** Number of times this cache entry has been accessed */
  accessCount: number;
  /** Timestamp of last access for LRU eviction */
  lastAccessed: number;
  /** Size of the cached data in bytes (estimated) */
  sizeBytes: number;
  /** Whether this entry is currently being refreshed in background */
  isRefreshing: boolean;
  /** Metadata about the query that created this cache entry */
  queryMetadata: QueryMetadata;
}

export interface QueryMetadata {
  /** Database table name */
  table: string;
  /** Select clause used */
  select: string;
  /** Filters applied to the query */
  filters: Record<string, unknown>;
  /** Order by clause */
  orderBy?: { column: string; ascending?: boolean };
  /** User ID who made the query */
  userId: string;
  /** Tenant ID for multi-tenant queries */
  tenantId?: string;
}

export enum CachePriority {
  CRITICAL = 1,  // Settings, authentication data
  HIGH = 2,      // User profiles, permissions
  MEDIUM = 3,    // Business data (customers, clinicians)
  LOW = 4        // Analytics, logs, temporary data
}

export interface CacheConfig {
  /** Time in ms after which data is considered stale */
  staleTime: number;
  /** Maximum age in ms before forced eviction */
  maxAge: number;
  /** Cache priority for eviction strategies */
  priority: CachePriority;
  /** Whether to enable background refresh when stale */
  backgroundRefresh: boolean;
  /** Whether to preload this data during authentication */
  preload?: boolean;
  /** Whether this data supports pagination */
  pagination?: boolean;
  /** Whether this data is user-specific */
  userSpecific?: boolean;
}

export interface CacheMetrics {
  /** Total number of cache entries */
  totalEntries: number;
  /** Total memory usage in bytes */
  totalSizeBytes: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Cache miss rate (0-1) */
  missRate: number;
  /** Number of cache hits in current session */
  hits: number;
  /** Number of cache misses in current session */
  misses: number;
  /** Number of background refreshes performed */
  backgroundRefreshes: number;
  /** Number of cache evictions performed */
  evictions: number;
  /** Average cache entry age in ms */
  averageAge: number;
  /** Number of stale entries currently in cache */
  staleEntries: number;
  /** Cache efficiency metrics by table */
  tableMetrics: Record<string, TableCacheMetrics>;
  /** Performance metrics */
  performance: CachePerformanceMetrics;
}

export interface TableCacheMetrics {
  /** Table name */
  table: string;
  /** Number of entries for this table */
  entries: number;
  /** Hit rate for this table */
  hitRate: number;
  /** Average query time for cache hits */
  avgHitTime: number;
  /** Average query time for cache misses */
  avgMissTime: number;
  /** Total size of cached data for this table */
  sizeBytes: number;
}

export interface CachePerformanceMetrics {
  /** Average time to retrieve from cache (ms) */
  avgRetrievalTime: number;
  /** Average time to store in cache (ms) */
  avgStorageTime: number;
  /** Average time for background refresh (ms) */
  avgBackgroundRefreshTime: number;
  /** Number of cache operations per second */
  operationsPerSecond: number;
  /** Memory efficiency (data size / total memory used) */
  memoryEfficiency: number;
}

export interface CacheResult<T> {
  /** The cached data, if available */
  data?: T[];
  /** Whether data was found in cache */
  hit: boolean;
  /** Whether the cached data is stale */
  isStale: boolean;
  /** Age of the cached data in ms */
  age?: number;
  /** Whether background refresh is in progress */
  isRefreshing: boolean;
  /** Cache entry metadata */
  metadata?: QueryMetadata;
}

export interface EvictionStrategy {
  /** Name of the eviction strategy */
  name: string;
  /** Function to determine which entries to evict */
  selectForEviction: (entries: Map<string, EnhancedCacheEntry>) => string[];
  /** Maximum number of entries to evict at once */
  maxEvictionsPerRun: number;
}

/**
 * Enhanced Query Cache Manager
 * 
 * Provides intelligent caching with table-specific configurations,
 * automatic eviction strategies, and comprehensive performance monitoring.
 */
export class EnhancedQueryCache {
  private cache = new Map<string, EnhancedCacheEntry>();
  private metrics: CacheMetrics;
  private backgroundRefreshQueue = new Set<string>();
  private evictionStrategies: EvictionStrategy[];
  private maxCacheSize: number;
  private maxMemoryUsage: number; // in bytes
  
  constructor(
    maxCacheSize = 1000,
    maxMemoryUsage = 50 * 1024 * 1024 // 50MB default
  ) {
    this.maxCacheSize = maxCacheSize;
    this.maxMemoryUsage = maxMemoryUsage;
    this.metrics = this.initializeMetrics();
    this.evictionStrategies = this.initializeEvictionStrategies();
    
    // Start background cleanup process
    this.startBackgroundCleanup();
  }

  /**
   * Retrieve data from cache
   */
  get<T>(key: string): CacheResult<T> {
    const startTime = performance.now();
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.metrics.misses++;
      this.updateMetrics();
      return {
        hit: false,
        isStale: false,
        isRefreshing: false
      };
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    const age = Date.now() - entry.timestamp;
    const isStale = age > entry.staleTime;
    
    this.metrics.hits++;
    this.metrics.performance.avgRetrievalTime = this.updateAverage(
      this.metrics.performance.avgRetrievalTime,
      performance.now() - startTime,
      this.metrics.hits
    );
    
    this.updateMetrics();
    
    return {
      data: entry.data as T[],
      hit: true,
      isStale,
      age,
      isRefreshing: entry.isRefreshing,
      metadata: entry.queryMetadata
    };
  }

  /**
   * Store data in cache with configuration
   */
  set<T>(
    key: string, 
    data: T[], 
    config: CacheConfig,
    queryMetadata: QueryMetadata
  ): void {
    const startTime = performance.now();
    const now = Date.now();
    
    // Estimate data size
    const sizeBytes = this.estimateDataSize(data);
    
    // Check if we need to evict entries before adding new one
    this.enforceMemoryLimits(sizeBytes);
    
    const entry: EnhancedCacheEntry<T> = {
      data,
      timestamp: now,
      staleTime: config.staleTime,
      priority: config.priority,
      accessCount: 1,
      lastAccessed: now,
      sizeBytes,
      isRefreshing: false,
      queryMetadata
    };
    
    this.cache.set(key, entry);
    
    // Update metrics
    this.metrics.performance.avgStorageTime = this.updateAverage(
      this.metrics.performance.avgStorageTime,
      performance.now() - startTime,
      this.cache.size
    );
    
    this.updateMetrics();
    
    console.log(`💾 Enhanced cache SET: ${key} (${sizeBytes} bytes, priority: ${config.priority})`);
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidate(pattern: string): number {
    let invalidatedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.matchesPattern(key, pattern)) {
        // Cancel background refresh if in progress
        if (entry.backgroundRefreshPromise) {
          this.backgroundRefreshQueue.delete(key);
        }
        
        this.cache.delete(key);
        invalidatedCount++;
      }
    }
    
    this.updateMetrics();
    console.log(`🗑️ Enhanced cache INVALIDATED: ${invalidatedCount} entries matching "${pattern}"`);
    
    return invalidatedCount;
  }

  /**
   * Start background refresh for a cache entry
   */
  async startBackgroundRefresh<T>(
    key: string,
    refreshFunction: () => Promise<T[]>
  ): Promise<void> {
    const entry = this.cache.get(key);
    if (!entry || entry.isRefreshing) {
      return;
    }

    entry.isRefreshing = true;
    this.backgroundRefreshQueue.add(key);
    
    const startTime = performance.now();
    
    try {
      console.log(`🔄 Starting background refresh for: ${key}`);
      
      const refreshPromise = refreshFunction();
      entry.backgroundRefreshPromise = refreshPromise;
      
      const freshData = await refreshPromise;
      
      // Update the cache entry with fresh data
      if (this.cache.has(key)) { // Check if entry still exists
        const updatedEntry = this.cache.get(key)!;
        updatedEntry.data = freshData;
        updatedEntry.timestamp = Date.now();
        updatedEntry.isRefreshing = false;
        updatedEntry.backgroundRefreshPromise = undefined;
        
        this.metrics.backgroundRefreshes++;
        this.metrics.performance.avgBackgroundRefreshTime = this.updateAverage(
          this.metrics.performance.avgBackgroundRefreshTime,
          performance.now() - startTime,
          this.metrics.backgroundRefreshes
        );
        
        console.log(`✅ Background refresh completed for: ${key}`);
      }
    } catch (error) {
      console.error(`❌ Background refresh failed for: ${key}`, error);
      
      // Reset refresh state on error
      if (this.cache.has(key)) {
        const failedEntry = this.cache.get(key)!;
        failedEntry.isRefreshing = false;
        failedEntry.backgroundRefreshPromise = undefined;
      }
    } finally {
      this.backgroundRefreshQueue.delete(key);
    }
  }

  /**
   * Get comprehensive cache metrics
   */
  getMetrics(): CacheMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.backgroundRefreshQueue.clear();
    this.metrics = this.initializeMetrics();
    console.log(`🗑️ Enhanced cache CLEARED`);
  }

  /**
   * Get cache size information
   */
  getSize(): { entries: number; bytes: number } {
    let totalBytes = 0;
    for (const entry of this.cache.values()) {
      totalBytes += entry.sizeBytes;
    }
    
    return {
      entries: this.cache.size,
      bytes: totalBytes
    };
  }

  // Private helper methods

  private initializeMetrics(): CacheMetrics {
    return {
      totalEntries: 0,
      totalSizeBytes: 0,
      hitRate: 0,
      missRate: 0,
      hits: 0,
      misses: 0,
      backgroundRefreshes: 0,
      evictions: 0,
      averageAge: 0,
      staleEntries: 0,
      tableMetrics: {},
      performance: {
        avgRetrievalTime: 0,
        avgStorageTime: 0,
        avgBackgroundRefreshTime: 0,
        operationsPerSecond: 0,
        memoryEfficiency: 0
      }
    };
  }

  private initializeEvictionStrategies(): EvictionStrategy[] {
    return [
      {
        name: 'LRU_LOW_PRIORITY',
        selectForEviction: (entries) => this.selectLRULowPriority(entries),
        maxEvictionsPerRun: 10
      },
      {
        name: 'EXPIRED_ENTRIES',
        selectForEviction: (entries) => this.selectExpiredEntries(entries),
        maxEvictionsPerRun: 50
      },
      {
        name: 'LARGE_UNUSED_ENTRIES',
        selectForEviction: (entries) => this.selectLargeUnusedEntries(entries),
        maxEvictionsPerRun: 5
      }
    ];
  }

  private updateMetrics(): void {
    const now = Date.now();
    let totalSize = 0;
    let staleCount = 0;
    let totalAge = 0;
    const tableStats: Record<string, { entries: number; size: number }> = {};

    for (const [key, entry] of this.cache.entries()) {
      totalSize += entry.sizeBytes;
      totalAge += (now - entry.timestamp);
      
      if (now - entry.timestamp > entry.staleTime) {
        staleCount++;
      }
      
      const table = entry.queryMetadata.table;
      if (!tableStats[table]) {
        tableStats[table] = { entries: 0, size: 0 };
      }
      tableStats[table].entries++;
      tableStats[table].size += entry.sizeBytes;
    }

    this.metrics.totalEntries = this.cache.size;
    this.metrics.totalSizeBytes = totalSize;
    this.metrics.staleEntries = staleCount;
    this.metrics.averageAge = this.cache.size > 0 ? totalAge / this.cache.size : 0;
    
    const totalRequests = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = totalRequests > 0 ? this.metrics.hits / totalRequests : 0;
    this.metrics.missRate = totalRequests > 0 ? this.metrics.misses / totalRequests : 0;
    
    this.metrics.performance.memoryEfficiency = totalSize > 0 ? 
      this.calculateDataSize() / totalSize : 0;

    // Update table metrics
    for (const [table, stats] of Object.entries(tableStats)) {
      if (!this.metrics.tableMetrics[table]) {
        this.metrics.tableMetrics[table] = {
          table,
          entries: 0,
          hitRate: 0,
          avgHitTime: 0,
          avgMissTime: 0,
          sizeBytes: 0
        };
      }
      
      this.metrics.tableMetrics[table].entries = stats.entries;
      this.metrics.tableMetrics[table].sizeBytes = stats.size;
    }
  }

  private enforceMemoryLimits(newEntrySize: number): void {
    // Check if we need to evict based on memory usage
    const currentSize = this.getSize();
    const projectedSize = currentSize.bytes + newEntrySize;
    
    if (projectedSize > this.maxMemoryUsage || currentSize.entries >= this.maxCacheSize) {
      console.log(`🧹 Cache limits exceeded, starting eviction process`);
      this.performEviction();
    }
  }

  private performEviction(): void {
    for (const strategy of this.evictionStrategies) {
      const keysToEvict = strategy.selectForEviction(this.cache);
      
      if (keysToEvict.length > 0) {
        console.log(`🗑️ Evicting ${keysToEvict.length} entries using ${strategy.name}`);
        
        for (const key of keysToEvict.slice(0, strategy.maxEvictionsPerRun)) {
          this.cache.delete(key);
          this.backgroundRefreshQueue.delete(key);
          this.metrics.evictions++;
        }
        
        // Check if we've freed enough space
        const currentSize = this.getSize();
        if (currentSize.bytes < this.maxMemoryUsage * 0.8 && 
            currentSize.entries < this.maxCacheSize * 0.8) {
          break;
        }
      }
    }
  }

  private selectLRULowPriority(entries: Map<string, EnhancedCacheEntry>): string[] {
    return Array.from(entries.entries())
      .filter(([_, entry]) => entry.priority >= CachePriority.MEDIUM)
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
      .map(([key]) => key);
  }

  private selectExpiredEntries(entries: Map<string, EnhancedCacheEntry>): string[] {
    const now = Date.now();
    return Array.from(entries.entries())
      .filter(([_, entry]) => now - entry.timestamp > entry.staleTime * 2)
      .map(([key]) => key);
  }

  private selectLargeUnusedEntries(entries: Map<string, EnhancedCacheEntry>): string[] {
    const now = Date.now();
    return Array.from(entries.entries())
      .filter(([_, entry]) => 
        entry.sizeBytes > 100000 && // > 100KB
        entry.accessCount < 3 &&
        now - entry.lastAccessed > 300000 // Not accessed in 5 minutes
      )
      .sort((a, b) => b[1].sizeBytes - a[1].sizeBytes)
      .map(([key]) => key);
  }

  private estimateDataSize(data: unknown[]): number {
    // Rough estimation of data size in bytes
    const jsonString = JSON.stringify(data);
    return new Blob([jsonString]).size;
  }

  private calculateDataSize(): number {
    let totalDataSize = 0;
    for (const entry of this.cache.values()) {
      totalDataSize += this.estimateDataSize(entry.data);
    }
    return totalDataSize;
  }

  private matchesPattern(key: string, pattern: string): boolean {
    // Simple pattern matching - can be enhanced with regex if needed
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\*/g, '.*');
      return new RegExp(regexPattern).test(key);
    }
    return key.includes(pattern);
  }

  private updateAverage(currentAvg: number, newValue: number, count: number): number {
    return ((currentAvg * (count - 1)) + newValue) / count;
  }

  private startBackgroundCleanup(): void {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.performEviction();
    }, 5 * 60 * 1000);
  }
}

// Global enhanced cache instance
export const enhancedQueryCache = new EnhancedQueryCache();