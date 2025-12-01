/**
 * QueryDeduplicator Service
 * 
 * Prevents duplicate database queries from executing simultaneously.
 * When multiple components request the same data at the same time,
 * only one query executes and all requesters receive the same result.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import { authLogger, AuthLogCategory } from './AuthLogger';

interface PendingQuery<T> {
  promise: Promise<T>;
  resolvers: Array<(value: T) => void>;
  rejectors: Array<(error: Error) => void>;
  timestamp: number;
}

export class QueryDeduplicator {
  private pending = new Map<string, PendingQuery<any>>();
  private readonly CLEANUP_DELAY = 100; // milliseconds

  /**
   * Deduplicate a query by key
   * If a query with the same key is already in flight, queue this request
   * Otherwise, execute the query and track it
   * 
   * @param key - Unique identifier for the query
   * @param queryFn - Function that executes the query
   * @returns Promise that resolves with query result
   */
  async deduplicate<T>(key: string, queryFn: () => Promise<T>): Promise<T> {
    // Check if query already in flight
    const existing = this.pending.get(key);
    
    if (existing) {
      authLogger.logQueryDedup('Query deduplicated - using existing request', {
        key,
        queuedRequests: existing.resolvers.length + 1,
        age: Date.now() - existing.timestamp
      });
      
      // Return promise that resolves when original query completes
      return new Promise<T>((resolve, reject) => {
        existing.resolvers.push(resolve);
        existing.rejectors.push(reject);
      });
    }

    authLogger.logQueryDedup('Executing new query', {
      key,
      pendingCount: this.pending.size
    });

    // Execute new query
    const promise = queryFn();
    const pendingQuery: PendingQuery<T> = {
      promise,
      resolvers: [],
      rejectors: [],
      timestamp: Date.now()
    };
    
    this.pending.set(key, pendingQuery);

    try {
      const result = await promise;
      
      const duration = Date.now() - pendingQuery.timestamp;
      authLogger.logQueryDedup('Query completed successfully', {
        key,
        duration,
        queuedRequests: pendingQuery.resolvers.length
      });
      
      // Resolve all queued requests
      pendingQuery.resolvers.forEach(resolve => resolve(result));
      
      return result;
    } catch (error) {
      const duration = Date.now() - pendingQuery.timestamp;
      authLogger.logError(AuthLogCategory.QUERY_DEDUPLICATION, 'Query failed', error as Error, {
        key,
        duration,
        queuedRequests: pendingQuery.rejectors.length
      });
      
      // Reject all queued requests
      const err = error instanceof Error ? error : new Error(String(error));
      pendingQuery.rejectors.forEach(reject => reject(err));
      
      throw error;
    } finally {
      // Clean up after delay
      setTimeout(() => {
        this.pending.delete(key);
        authLogger.logQueryDedup('Query cleaned up from registry', { key });
      }, this.CLEANUP_DELAY);
    }
  }

  /**
   * Clear a specific pending query
   * @param key - Query key to clear
   */
  clear(key: string): void {
    this.pending.delete(key);
  }

  /**
   * Clear all pending queries
   */
  clearAll(): void {
    this.pending.clear();
  }

  /**
   * Get number of pending queries
   */
  getPendingCount(): number {
    return this.pending.size;
  }

  /**
   * Check if a query is pending
   */
  isPending(key: string): boolean {
    return this.pending.has(key);
  }

  /**
   * Get all pending query keys
   */
  getPendingKeys(): string[] {
    return Array.from(this.pending.keys());
  }
}

// Export singleton instance
export const queryDeduplicator = new QueryDeduplicator();
