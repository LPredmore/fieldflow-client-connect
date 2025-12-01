/**
 * Request Deduplication Manager
 * 
 * Prevents redundant queries to the same tables by sharing promises across identical requests.
 * Implements request queuing and priority-based processing with comprehensive metrics tracking.
 */

export enum QueryPriority {
  CRITICAL = 1,    // Auth, settings
  HIGH = 2,        // User profile, permissions
  MEDIUM = 3,      // Business data (customers, clinicians)
  LOW = 4          // Analytics, logs
}

export interface QueuedRequest {
  /** Unique identifier for the request */
  id: string;
  /** Timestamp when request was queued */
  timestamp: number;
  /** Priority level for processing order */
  priority: QueryPriority;
  /** Promise resolve function */
  resolve: (value: unknown) => void;
  /** Promise reject function */
  reject: (error: unknown) => void;
  /** Optional metadata about the request */
  metadata?: {
    table: string;
    userId: string;
    tenantId?: string;
    component?: string;
  };
}

export interface DeduplicationMetrics {
  /** Total number of requests processed */
  totalRequests: number;
  /** Number of requests that were deduplicated */
  deduplicatedRequests: number;
  /** Percentage of requests saved through deduplication */
  deduplicationSavings: number;
  /** Number of currently pending requests */
  pendingRequests: number;
  /** Number of requests in queue */
  queuedRequests: number;
  /** Average time requests spend in queue (ms) */
  averageQueueTime: number;
  /** Number of cancelled requests */
  cancelledRequests: number;
  /** Metrics by table */
  tableMetrics: Record<string, TableDeduplicationMetrics>;
  /** Performance metrics */
  performance: DeduplicationPerformanceMetrics;
}

export interface TableDeduplicationMetrics {
  /** Table name */
  table: string;
  /** Total requests for this table */
  totalRequests: number;
  /** Deduplicated requests for this table */
  deduplicatedRequests: number;
  /** Deduplication savings rate for this table */
  savingsRate: number;
  /** Average processing time for this table */
  averageProcessingTime: number;
}

export interface DeduplicationPerformanceMetrics {
  /** Average time to process a deduplicated request (ms) */
  avgDeduplicationTime: number;
  /** Average time to execute a unique request (ms) */
  avgExecutionTime: number;
  /** Memory usage by pending requests (estimated bytes) */
  memoryUsage: number;
  /** Requests processed per second */
  requestsPerSecond: number;
}

export interface RequestCancellationOptions {
  /** Pattern to match request keys for cancellation */
  pattern?: string;
  /** Specific table to cancel requests for */
  table?: string;
  /** User ID to cancel requests for */
  userId?: string;
  /** Component name to cancel requests for */
  component?: string;
  /** Reason for cancellation (for logging) */
  reason?: string;
}

/**
 * DeduplicationManager Class
 * 
 * Manages request deduplication, queuing, and cancellation to prevent redundant queries
 * and optimize database connection usage.
 */
export class DeduplicationManager {
  private pendingRequests = new Map<string, Promise<unknown>>();
  private requestQueue = new Map<string, QueuedRequest[]>();
  private metrics: DeduplicationMetrics;
  private requestHistory: Array<{ timestamp: number; key: string; table: string; deduplicated: boolean }> = [];
  private maxHistorySize = 1000;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.metrics = this.initializeMetrics();
    
    // Start periodic cleanup of completed requests and old history
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 30000); // Cleanup every 30 seconds
  }

  /**
   * Deduplicate a request by sharing promises across identical cache keys
   */
  async deduplicate<T>(
    key: string,
    operation: () => Promise<T>,
    priority: QueryPriority = QueryPriority.MEDIUM,
    metadata?: QueuedRequest['metadata']
  ): Promise<T> {
    const startTime = performance.now();
    const requestId = this.generateRequestId();
    
    console.group(`🔄 [Deduplication] ${metadata?.table || 'unknown'} - ${key.substring(0, 50)}...`);
    console.log('Request ID:', requestId);
    console.log('Priority:', QueryPriority[priority]);
    console.log('Metadata:', metadata);
    
    // Update metrics
    this.metrics.totalRequests++;
    this.updateTableMetrics(metadata?.table || 'unknown', false);
    
    // Check if there's already a pending request for this key
    if (this.pendingRequests.has(key)) {
      const queueSize = this.requestQueue.get(key)?.length || 0;
      console.log(`⚡ DEDUPLICATED - Joining existing request (${queueSize} already queued)`);
      console.log(`💰 Savings: Avoided redundant ${metadata?.table || 'unknown'} query`);
      
      // Create a queued request that will be resolved when the pending request completes
      return new Promise<T>((resolve, reject) => {
        const queuedRequest: QueuedRequest = {
          id: requestId,
          timestamp: Date.now(),
          priority,
          resolve,
          reject,
          metadata
        };
        
        // Add to queue for this key
        if (!this.requestQueue.has(key)) {
          this.requestQueue.set(key, []);
        }
        
        const queue = this.requestQueue.get(key)!;
        
        // Insert based on priority (lower number = higher priority)
        const insertIndex = queue.findIndex(req => req.priority > priority);
        if (insertIndex === -1) {
          queue.push(queuedRequest);
        } else {
          queue.splice(insertIndex, 0, queuedRequest);
        }
        
        // Update metrics
        this.metrics.deduplicatedRequests++;
        this.metrics.queuedRequests = this.getTotalQueuedRequests();
        this.updateTableMetrics(metadata?.table || 'unknown', true);
        
        // Record in history
        this.recordRequestHistory(key, metadata?.table || 'unknown', true);
        
        console.log(`📋 Queued as request #${queue.length} (higher priority requests: ${queue.filter(r => r.priority < priority).length})`);
        console.groupEnd();
      });
    }
    
    // No pending request, execute the operation
    console.log(`🚀 NEW REQUEST - Executing fresh query for ${metadata?.table || 'unknown'}`);
    
    try {
      // Create and store the promise
      const promise = operation();
      this.pendingRequests.set(key, promise);
      this.metrics.pendingRequests = this.pendingRequests.size;
      
      // Record in history
      this.recordRequestHistory(key, metadata?.table || 'unknown', false);
      
      // Execute the operation
      const result = await promise;
      const executionTime = performance.now() - startTime;
      const queuedCount = this.requestQueue.get(key)?.length || 0;
      
      console.log(`✅ COMPLETED in ${executionTime.toFixed(2)}ms`);
      if (queuedCount > 0) {
        console.log(`📤 Resolving ${queuedCount} deduplicated request(s)`);
        console.log(`💰 Total savings: Saved ${queuedCount} redundant queries`);
      }
      console.log(`📊 Overall stats: ${this.metrics.deduplicationSavings.toFixed(1)}% savings, ${this.pendingRequests.size} pending`);
      console.groupEnd();
      
      // Update performance metrics
      this.updatePerformanceMetrics(executionTime, false);
      
      // Resolve all queued requests for this key
      this.resolveQueuedRequests(key, result);
      
      return result;
      
    } catch (error) {
      const queuedCount = this.requestQueue.get(key)?.length || 0;
      console.error(`❌ FAILED after ${(performance.now() - startTime).toFixed(2)}ms`);
      console.error('Error:', error);
      if (queuedCount > 0) {
        console.error(`📤 Rejecting ${queuedCount} deduplicated request(s) with same error`);
      }
      console.groupEnd();
      
      // Reject all queued requests for this key
      this.rejectQueuedRequests(key, error);
      
      throw error;
      
    } finally {
      // Clean up
      this.pendingRequests.delete(key);
      this.requestQueue.delete(key);
      this.metrics.pendingRequests = this.pendingRequests.size;
      this.metrics.queuedRequests = this.getTotalQueuedRequests();
      
      // Update deduplication savings
      this.updateDeduplicationSavings();
    }
  }

  /**
   * Cancel pending requests based on various criteria
   */
  cancelPendingRequests(options: RequestCancellationOptions): number {
    let cancelledCount = 0;
    const reason = options.reason || 'Manual cancellation';
    
    console.log(`🛑 [DeduplicationManager] Cancelling requests:`, options);
    
    // Cancel pending requests
    for (const [key, promise] of this.pendingRequests.entries()) {
      if (this.shouldCancelRequest(key, options)) {
        // We can't actually cancel the promise, but we can remove it from tracking
        this.pendingRequests.delete(key);
        cancelledCount++;
        
        console.log(`🛑 [DeduplicationManager] Cancelled pending request: ${key} (${reason})`);
      }
    }
    
    // Cancel queued requests
    for (const [key, queue] of this.requestQueue.entries()) {
      if (this.shouldCancelRequest(key, options)) {
        // Reject all queued requests for this key
        queue.forEach(request => {
          request.reject(new Error(`Request cancelled: ${reason}`));
        });
        
        cancelledCount += queue.length;
        this.requestQueue.delete(key);
        
        console.log(`🛑 [DeduplicationManager] Cancelled ${queue.length} queued requests for key: ${key} (${reason})`);
      }
    }
    
    // Update metrics
    this.metrics.cancelledRequests += cancelledCount;
    this.metrics.pendingRequests = this.pendingRequests.size;
    this.metrics.queuedRequests = this.getTotalQueuedRequests();
    
    console.log(`🛑 [DeduplicationManager] Total cancelled requests: ${cancelledCount}`);
    
    return cancelledCount;
  }

  /**
   * Get current number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Get current number of queued requests
   */
  getQueuedCount(): number {
    return this.getTotalQueuedRequests();
  }

  /**
   * Get comprehensive deduplication metrics
   */
  getMetrics(): DeduplicationMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }


  /**
   * Clear all pending and queued requests
   */
  clear(reason = 'Manager cleared'): void {
    const totalCancelled = this.pendingRequests.size + this.getTotalQueuedRequests();
    
    // Cancel all queued requests
    for (const [key, queue] of this.requestQueue.entries()) {
      queue.forEach(request => {
        request.reject(new Error(`Request cancelled: ${reason}`));
      });
    }
    
    // Clear all maps
    this.pendingRequests.clear();
    this.requestQueue.clear();
    
    // Update metrics
    this.metrics.cancelledRequests += totalCancelled;
    this.metrics.pendingRequests = 0;
    this.metrics.queuedRequests = 0;
    
    console.log(`🧹 [DeduplicationManager] Cleared all requests (${totalCancelled} cancelled): ${reason}`);
  }

  /**
   * Cleanup resources and stop background processes
   */
  destroy(): void {
    this.clear('Manager destroyed');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    console.log(`💀 [DeduplicationManager] Destroyed`);
  }

  // Private helper methods

  private initializeMetrics(): DeduplicationMetrics {
    return {
      totalRequests: 0,
      deduplicatedRequests: 0,
      deduplicationSavings: 0,
      pendingRequests: 0,
      queuedRequests: 0,
      averageQueueTime: 0,
      cancelledRequests: 0,
      tableMetrics: {},
      performance: {
        avgDeduplicationTime: 0,
        avgExecutionTime: 0,
        memoryUsage: 0,
        requestsPerSecond: 0
      }
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private resolveQueuedRequests(key: string, result: unknown): void {
    const queue = this.requestQueue.get(key);
    if (!queue || queue.length === 0) {
      return;
    }
    
    const resolveStartTime = performance.now();
    
    console.log(`📤 [DeduplicationManager] Resolving ${queue.length} queued requests for key: ${key}`);
    
    // Calculate queue times and resolve all requests
    queue.forEach(request => {
      const queueTime = Date.now() - request.timestamp;
      this.updateAverageQueueTime(queueTime);
      
      try {
        request.resolve(result);
      } catch (error) {
        console.error(`❌ [DeduplicationManager] Error resolving queued request ${request.id}:`, error);
      }
    });
    
    const resolveTime = performance.now() - resolveStartTime;
    this.updatePerformanceMetrics(resolveTime, true);
  }

  private rejectQueuedRequests(key: string, error: unknown): void {
    const queue = this.requestQueue.get(key);
    if (!queue || queue.length === 0) {
      return;
    }
    
    console.log(`📤 [DeduplicationManager] Rejecting ${queue.length} queued requests for key: ${key}`);
    
    queue.forEach(request => {
      try {
        request.reject(error);
      } catch (rejectionError) {
        console.error(`❌ [DeduplicationManager] Error rejecting queued request ${request.id}:`, rejectionError);
      }
    });
  }

  private shouldCancelRequest(key: string, options: RequestCancellationOptions): boolean {
    // Check pattern matching
    if (options.pattern && !this.matchesPattern(key, options.pattern)) {
      return false;
    }
    
    // Check table matching
    if (options.table && !key.includes(options.table)) {
      return false;
    }
    
    // Check user ID matching
    if (options.userId && !key.includes(options.userId)) {
      return false;
    }
    
    // Check component matching (would need to be included in key)
    if (options.component && !key.includes(options.component)) {
      return false;
    }
    
    return true;
  }

  private matchesPattern(key: string, pattern: string): boolean {
    // Simple pattern matching - can be enhanced with regex if needed
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\*/g, '.*');
      return new RegExp(regexPattern).test(key);
    }
    return key.includes(pattern);
  }

  private getTotalQueuedRequests(): number {
    let total = 0;
    for (const queue of this.requestQueue.values()) {
      total += queue.length;
    }
    return total;
  }

  private updateTableMetrics(table: string, deduplicated: boolean): void {
    if (!this.metrics.tableMetrics[table]) {
      this.metrics.tableMetrics[table] = {
        table,
        totalRequests: 0,
        deduplicatedRequests: 0,
        savingsRate: 0,
        averageProcessingTime: 0
      };
    }
    
    const tableMetrics = this.metrics.tableMetrics[table];
    tableMetrics.totalRequests++;
    
    if (deduplicated) {
      tableMetrics.deduplicatedRequests++;
    }
    
    tableMetrics.savingsRate = tableMetrics.totalRequests > 0 ? 
      (tableMetrics.deduplicatedRequests / tableMetrics.totalRequests) * 100 : 0;
  }

  private updatePerformanceMetrics(executionTime: number, isDeduplicated: boolean): void {
    if (isDeduplicated) {
      this.metrics.performance.avgDeduplicationTime = this.updateAverage(
        this.metrics.performance.avgDeduplicationTime,
        executionTime,
        this.metrics.deduplicatedRequests
      );
    } else {
      const uniqueRequests = this.metrics.totalRequests - this.metrics.deduplicatedRequests;
      this.metrics.performance.avgExecutionTime = this.updateAverage(
        this.metrics.performance.avgExecutionTime,
        executionTime,
        uniqueRequests
      );
    }
  }

  private updateAverageQueueTime(queueTime: number): void {
    this.metrics.averageQueueTime = this.updateAverage(
      this.metrics.averageQueueTime,
      queueTime,
      this.metrics.deduplicatedRequests
    );
  }

  private updateAverage(currentAvg: number, newValue: number, count: number): number {
    if (count <= 1) return newValue;
    return ((currentAvg * (count - 1)) + newValue) / count;
  }

  private updateDeduplicationSavings(): void {
    this.metrics.deduplicationSavings = this.metrics.totalRequests > 0 ? 
      (this.metrics.deduplicatedRequests / this.metrics.totalRequests) * 100 : 0;
  }

  private recordRequestHistory(key: string, table: string, deduplicated: boolean): void {
    this.requestHistory.push({
      timestamp: Date.now(),
      key,
      table,
      deduplicated
    });
    
    // Keep history size manageable
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory = this.requestHistory.slice(-this.maxHistorySize);
    }
  }

  private updateMetrics(): void {
    // Update real-time metrics
    this.metrics.pendingRequests = this.pendingRequests.size;
    this.metrics.queuedRequests = this.getTotalQueuedRequests();
    
    // Calculate requests per second based on recent history
    const now = Date.now();
    const recentRequests = this.requestHistory.filter(req => now - req.timestamp < 60000); // Last minute
    this.metrics.performance.requestsPerSecond = recentRequests.length / 60;
    
    // Estimate memory usage
    this.metrics.performance.memoryUsage = this.estimateMemoryUsage();
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in bytes
    let totalSize = 0;
    
    // Pending requests map
    totalSize += this.pendingRequests.size * 200; // Estimated bytes per entry
    
    // Request queue
    for (const queue of this.requestQueue.values()) {
      totalSize += queue.length * 300; // Estimated bytes per queued request
    }
    
    // History
    totalSize += this.requestHistory.length * 100; // Estimated bytes per history entry
    
    return totalSize;
  }

  private performCleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    // Clean up old history entries
    const initialHistorySize = this.requestHistory.length;
    this.requestHistory = this.requestHistory.filter(entry => now - entry.timestamp < maxAge);
    
    if (initialHistorySize !== this.requestHistory.length) {
      console.log(`🧹 [DeduplicationManager] Cleaned up ${initialHistorySize - this.requestHistory.length} old history entries`);
    }
    
    // Log comprehensive status with table breakdown
    const metrics = this.getMetrics();
    console.group('📊 [Deduplication] Performance Summary');
    console.log(`Overall: ${metrics.deduplicationSavings.toFixed(1)}% savings (${metrics.deduplicatedRequests}/${metrics.totalRequests} requests)`);
    console.log(`Active: ${metrics.pendingRequests} pending, ${metrics.queuedRequests} queued`);
    console.log(`Performance: ${metrics.performance.requestsPerSecond.toFixed(2)} req/s, ${(metrics.performance.memoryUsage / 1024).toFixed(2)}KB memory`);
    
    // Table-specific breakdown
    const topTables = Object.values(metrics.tableMetrics)
      .sort((a, b) => b.totalRequests - a.totalRequests)
      .slice(0, 5);
    
    if (topTables.length > 0) {
      console.log('\nTop Tables by Request Count:');
      topTables.forEach(table => {
        console.log(`  ${table.table}: ${table.savingsRate.toFixed(1)}% saved (${table.deduplicatedRequests}/${table.totalRequests} requests)`);
      });
    }
    console.groupEnd();
  }
}

// Global deduplication manager instance
export const deduplicationManager = new DeduplicationManager();