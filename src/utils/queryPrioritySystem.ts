/**
 * Query Priority System
 * 
 * Implements priority-based query execution with priority assignment
 * based on table type and user context.
 */

export enum QueryPriority {
  CRITICAL = 1,    // Auth, settings - must execute immediately
  HIGH = 2,        // User profile, permissions - high importance
  MEDIUM = 3,      // Business data (customers, clinicians) - normal priority
  LOW = 4          // Analytics, logs - can be delayed
}

export interface PriorityQuery {
  id: string;
  table: string;
  query: () => Promise<any>;
  priority: QueryPriority;
  timestamp: number;
  authRequired: boolean;
  userContext?: {
    userId: string;
    role: string;
    permissions: string[];
  };
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export interface QueryPriorityConfig {
  table: string;
  basePriority: QueryPriority;
  contextModifiers: {
    authRequired?: number;
    userRole?: Record<string, number>;
    timeOfDay?: Record<string, number>;
  };
}

/**
 * Priority Queue implementation for query execution ordering
 */
export class QueryPriorityQueue {
  private queue: PriorityQuery[] = [];
  private processing = false;

  /**
   * Add query to priority queue
   */
  enqueue(query: PriorityQuery): void {
    // Insert query in priority order (lower number = higher priority)
    let insertIndex = 0;
    while (
      insertIndex < this.queue.length && 
      this.queue[insertIndex].priority <= query.priority
    ) {
      insertIndex++;
    }
    
    this.queue.splice(insertIndex, 0, query);
  }

  /**
   * Remove and return highest priority query
   */
  dequeue(): PriorityQuery | undefined {
    return this.queue.shift();
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get queries by priority level
   */
  getQueriesByPriority(priority: QueryPriority): PriorityQuery[] {
    return this.queue.filter(q => q.priority === priority);
  }

  /**
   * Remove queries matching criteria
   */
  removeQueries(predicate: (query: PriorityQuery) => boolean): PriorityQuery[] {
    const removed: PriorityQuery[] = [];
    this.queue = this.queue.filter(query => {
      if (predicate(query)) {
        removed.push(query);
        return false;
      }
      return true;
    });
    return removed;
  }

  /**
   * Get queue status for monitoring
   */
  getQueueStatus(): {
    total: number;
    byPriority: Record<QueryPriority, number>;
    oldestQuery?: { age: number; priority: QueryPriority };
  } {
    const byPriority = {
      [QueryPriority.CRITICAL]: 0,
      [QueryPriority.HIGH]: 0,
      [QueryPriority.MEDIUM]: 0,
      [QueryPriority.LOW]: 0,
    };

    this.queue.forEach(query => {
      byPriority[query.priority]++;
    });

    const oldestQuery = this.queue.length > 0 ? {
      age: Date.now() - this.queue[this.queue.length - 1].timestamp,
      priority: this.queue[this.queue.length - 1].priority
    } : undefined;

    return {
      total: this.queue.length,
      byPriority,
      oldestQuery
    };
  }
}

/**
 * Query Priority Manager - assigns priorities based on table type and context
 */
export class QueryPriorityManager {
  private static instance: QueryPriorityManager;
  private priorityConfigs: Map<string, QueryPriorityConfig> = new Map();

  private constructor() {
    this.initializeDefaultConfigs();
  }

  static getInstance(): QueryPriorityManager {
    if (!QueryPriorityManager.instance) {
      QueryPriorityManager.instance = new QueryPriorityManager();
    }
    return QueryPriorityManager.instance;
  }

  /**
   * Initialize default priority configurations for tables
   */
  private initializeDefaultConfigs(): void {
    // Authentication and settings - CRITICAL priority
    this.setPriorityConfig('auth', {
      table: 'auth',
      basePriority: QueryPriority.CRITICAL,
      contextModifiers: {}
    });

    this.setPriorityConfig('settings', {
      table: 'settings',
      basePriority: QueryPriority.CRITICAL,
      contextModifiers: {}
    });

    // User profiles and permissions - HIGH priority
    this.setPriorityConfig('profiles', {
      table: 'profiles',
      basePriority: QueryPriority.HIGH,
      contextModifiers: {
        authRequired: 0, // Keep same priority if auth required
        userRole: {
          'admin': 0, // Keep HIGH priority for admin
          'manager': 0,
          'staff': 1
        }
      }
    });

    // Business data - MEDIUM priority
    this.setPriorityConfig('clinicians', {
      table: 'clinicians',
      basePriority: QueryPriority.MEDIUM,
      contextModifiers: {
        authRequired: -1,
        userRole: {
          'admin': -1,
          'manager': 0,
          'staff': 0
        }
      }
    });

    this.setPriorityConfig('customers', {
      table: 'customers',
      basePriority: QueryPriority.MEDIUM,
      contextModifiers: {
        authRequired: -1,
        userRole: {
          'admin': 0,
          'manager': 0,
          'staff': 1
        }
      }
    });

    // Analytics and logs - LOW priority
    this.setPriorityConfig('analytics', {
      table: 'analytics',
      basePriority: QueryPriority.LOW,
      contextModifiers: {}
    });

    this.setPriorityConfig('logs', {
      table: 'logs',
      basePriority: QueryPriority.LOW,
      contextModifiers: {}
    });
  }

  /**
   * Set priority configuration for a table
   */
  setPriorityConfig(table: string, config: QueryPriorityConfig): void {
    this.priorityConfigs.set(table, config);
  }

  /**
   * Calculate priority for a query based on table and context
   */
  calculatePriority(
    table: string,
    userContext?: {
      userId: string;
      role: string;
      permissions: string[];
    },
    authRequired: boolean = false
  ): QueryPriority {
    const config = this.priorityConfigs.get(table);
    if (!config) {
      // Default priority for unknown tables
      return QueryPriority.MEDIUM;
    }

    let priority = config.basePriority;

    // Apply context modifiers
    if (config.contextModifiers) {
      // Auth required modifier
      if (authRequired && config.contextModifiers.authRequired) {
        priority = Math.max(1, priority + config.contextModifiers.authRequired);
      }

      // User role modifier
      if (userContext?.role && config.contextModifiers.userRole) {
        const roleModifier = config.contextModifiers.userRole[userContext.role];
        if (roleModifier !== undefined) {
          priority = Math.max(1, priority + roleModifier);
        }
      }

      // Time of day modifier (future enhancement)
      if (config.contextModifiers.timeOfDay) {
        const hour = new Date().getHours();
        const timeKey = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        const timeModifier = config.contextModifiers.timeOfDay[timeKey];
        if (timeModifier !== undefined) {
          priority = Math.max(1, priority + timeModifier);
        }
      }
    }

    // Ensure priority is within valid range
    return Math.min(QueryPriority.LOW, Math.max(QueryPriority.CRITICAL, priority)) as QueryPriority;
  }

  /**
   * Get priority configuration for a table
   */
  getPriorityConfig(table: string): QueryPriorityConfig | undefined {
    return this.priorityConfigs.get(table);
  }

  /**
   * Get all priority configurations
   */
  getAllConfigs(): Map<string, QueryPriorityConfig> {
    return new Map(this.priorityConfigs);
  }

  /**
   * Update priority configuration for a table
   */
  updatePriorityConfig(table: string, updates: Partial<QueryPriorityConfig>): void {
    const existing = this.priorityConfigs.get(table);
    if (existing) {
      this.priorityConfigs.set(table, { ...existing, ...updates });
    }
  }
}

/**
 * Priority-based query executor
 */
export class PriorityQueryExecutor {
  private queue = new QueryPriorityQueue();
  private priorityManager = QueryPriorityManager.getInstance();
  private processing = false;
  private maxConcurrentQueries = 3;
  private activeQueries = new Set<string>();

  /**
   * Execute query with priority-based ordering
   */
  async executeQuery<T>(
    id: string,
    table: string,
    query: () => Promise<T>,
    userContext?: {
      userId: string;
      role: string;
      permissions: string[];
    },
    authRequired: boolean = false
  ): Promise<T> {
    const priority = this.priorityManager.calculatePriority(table, userContext, authRequired);

    return new Promise<T>((resolve, reject) => {
      const priorityQuery: PriorityQuery = {
        id,
        table,
        query: query as () => Promise<any>,
        priority,
        timestamp: Date.now(),
        authRequired,
        userContext,
        resolve,
        reject
      };

      this.queue.enqueue(priorityQuery);
      this.processQueue();
    });
  }

  /**
   * Process the priority queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.activeQueries.size >= this.maxConcurrentQueries) {
      return;
    }

    this.processing = true;

    while (!this.queue.isEmpty() && this.activeQueries.size < this.maxConcurrentQueries) {
      const query = this.queue.dequeue();
      if (!query) break;

      this.activeQueries.add(query.id);

      // Execute query without blocking queue processing
      this.executeQueryAsync(query).finally(() => {
        this.activeQueries.delete(query.id);
        // Continue processing queue if there are more queries
        if (!this.queue.isEmpty()) {
          setTimeout(() => this.processQueue(), 0);
        }
      });
    }

    this.processing = false;
  }

  /**
   * Execute individual query asynchronously
   */
  private async executeQueryAsync(priorityQuery: PriorityQuery): Promise<void> {
    try {
      const result = await priorityQuery.query();
      priorityQuery.resolve(result);
    } catch (error) {
      priorityQuery.reject(error);
    }
  }

  /**
   * Cancel queries matching criteria
   */
  cancelQueries(predicate: (query: PriorityQuery) => boolean): number {
    const cancelled = this.queue.removeQueries(predicate);
    cancelled.forEach(query => {
      query.reject(new Error('Query cancelled'));
    });
    return cancelled.length;
  }

  /**
   * Get executor status for monitoring
   */
  getStatus(): {
    queueStatus: ReturnType<QueryPriorityQueue['getQueueStatus']>;
    activeQueries: number;
    maxConcurrentQueries: number;
  } {
    return {
      queueStatus: this.queue.getQueueStatus(),
      activeQueries: this.activeQueries.size,
      maxConcurrentQueries: this.maxConcurrentQueries
    };
  }

  /**
   * Update maximum concurrent queries
   */
  setMaxConcurrentQueries(max: number): void {
    this.maxConcurrentQueries = Math.max(1, max);
  }
}

// Export singleton instance
export const priorityQueryExecutor = new PriorityQueryExecutor();