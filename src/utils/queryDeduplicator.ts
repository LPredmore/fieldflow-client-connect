/**
 * Query Deduplicator
 * 
 * Prevents duplicate simultaneous requests by coalescing identical queries
 * and sharing promises for in-flight requests.
 */

import { resilienceLogger } from './resilienceLogger';

export interface QueryKey {
  operation: string;
  params: Record<string, any>;
  userId?: string;
}

export interface InFlightRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  abortController: AbortController;
  subscribers: number;
}

/**
 * Query Deduplicator
 * 
 * Ensures only one request is made for identical queries at the same time
 */
export class QueryDeduplicator {
  private inFlightRequests: Map<string, InFlightRequest<any>> = new Map();
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  private cleanupInterval: number | null = null;

  constructor() {
    this.startCleanup();
    resilienceLogger.info('query-dedup', '🔄 [QueryDeduplicator] Initialized');
  }

  /**
   * Generate a unique key for a query
   */
  generateKey(queryKey: QueryKey): string {
    const { operation, params, userId } = queryKey;
    
    // Sort params to ensure consistent keys
    const sortedParams = this.sortObject(params);
    
    // Create deterministic key
    const key = JSON.stringify({
      op: operation,
      params: sortedParams,
      user: userId || 'anonymous'
    });
    
    return key;
  }

  /**
   * Sort object keys recursively for consistent hashing
   */
  private sortObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObject(item));
    }
    
    const sorted: Record<string, any> = {};
    Object.keys(obj)
      .sort()
      .forEach(key => {
        sorted[key] = this.sortObject(obj[key]);
      });
    
    return sorted;
  }

  /**
   * Execute query with deduplication
   */
  async deduplicate<T>(
    queryKey: QueryKey,
    executor: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    const key = this.generateKey(queryKey);
    
    // Check if request is already in flight
    const existing = this.inFlightRequests.get(key);
    
    if (existing) {
      existing.subscribers++;
      
      resilienceLogger.debug('query-dedup', '♻️ [QueryDeduplicator] Reusing in-flight request', {
        operation: queryKey.operation,
        subscribers: existing.subscribers,
        age: Date.now() - existing.timestamp
      });
      
      try {
        return await existing.promise;
      } finally {
        existing.subscribers--;
      }
    }
    
    // Create new request
    const abortController = new AbortController();
    
    const promise = this.executeWithTimeout(
      executor,
      abortController.signal,
      queryKey.operation
    );
    
    const inFlightRequest: InFlightRequest<T> = {
      promise,
      timestamp: Date.now(),
      abortController,
      subscribers: 1
    };
    
    this.inFlightRequests.set(key, inFlightRequest);
    
    resilienceLogger.debug('query-dedup', '🚀 [QueryDeduplicator] Starting new request', {
      operation: queryKey.operation,
      key: key.substring(0, 50) + '...'
    });
    
    try {
      const result = await promise;
      return result;
    } catch (error) {
      throw error;
    } finally {
      inFlightRequest.subscribers--;
      
      // Clean up if no more subscribers
      if (inFlightRequest.subscribers === 0) {
        this.inFlightRequests.delete(key);
        
        resilienceLogger.debug('query-dedup', '✅ [QueryDeduplicator] Request completed and cleaned up', {
          operation: queryKey.operation
        });
      }
    }
  }

  /**
   * Execute with timeout protection
   */
  private async executeWithTimeout<T>(
    executor: (signal: AbortSignal) => Promise<T>,
    signal: AbortSignal,
    operation: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Query deduplication timeout for ${operation}`));
      }, this.REQUEST_TIMEOUT);
      
      executor(signal)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Cancel a specific query
   */
  cancel(queryKey: QueryKey): boolean {
    const key = this.generateKey(queryKey);
    const inFlight = this.inFlightRequests.get(key);
    
    if (inFlight) {
      inFlight.abortController.abort();
      this.inFlightRequests.delete(key);
      
      resilienceLogger.info('query-dedup', '🛑 [QueryDeduplicator] Request cancelled', {
        operation: queryKey.operation
      });
      
      return true;
    }
    
    return false;
  }

  /**
   * Cancel all in-flight requests
   */
  cancelAll(): void {
    const count = this.inFlightRequests.size;
    
    for (const [key, request] of this.inFlightRequests) {
      request.abortController.abort();
    }
    
    this.inFlightRequests.clear();
    
    resilienceLogger.info('query-dedup', `🛑 [QueryDeduplicator] Cancelled all requests (${count})`);
  }

  /**
   * Check if a query is in flight
   */
  isInFlight(queryKey: QueryKey): boolean {
    const key = this.generateKey(queryKey);
    return this.inFlightRequests.has(key);
  }

  /**
   * Get number of in-flight requests
   */
  getInFlightCount(): number {
    return this.inFlightRequests.size;
  }

  /**
   * Get in-flight request info
   */
  getInFlightRequests(): Array<{
    operation: string;
    age: number;
    subscribers: number;
  }> {
    const now = Date.now();
    const requests: Array<{
      operation: string;
      age: number;
      subscribers: number;
    }> = [];
    
    for (const [key, request] of this.inFlightRequests) {
      try {
        const parsed = JSON.parse(key);
        requests.push({
          operation: parsed.op,
          age: now - request.timestamp,
          subscribers: request.subscribers
        });
      } catch (error) {
        // Skip malformed keys
      }
    }
    
    return requests;
  }

  /**
   * Start periodic cleanup of stale requests
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleRequests();
    }, 60000) as unknown as number; // Every minute
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up stale requests that have been in flight too long
   */
  private cleanupStaleRequests(): void {
    const now = Date.now();
    const staleKeys: string[] = [];
    
    for (const [key, request] of this.inFlightRequests) {
      const age = now - request.timestamp;
      
      // If request is older than timeout and has no subscribers, clean it up
      if (age > this.REQUEST_TIMEOUT && request.subscribers === 0) {
        staleKeys.push(key);
        request.abortController.abort();
      }
    }
    
    if (staleKeys.length > 0) {
      staleKeys.forEach(key => this.inFlightRequests.delete(key));
      
      resilienceLogger.warn('query-dedup', `🧹 [QueryDeduplicator] Cleaned up ${staleKeys.length} stale requests`);
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    inFlightCount: number;
    totalSubscribers: number;
    oldestRequestAge: number | null;
    averageSubscribers: number;
  } {
    const now = Date.now();
    let totalSubscribers = 0;
    let oldestAge: number | null = null;
    
    for (const request of this.inFlightRequests.values()) {
      totalSubscribers += request.subscribers;
      const age = now - request.timestamp;
      
      if (oldestAge === null || age > oldestAge) {
        oldestAge = age;
      }
    }
    
    const count = this.inFlightRequests.size;
    
    return {
      inFlightCount: count,
      totalSubscribers,
      oldestRequestAge: oldestAge,
      averageSubscribers: count > 0 ? totalSubscribers / count : 0
    };
  }

  /**
   * Reset (for testing)
   */
  reset(): void {
    this.cancelAll();
    resilienceLogger.info('query-dedup', '🔄 [QueryDeduplicator] Reset');
  }
}

// Export singleton instance
export const queryDeduplicator = new QueryDeduplicator();
