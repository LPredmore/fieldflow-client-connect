/**
 * Query State Manager for Authentication Coordination
 * 
 * Coordinates authentication state with query execution to prevent
 * "useSupabaseQuery Skipped" errors during auth transitions.
 * 
 * Requirements addressed:
 * - 2.1: Queue queries during authentication loading state
 * - 2.2: Execute pending queries when authentication completes
 */

export enum AuthenticationState {
  LOADING = 'loading',
  AUTHENTICATED = 'authenticated',
  UNAUTHENTICATED = 'unauthenticated',
  PERMISSION_CHECKING = 'permission_checking',
  REDIRECTING = 'redirecting'
}

export enum QueryPriority {
  CRITICAL = 1,    // Auth, settings
  HIGH = 2,        // User profile, permissions
  MEDIUM = 3,      // Business data (customers, clinicians)
  LOW = 4          // Analytics, logs
}

export interface QueuedQuery {
  id: string;
  table: string;
  priority: QueryPriority;
  authRequired: boolean;
  permissions?: string[];
  queryFn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface ActiveQuery {
  id: string;
  table: string;
  startTime: number;
  promise: Promise<any>;
  abortController?: AbortController;
}

export interface QueryRequest {
  id: string;
  table: string;
  priority: QueryPriority;
  authRequired: boolean;
  permissions?: string[];
  queryFn: () => Promise<any>;
  maxRetries?: number;
}

/**
 * Priority queue implementation for query management
 */
class PriorityQueue<T extends { priority: number }> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
    this.items.sort((a, b) => a.priority - b.priority);
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  peek(): T | undefined {
    return this.items[0];
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }

  removeById(id: string): boolean {
    const index = this.items.findIndex((item: any) => item.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  getAll(): T[] {
    return [...this.items];
  }
}

/**
 * QueryStateManager coordinates authentication state with query execution
 * to prevent queries from being skipped during auth transitions.
 */
export class QueryStateManager {
  private authState: AuthenticationState = AuthenticationState.LOADING;
  private queryQueue = new PriorityQueue<QueuedQuery>();
  private activeQueries = new Map<string, ActiveQuery>();
  private processingQueue = false;
  private listeners = new Set<(state: AuthenticationState) => void>();

  constructor() {
    // Bind methods to preserve context
    this.queueQuery = this.queueQuery.bind(this);
    this.handleAuthStateChange = this.handleAuthStateChange.bind(this);
    this.processQueue = this.processQueue.bind(this);
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthenticationState {
    return this.authState;
  }

  /**
   * Add listener for auth state changes
   */
  addAuthStateListener(listener: (state: AuthenticationState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Queue a query for execution, respecting authentication state
   * Requirements: 2.1, 2.2
   */
  async queueQuery(request: QueryRequest): Promise<any> {
    const queryId = `${request.table}_${Date.now()}_${Math.random()}`;
    
    // If authenticated and no auth required, execute immediately
    if (this.authState === AuthenticationState.AUTHENTICATED || !request.authRequired) {
      return this.executeQuery(request, queryId);
    }

    // If unauthenticated and auth required, reject immediately
    if (this.authState === AuthenticationState.UNAUTHENTICATED && request.authRequired) {
      throw new Error('Authentication required for this query');
    }

    // Queue the query for later execution
    return new Promise((resolve, reject) => {
      const queuedQuery: QueuedQuery = {
        id: queryId,
        table: request.table,
        priority: request.priority,
        authRequired: request.authRequired,
        permissions: request.permissions,
        queryFn: request.queryFn,
        resolve,
        reject,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: request.maxRetries || 3
      };

      this.queryQueue.enqueue(queuedQuery);
      
      console.log(`Query queued: ${request.table} (priority: ${request.priority}, auth state: ${this.authState})`);
      
      // Try to process queue in case auth state changed
      this.processQueue();
    });
  }

  /**
   * Handle authentication state changes and process pending queries
   * Requirements: 2.1, 2.2
   */
  handleAuthStateChange(newState: AuthenticationState): void {
    const previousState = this.authState;
    this.authState = newState;

    console.log(`Auth state changed: ${previousState} -> ${newState}`);

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(newState);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });

    // Process queue when authentication completes
    if (newState === AuthenticationState.AUTHENTICATED) {
      this.processQueue();
    }

    // Cancel queries if becoming unauthenticated
    if (newState === AuthenticationState.UNAUTHENTICATED) {
      this.cancelAuthRequiredQueries();
    }
  }

  /**
   * Process queued queries based on current authentication state
   * Requirements: 2.2
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.queryQueue.size() > 0) {
        const query = this.queryQueue.peek();
        if (!query) break;

        // Check if query can be executed
        if (this.canExecuteQuery(query)) {
          this.queryQueue.dequeue();
          
          try {
            const result = await this.executeQuery({
              id: query.id,
              table: query.table,
              priority: query.priority,
              authRequired: query.authRequired,
              permissions: query.permissions,
              queryFn: query.queryFn,
              maxRetries: query.maxRetries
            }, query.id);
            
            query.resolve(result);
          } catch (error) {
            // Retry logic
            if (query.retryCount < query.maxRetries && this.shouldRetry(error)) {
              query.retryCount++;
              query.timestamp = Date.now();
              this.queryQueue.enqueue(query);
              console.log(`Retrying query ${query.id} (attempt ${query.retryCount}/${query.maxRetries})`);
            } else {
              query.reject(error);
            }
          }
        } else {
          // Can't execute more queries, wait for auth state change
          break;
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Execute a query immediately
   */
  private async executeQuery(request: QueryRequest, queryId: string): Promise<any> {
    const activeQuery: ActiveQuery = {
      id: queryId,
      table: request.table,
      startTime: Date.now(),
      promise: request.queryFn(),
      abortController: new AbortController()
    };

    this.activeQueries.set(queryId, activeQuery);

    try {
      const result = await activeQuery.promise;
      console.log(`Query executed successfully: ${request.table} (${Date.now() - activeQuery.startTime}ms)`);
      return result;
    } catch (error) {
      console.error(`Query failed: ${request.table}`, error);
      throw error;
    } finally {
      this.activeQueries.delete(queryId);
    }
  }

  /**
   * Check if a query can be executed based on current state
   */
  private canExecuteQuery(query: QueuedQuery): boolean {
    // Non-auth queries can always execute
    if (!query.authRequired) {
      return true;
    }

    // Auth-required queries need authenticated state
    return this.authState === AuthenticationState.AUTHENTICATED;
  }

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetry(error: any): boolean {
    // Don't retry auth errors
    if (error?.message?.includes('Authentication') || error?.message?.includes('Unauthorized')) {
      return false;
    }

    // Don't retry permission errors
    if (error?.message?.includes('Permission') || error?.message?.includes('Forbidden')) {
      return false;
    }

    // Retry network and timeout errors
    return true;
  }

  /**
   * Cancel queries that require authentication when becoming unauthenticated
   */
  private cancelAuthRequiredQueries(): void {
    // Cancel queued auth-required queries
    const queuedQueries = this.queryQueue.getAll();
    queuedQueries.forEach(query => {
      if (query.authRequired) {
        this.queryQueue.removeById(query.id);
        query.reject(new Error('Authentication lost during query execution'));
      }
    });

    // Cancel active auth-required queries
    this.activeQueries.forEach((activeQuery, queryId) => {
      if (activeQuery.abortController) {
        activeQuery.abortController.abort();
      }
    });
  }

  /**
   * Cancel queries for a specific route (useful during navigation)
   */
  cancelQueriesForRoute(route: string): void {
    // This would need route tracking in queries to implement fully
    // For now, we'll cancel all non-critical queries
    const queuedQueries = this.queryQueue.getAll();
    queuedQueries.forEach(query => {
      if (query.priority > QueryPriority.HIGH) {
        this.queryQueue.removeById(query.id);
        query.reject(new Error('Query cancelled due to navigation'));
      }
    });
  }

  /**
   * Get current queue status for monitoring
   */
  getQueueStatus(): {
    queueSize: number;
    activeQueries: number;
    authState: AuthenticationState;
    queuedByPriority: Record<QueryPriority, number>;
  } {
    const queuedQueries = this.queryQueue.getAll();
    const queuedByPriority = queuedQueries.reduce((acc, query) => {
      acc[query.priority] = (acc[query.priority] || 0) + 1;
      return acc;
    }, {} as Record<QueryPriority, number>);

    return {
      queueSize: this.queryQueue.size(),
      activeQueries: this.activeQueries.size,
      authState: this.authState,
      queuedByPriority
    };
  }

  /**
   * Clear all queued queries (useful for testing or reset scenarios)
   */
  clearQueue(): void {
    const queuedQueries = this.queryQueue.getAll();
    queuedQueries.forEach(query => {
      query.reject(new Error('Query queue cleared'));
    });
    this.queryQueue.clear();
  }
}

// Singleton instance for global use
export const queryStateManager = new QueryStateManager();