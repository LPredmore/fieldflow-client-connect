/**
 * Table-Specific Cache Strategies
 * 
 * Defines optimized caching configurations for different database tables
 * based on their usage patterns, update frequency, and business importance.
 */

import { CacheConfig, CachePriority } from './enhancedQueryCache';

/**
 * Cache strategies for different database tables
 * Optimized based on:
 * - Data update frequency
 * - Query patterns
 * - Business criticality
 * - User access patterns
 */
export const CACHE_STRATEGIES: Record<string, CacheConfig> = {
  // Authentication and user management (highest priority)
  profiles: {
    staleTime: 60000,        // 1 minute - user data changes occasionally
    maxAge: 300000,          // 5 minutes max age
    priority: CachePriority.HIGH,
    backgroundRefresh: true,
    preload: true,           // Preload on authentication
    userSpecific: true
  },

  // Settings and configuration (critical for app functionality)
  settings: {
    staleTime: 300000,       // 5 minutes - settings change infrequently
    maxAge: 1800000,         // 30 minutes max age
    priority: CachePriority.CRITICAL,
    backgroundRefresh: false, // Settings don't need background refresh
    preload: true            // Preload during app initialization
  },

  // Business entities - high usage, moderate update frequency
  clinicians: {
    staleTime: 30000,        // 30 seconds - clinician data accessed frequently
    maxAge: 300000,          // 5 minutes max age
    priority: CachePriority.HIGH,
    backgroundRefresh: true,
    preload: true,           // Preload on authentication for quick access
    userSpecific: false
  },

  customers: {
    staleTime: 60000,        // 1 minute - customer data changes less frequently
    maxAge: 600000,          // 10 minutes max age
    priority: CachePriority.MEDIUM,
    backgroundRefresh: true,
    pagination: true,        // Support progressive loading for large datasets
    userSpecific: false
  },

  // Operational data - medium priority
  appointments: {
    staleTime: 30000,        // 30 seconds - appointments change frequently
    maxAge: 180000,          // 3 minutes max age
    priority: CachePriority.MEDIUM,
    backgroundRefresh: true,
    userSpecific: true       // Usually user/clinician specific
  },

  treatments: {
    staleTime: 120000,       // 2 minutes - treatment data is relatively stable
    maxAge: 600000,          // 10 minutes max age
    priority: CachePriority.MEDIUM,
    backgroundRefresh: true,
    userSpecific: false
  },

  // Reference data - low update frequency
  treatment_approaches: {
    staleTime: 600000,       // 10 minutes - reference data changes rarely
    maxAge: 3600000,         // 1 hour max age
    priority: CachePriority.HIGH, // High priority due to frequent access
    backgroundRefresh: false,
    preload: true            // Preload reference data
  },

  // Analytics and reporting - lower priority
  analytics: {
    staleTime: 300000,       // 5 minutes - analytics can be slightly stale
    maxAge: 1800000,         // 30 minutes max age
    priority: CachePriority.LOW,
    backgroundRefresh: false,
    userSpecific: true
  },

  logs: {
    staleTime: 600000,       // 10 minutes - logs are historical
    maxAge: 3600000,         // 1 hour max age
    priority: CachePriority.LOW,
    backgroundRefresh: false,
    userSpecific: false
  },

  // Default configuration for unknown tables
  default: {
    staleTime: 5000,         // 5 seconds default
    maxAge: 60000,           // 1 minute max age
    priority: CachePriority.LOW,
    backgroundRefresh: false,
    userSpecific: false
  }
};

/**
 * Get cache configuration for a specific table
 */
export function getCacheConfig(table: string): CacheConfig {
  return CACHE_STRATEGIES[table] || CACHE_STRATEGIES.default;
}

/**
 * Cache access tracking for intelligent eviction
 */
export class CacheAccessTracker {
  private accessPatterns = new Map<string, AccessPattern>();
  private readonly maxPatternHistory = 1000;

  /**
   * Record cache access for pattern analysis
   */
  recordAccess(cacheKey: string, table: string, hit: boolean): void {
    const pattern = this.accessPatterns.get(cacheKey) || {
      table,
      totalAccesses: 0,
      hits: 0,
      misses: 0,
      lastAccessed: 0,
      accessFrequency: 0,
      recentAccesses: []
    };

    pattern.totalAccesses++;
    pattern.lastAccessed = Date.now();
    
    if (hit) {
      pattern.hits++;
    } else {
      pattern.misses++;
    }

    // Track recent access times for frequency calculation
    pattern.recentAccesses.push(Date.now());
    if (pattern.recentAccesses.length > 10) {
      pattern.recentAccesses.shift();
    }

    // Calculate access frequency (accesses per minute)
    if (pattern.recentAccesses.length > 1) {
      const timeSpan = pattern.recentAccesses[pattern.recentAccesses.length - 1] - 
                      pattern.recentAccesses[0];
      pattern.accessFrequency = (pattern.recentAccesses.length - 1) / (timeSpan / 60000);
    }

    this.accessPatterns.set(cacheKey, pattern);

    // Cleanup old patterns to prevent memory growth
    if (this.accessPatterns.size > this.maxPatternHistory) {
      this.cleanupOldPatterns();
    }
  }

  /**
   * Get access pattern for a cache key
   */
  getAccessPattern(cacheKey: string): AccessPattern | undefined {
    return this.accessPatterns.get(cacheKey);
  }

  /**
   * Get cache priority based on access patterns
   */
  calculateDynamicPriority(cacheKey: string, basePriority: CachePriority): CachePriority {
    const pattern = this.accessPatterns.get(cacheKey);
    if (!pattern) {
      return basePriority;
    }

    // Boost priority for frequently accessed items
    if (pattern.accessFrequency > 5) { // More than 5 accesses per minute
      return Math.max(1, basePriority - 1) as CachePriority;
    }

    // Lower priority for rarely accessed items
    if (pattern.accessFrequency < 0.1 && pattern.totalAccesses > 5) {
      return Math.min(4, basePriority + 1) as CachePriority;
    }

    return basePriority;
  }

  /**
   * Get eviction candidates based on access patterns
   */
  getEvictionCandidates(maxCandidates = 10): string[] {
    const now = Date.now();
    const candidates = Array.from(this.accessPatterns.entries())
      .map(([key, pattern]) => ({
        key,
        score: this.calculateEvictionScore(pattern, now)
      }))
      .sort((a, b) => b.score - a.score) // Higher score = better eviction candidate
      .slice(0, maxCandidates)
      .map(candidate => candidate.key);

    return candidates;
  }

  private calculateEvictionScore(pattern: AccessPattern, now: number): number {
    const timeSinceLastAccess = now - pattern.lastAccessed;
    const hitRate = pattern.totalAccesses > 0 ? pattern.hits / pattern.totalAccesses : 0;
    
    // Higher score means better candidate for eviction
    let score = 0;
    
    // Factor 1: Time since last access (older = higher score)
    score += timeSinceLastAccess / 60000; // Convert to minutes
    
    // Factor 2: Low hit rate (lower hit rate = higher score)
    score += (1 - hitRate) * 10;
    
    // Factor 3: Low access frequency (lower frequency = higher score)
    score += Math.max(0, 5 - pattern.accessFrequency);
    
    return score;
  }

  private cleanupOldPatterns(): void {
    const now = Date.now();
    const cutoffTime = now - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [key, pattern] of this.accessPatterns.entries()) {
      if (pattern.lastAccessed < cutoffTime) {
        this.accessPatterns.delete(key);
      }
    }
  }
}

interface AccessPattern {
  table: string;
  totalAccesses: number;
  hits: number;
  misses: number;
  lastAccessed: number;
  accessFrequency: number; // Accesses per minute
  recentAccesses: number[]; // Recent access timestamps
}

/**
 * Background refresh queue manager
 */
export class BackgroundRefreshQueue {
  private queue = new Map<string, RefreshTask>();
  private processing = false;
  private readonly maxConcurrentRefreshes = 3;
  private activeRefreshes = new Set<string>();

  /**
   * Add a refresh task to the queue
   */
  enqueue(
    cacheKey: string,
    table: string,
    priority: CachePriority,
    refreshFunction: () => Promise<unknown[]>
  ): void {
    const task: RefreshTask = {
      cacheKey,
      table,
      priority,
      refreshFunction,
      enqueuedAt: Date.now(),
      attempts: 0
    };

    this.queue.set(cacheKey, task);
    
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Remove a task from the queue
   */
  dequeue(cacheKey: string): void {
    this.queue.delete(cacheKey);
    this.activeRefreshes.delete(cacheKey);
  }

  /**
   * Get queue status
   */
  getStatus(): QueueStatus {
    return {
      queueSize: this.queue.size,
      activeRefreshes: this.activeRefreshes.size,
      processing: this.processing
    };
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;
    
    try {
      while (this.queue.size > 0 && this.activeRefreshes.size < this.maxConcurrentRefreshes) {
        const nextTask = this.getNextTask();
        if (!nextTask) break;
        
        this.activeRefreshes.add(nextTask.cacheKey);
        this.queue.delete(nextTask.cacheKey);
        
        // Process task asynchronously
        this.processTask(nextTask).finally(() => {
          this.activeRefreshes.delete(nextTask.cacheKey);
        });
      }
    } finally {
      this.processing = false;
      
      // Continue processing if there are more tasks
      if (this.queue.size > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  private getNextTask(): RefreshTask | null {
    if (this.queue.size === 0) return null;
    
    // Sort by priority (lower number = higher priority) and enqueue time
    const tasks = Array.from(this.queue.values()).sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.enqueuedAt - b.enqueuedAt;
    });
    
    return tasks[0];
  }

  private async processTask(task: RefreshTask): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Processing background refresh for ${task.table} (${task.cacheKey})`);
      
      await task.refreshFunction();
      
      const duration = Date.now() - startTime;
      console.log(`✅ Background refresh completed for ${task.table} in ${duration}ms`);
      
    } catch (error) {
      task.attempts++;
      const duration = Date.now() - startTime;
      
      console.error(`❌ Background refresh failed for ${task.table} (attempt ${task.attempts}) after ${duration}ms:`, error);
      
      // Retry with exponential backoff for retryable errors
      if (task.attempts < 3 && this.isRetryableError(error)) {
        const delay = Math.pow(2, task.attempts) * 1000; // 2s, 4s, 8s
        setTimeout(() => {
          this.queue.set(task.cacheKey, task);
          this.processQueue();
        }, delay);
      }
    }
  }

  private isRetryableError(error: unknown): boolean {
    // Network errors, timeouts, and temporary server errors are retryable
    if (error instanceof Error) {
      return error.name === 'NetworkError' || 
             error.message?.includes('timeout') ||
             error.message?.includes('503') ||
             error.message?.includes('502');
    }
    return false;
  }
}

interface RefreshTask {
  cacheKey: string;
  table: string;
  priority: CachePriority;
  refreshFunction: () => Promise<unknown[]>;
  enqueuedAt: number;
  attempts: number;
}

interface QueueStatus {
  queueSize: number;
  activeRefreshes: number;
  processing: boolean;
}

// Global instances
export const cacheAccessTracker = new CacheAccessTracker();
export const backgroundRefreshQueue = new BackgroundRefreshQueue();