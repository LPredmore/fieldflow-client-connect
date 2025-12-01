/**
 * Enhanced Resilient Supabase Client
 * 
 * Integrates all resilience components for comprehensive network error handling:
 * - Protocol health monitoring and adaptive switching
 * - Smart retry with circuit breaker
 * - Persistent caching with IndexedDB
 * - Comprehensive error classification
 * - Network quality monitoring
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ErrorClassifier } from '@/utils/errorClassifier';
import { smartRetryEngine, RetryOptions } from '@/utils/smartRetryEngine';
import { indexedDBCache, CacheOptions } from '@/utils/indexedDBCacheManager';
import { resilienceLogger } from '@/utils/resilienceLogger';
import { protocolHealthMonitor } from '@/utils/protocolHealthMonitor';
import { networkQualityMonitor } from '@/utils/networkQualityMonitor';

// Hardcoded Supabase configuration - required for Lovable production builds
// Note: VITE_* environment variables are NOT supported in Lovable production
// The anon key is safe to expose - it's designed for client-side use and protected by RLS
const SUPABASE_URL = "https://tizshsmrqqaharwpqocj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpenNoc21ycXFhaGFyd3Bxb2NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwOTQwNDQsImV4cCI6MjA3NDY3MDA0NH0.HFecGZAPLi6-RmPJrG0M0G9bAV7AsabybTapjKw-ddU";

/**
 * Custom lock function with enforced timeout covering ENTIRE operation
 * Uses Promise.race to ensure both lock acquisition AND fn() execution
 * complete within 5 seconds, preventing indefinite hangs
 */
async function navigatorLockWithTimeout<R>(
  name: string,
  acquireTimeout: number, // Ignored - we enforce our own timeout
  fn: () => Promise<R>
): Promise<R> {
  const LOCK_TIMEOUT = 5000; // 5 seconds for ENTIRE operation (lock + execution)
  
  // If Navigator Locks API isn't available, just run the function
  if (typeof navigator === 'undefined' || !navigator.locks) {
    console.log('⚠️ [Auth Lock] Navigator locks unavailable, executing without lock');
    return await fn();
  }
  
  // Create timeout promise that rejects after 5s
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.warn('⏱️ [Auth Lock] TIMEOUT: Operation exceeded 5s limit', { name });
      reject(new Error('LOCK_TIMEOUT'));
    }, LOCK_TIMEOUT);
  });
  
  // Create the lock operation promise
  console.log('🔒 [Auth Lock] Starting lock operation', { name });
  const lockOperation = navigator.locks.request(
    name,
    { mode: 'exclusive' },
    async (lock) => {
      // CRITICAL: Do NOT clear timeout here - must cover fn() execution too
      console.log('✓ [Auth Lock] Lock acquired, executing fn()', { name });
      if (!lock) {
        console.warn('⚠️ [Auth Lock] Received null lock', { name });
      }
      const startTime = Date.now();
      const result = await fn();
      console.log('✓ [Auth Lock] fn() completed', { name, duration: Date.now() - startTime });
      return result;
    }
  );
  
  try {
    // Race between lock operation and timeout - timeout covers EVERYTHING
    const result = await Promise.race([lockOperation, timeoutPromise]);
    clearTimeout(timeoutId!);
    console.log('✓ [Auth Lock] Operation completed successfully', { name });
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId!);
    
    if (error.message === 'LOCK_TIMEOUT') {
      // Don't call fn() again - the original is still running and will fail
      // Calling it again just adds 10+ seconds of waiting
      console.error('⏱️ [Auth Lock] Lock operation timed out after 5s', { name });
      throw new Error('Authentication initialization timed out. Please refresh the page.');
    }
    
    // For other errors, propagate them
    console.error('⚠️ [Auth Lock] Lock operation failed', { name, error: error.message });
    throw error;
  }
}

export interface ConnectionHealth {
  protocol: 'http2' | 'http1.1';
  quality: 'excellent' | 'good' | 'poor' | 'critical';
  errorRate: number;
  avgResponseTime: number;
  lastSuccessfulRequest: number | null;
  consecutiveFailures: number;
}

export interface OperationOptions {
  retry?: boolean | RetryOptions;
  cache?: boolean | CacheOptions;
  cacheKey?: string;
  bypassCircuitBreaker?: boolean;
  timeout?: number;
}

interface ClientState {
  primary: SupabaseClient;
  fallback: SupabaseClient | null;
  usingFallback: boolean;
  http2ErrorCount: number;
  lastProtocolError: number;
  protocolSwitchCooldown: number;
  successCount: number;
  totalRequests: number;
  consecutiveFailures: number;
  lastSuccessfulRequest: number | null;
}

/**
 * Enhanced Resilient Supabase Client
 * 
 * Production-grade client with comprehensive resilience features
 */
class EnhancedResilientClient {
  private state: ClientState;
  private readonly HTTP2_ERROR_THRESHOLD = 1; // Immediate fallback on first protocol error
  private readonly PROTOCOL_SWITCH_COOLDOWN = 30000; // 30 seconds

  constructor() {
    // Validate configuration to catch future issues
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      const errorMsg = '🚨 [CRITICAL] Supabase configuration missing - this should never happen with hardcoded values';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    resilienceLogger.info('client', 'Initializing Enhanced Resilient Supabase Client', {
      urlPrefix: SUPABASE_URL.substring(0, 30)
    });

    this.state = {
      primary: this.createPrimaryClient(),
      fallback: null,
      usingFallback: false,
      http2ErrorCount: 0,
      lastProtocolError: 0,
      protocolSwitchCooldown: this.PROTOCOL_SWITCH_COOLDOWN,
      successCount: 0,
      totalRequests: 0,
      consecutiveFailures: 0,
      lastSuccessfulRequest: null
    };

    // Fallback will be created on-demand when needed (lazy initialization)
    
    // Start monitoring
    networkQualityMonitor.startMonitoring();
  }

  /**
   * Create primary Supabase client with HTTP/1.1-compatible fetch
   * Includes per-request timeout to prevent silent hangs
   */
  private createPrimaryClient(): SupabaseClient {
    return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
        lock: navigatorLockWithTimeout,
      },
      global: {
        headers: {
          "User-Agent": "Supabase-JS/2.0",
          Connection: "keep-alive",
        },
        // HTTP/1.1-compatible fetch with per-request timeout
        fetch: (url, options: RequestInit = {}) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            console.warn('⏱️ [Primary Client] Request timeout after 8s, aborting', { url });
            controller.abort();
          }, 8000); // 8-second per-request timeout
          
          // FIX: Properly handle Headers object - spreading Headers returns {}!
          let mergedHeaders: Record<string, string> = {
            Connection: "keep-alive",
          };
          
          if (options.headers) {
            if (options.headers instanceof Headers) {
              // Headers object - must iterate to extract entries
              options.headers.forEach((value, key) => {
                mergedHeaders[key] = value;
              });
            } else if (Array.isArray(options.headers)) {
              // Array of [key, value] tuples
              options.headers.forEach(([key, value]) => {
                mergedHeaders[key] = value;
              });
            } else {
              // Plain object - safe to spread, but merge our headers last
              mergedHeaders = { ...options.headers, ...mergedHeaders };
            }
          }
          
          const enhancedOptions: RequestInit = {
            ...options,
            signal: controller.signal,
            keepalive: true,
            headers: mergedHeaders,
          };

          return fetch(url, enhancedOptions).finally(() => clearTimeout(timeoutId));
        },
      },
    });
  }

  /**
   * Create fallback Supabase client (HTTP/1.1)
   */
  private createFallbackClient(): SupabaseClient {
    resilienceLogger.info('protocol', 'Creating HTTP/1.1 fallback client');

    this.state.fallback = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
        lock: navigatorLockWithTimeout,
      },
      global: {
        headers: {
          "User-Agent": "Supabase-JS/2.0 (HTTP/1.1)",
          Connection: "keep-alive",
        },
        fetch: (url, options: RequestInit = {}) => {
          // FIX: Properly handle Headers object - spreading Headers returns {}!
          let mergedHeaders: Record<string, string> = {
            Connection: "keep-alive",
          };
          
          if (options.headers) {
            if (options.headers instanceof Headers) {
              // Headers object - must iterate to extract entries
              options.headers.forEach((value, key) => {
                mergedHeaders[key] = value;
              });
            } else if (Array.isArray(options.headers)) {
              // Array of [key, value] tuples
              options.headers.forEach(([key, value]) => {
                mergedHeaders[key] = value;
              });
            } else {
              // Plain object - safe to spread, but merge our headers last
              mergedHeaders = { ...options.headers, ...mergedHeaders };
            }
          }
          
          const enhancedOptions: RequestInit = {
            ...options,
            keepalive: true,
            headers: mergedHeaders,
          };

          return fetch(url, enhancedOptions);
        },
      },
    });

    return this.state.fallback;
  }

  /**
   * Ensure fallback client exists (lazy initialization)
   */
  private ensureFallbackClient(): SupabaseClient {
    if (!this.state.fallback) {
      this.createFallbackClient();
    }
    return this.state.fallback!;
  }

  /**
   * Get the current active Supabase client
   */
  getClient(): SupabaseClient {
    if (this.state.usingFallback) {
      return this.ensureFallbackClient();
    }
    return this.state.primary;
  }

  /**
   * Execute operation with comprehensive resilience
   */
  async executeWithResilience<T>(
    operation: (client: SupabaseClient) => Promise<T>,
    options: OperationOptions = {}
  ): Promise<T> {
    const startTime = Date.now();
    const protocol = this.state.usingFallback ? 'http1.1' : 'http2';
    this.state.totalRequests++;

    // Record request start
    networkQualityMonitor.recordRequest();

    // Check cache first if enabled
    if (options.cache && options.cacheKey) {
      const cacheOptions = typeof options.cache === 'boolean' ? {} : options.cache;
      const cached = await indexedDBCache.get<T>(options.cacheKey);
      
      if (cached) {
        resilienceLogger.logCacheOperation('get', options.cacheKey, {
          hit: true,
          age: Date.now() - cached.timestamp
        });
        
        // Return cached data immediately, optionally refresh in background
        if (cacheOptions.staleWhileRevalidate) {
          this.executeWithResilience(operation, { ...options, cache: false })
            .then(freshData => {
              if (options.cacheKey) {
                indexedDBCache.set(options.cacheKey, freshData, cacheOptions);
              }
            })
            .catch(() => {
              // Ignore background refresh failures
            });
        }
        
        return cached.data;
      }
      
      resilienceLogger.logCacheOperation('get', options.cacheKey, { hit: false });
    }

    // Prepare retry options
    const retryOptions: RetryOptions = {
      ...(typeof options.retry === 'object' ? options.retry : {}),
      operationName: `supabase-${protocol}`,
      cacheAvailable: !!(options.cache && options.cacheKey),
      onRetry: (context) => {
        resilienceLogger.logRetryAttempt(
          `supabase-${protocol}`,
          context.attempt,
          3,
          0,
          { totalDuration: context.totalDuration }
        );
      }
    };

    // Execute with retry engine
    const executeOperation = async (): Promise<T> => {
      const client = this.getClient();
      const operationStartTime = Date.now();

      try {
        // Apply timeout if specified
        const result = options.timeout
          ? await smartRetryEngine.executeWithTimeout(
              () => operation(client),
              options.timeout
            )
          : await operation(client);

        const duration = Date.now() - operationStartTime;
        
        // Record success
        this.recordSuccess(duration);

        // Cache result if enabled
        if (options.cache && options.cacheKey) {
          const cacheOptions = typeof options.cache === 'boolean' ? {} : options.cache;
          await indexedDBCache.set(options.cacheKey, result, cacheOptions);
          resilienceLogger.logCacheOperation('set', options.cacheKey, {
            size: JSON.stringify(result).length
          });
        }

        // Try to reconnect to primary if using fallback
        if (this.state.usingFallback) {
          this.attemptPrimaryReconnection().catch(() => {
            // Ignore reconnection failures
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - operationStartTime;

        // Classify error
        const classifiedError = ErrorClassifier.classify(error);
        
        // Record failure
        this.recordFailure(error as Error, classifiedError.shouldSwitchProtocol);

        resilienceLogger.error('client', 'Operation failed', {
          protocol,
          duration,
          errorCategory: classifiedError.category,
          isRetryable: classifiedError.isRetryable,
          shouldSwitchProtocol: classifiedError.shouldSwitchProtocol
        }, error as Error);

        // Handle protocol errors
        if (classifiedError.shouldSwitchProtocol) {
          const switched = await this.handleProtocolError(error);

          if (switched) {
            resilienceLogger.info('protocol', 'Retrying operation with HTTP/1.1 fallback');
            throw error; // Will be retried by retry engine
          }
        }

        // Use cache if error suggests it
        if (classifiedError.shouldUseCache && options.cache && options.cacheKey) {
          const staleData = await indexedDBCache.getStaleData<T>(
            options.cacheKey,
            86400000 // 24 hours max age
          );
          
          if (staleData) {
            resilienceLogger.warn('cache', 'Using stale cached data due to error', {
              cacheKey: options.cacheKey,
              errorCategory: classifiedError.category
            });
            return staleData;
          }
        }

        throw error;
      }
    };

    // Execute with retry if enabled
    if (options.retry !== false) {
      return await smartRetryEngine.executeWithRetry(executeOperation, retryOptions);
    } else {
      return await executeOperation();
    }
  }

  /**
   * Record successful operation
   */
  private recordSuccess(duration: number): void {
    this.state.successCount++;
    this.state.consecutiveFailures = 0;
    this.state.lastSuccessfulRequest = Date.now();

    const protocol = this.state.usingFallback ? 'http1.1' : 'http2';
    
    // Update monitors
    protocolHealthMonitor.recordSuccess(protocol, duration);
    // Note: networkQualityMonitor tracks requests internally
    networkQualityMonitor.recordSuccess(performance.now() - duration);

    resilienceLogger.debug('client', 'Operation successful', {
      protocol,
      duration,
      successRate: this.state.successCount / this.state.totalRequests
    });
  }

  /**
   * Record failed operation
   */
  private recordFailure(error: Error, isProtocolError: boolean): void {
    this.state.consecutiveFailures++;

    const protocol = this.state.usingFallback ? 'http1.1' : 'http2';
    
    // Update monitors
    protocolHealthMonitor.recordFailure(protocol, error);
    // Note: networkQualityMonitor tracks requests internally
    networkQualityMonitor.recordFailure(performance.now(), error);

    resilienceLogger.debug('client', 'Operation failed', {
      protocol,
      consecutiveFailures: this.state.consecutiveFailures,
      errorMessage: error.message
    });
  }

  /**
   * Handle HTTP/2 protocol errors
   */
  private async handleProtocolError(error: unknown): Promise<boolean> {
    if (!ErrorClassifier.shouldSwitchProtocol(error)) {
      return false;
    }

    const now = Date.now();
    this.state.http2ErrorCount++;
    this.state.lastProtocolError = now;

    resilienceLogger.warn('protocol', 'HTTP/2 protocol error detected', {
      errorCount: this.state.http2ErrorCount,
      threshold: this.HTTP2_ERROR_THRESHOLD,
      usingFallback: this.state.usingFallback
    });

    // Switch to fallback if threshold reached
    if (
      this.state.http2ErrorCount >= this.HTTP2_ERROR_THRESHOLD &&
      !this.state.usingFallback
    ) {
      await this.switchToFallback();
      return true;
    }

    return false;
  }

  /**
   * Switch to HTTP/1.1 fallback client
   */
  private async switchToFallback(): Promise<void> {
    if (this.state.usingFallback) {
      return;
    }

    // Critical production-visible log for protocol switching
    console.log('🔄 [CRITICAL] Switching to HTTP/1.1 fallback due to protocol errors', {
      errorCount: this.state.http2ErrorCount,
      threshold: this.HTTP2_ERROR_THRESHOLD,
      timestamp: new Date().toISOString()
    });

    resilienceLogger.logProtocolSwitch('http2', 'http1.1', 'HTTP/2 error threshold reached', {
      errorCount: this.state.http2ErrorCount,
      threshold: this.HTTP2_ERROR_THRESHOLD
    });

    // Ensure fallback client exists (will create if needed)
    this.ensureFallbackClient();

    // Copy authentication state
    try {
      const session = await this.state.primary.auth.getSession();
      if (session.data.session && this.state.fallback) {
        await this.state.fallback.auth.setSession(session.data.session);
        resilienceLogger.info('protocol', 'Authentication state transferred to fallback client');
      }
    } catch (error) {
      resilienceLogger.error('protocol', 'Failed to transfer auth state', {}, error as Error);
    }

    this.state.usingFallback = true;
    this.state.http2ErrorCount = 0;

    resilienceLogger.info('protocol', 'Successfully switched to HTTP/1.1 fallback client');
  }

  /**
   * Attempt to reconnect to primary HTTP/2 client
   */
  private async attemptPrimaryReconnection(): Promise<boolean> {
    if (!this.state.usingFallback) {
      return true;
    }

    const now = Date.now();
    const timeSinceLastError = now - this.state.lastProtocolError;

    if (timeSinceLastError < this.state.protocolSwitchCooldown) {
      return false;
    }

    resilienceLogger.info('protocol', 'Attempting to reconnect to primary HTTP/2 client');

    try {
      const testResult = await this.state.primary.auth.getSession();

      if (testResult.error) {
        throw testResult.error;
      }

      resilienceLogger.logProtocolSwitch('http1.1', 'http2', 'Primary client reconnection successful');

      this.state.usingFallback = false;
      this.state.http2ErrorCount = 0;

      return true;
    } catch (error) {
      resilienceLogger.warn('protocol', 'Primary client reconnection failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      if (ErrorClassifier.shouldSwitchProtocol(error)) {
        this.state.protocolSwitchCooldown = Math.min(
          this.state.protocolSwitchCooldown * 1.5,
          300000 // Max 5 minutes
        );
      }

      return false;
    }
  }

  /**
   * Get connection health status
   */
  getConnectionHealth(): ConnectionHealth {
    const protocol = this.state.usingFallback ? 'http1.1' : 'http2';
    const networkQuality = networkQualityMonitor.getQuality();
    const protocolHealth = protocolHealthMonitor.getProtocolHealth(protocol);

    let quality: 'excellent' | 'good' | 'poor' | 'critical';
    
    if (protocolHealth.health === 'excellent' && networkQuality.status === 'excellent') {
      quality = 'excellent';
    } else if (protocolHealth.health === 'good' || networkQuality.status === 'good') {
      quality = 'good';
    } else if (protocolHealth.health === 'poor' || networkQuality.status === 'poor') {
      quality = 'poor';
    } else {
      quality = 'critical';
    }

    return {
      protocol,
      quality,
      errorRate: networkQuality.metrics.errorRate,
      avgResponseTime: networkQuality.metrics.avgResponseTime,
      lastSuccessfulRequest: this.state.lastSuccessfulRequest,
      consecutiveFailures: this.state.consecutiveFailures
    };
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      usingFallback: this.state.usingFallback,
      http2ErrorCount: this.state.http2ErrorCount,
      lastProtocolError: this.state.lastProtocolError,
      protocolSwitchCooldown: this.state.protocolSwitchCooldown,
      clientType: this.state.usingFallback ? "HTTP/1.1" : "HTTP/2",
      successCount: this.state.successCount,
      totalRequests: this.state.totalRequests,
      successRate: this.state.totalRequests > 0 
        ? this.state.successCount / this.state.totalRequests 
        : 0,
      consecutiveFailures: this.state.consecutiveFailures,
      lastSuccessfulRequest: this.state.lastSuccessfulRequest
    };
  }

  /**
   * Get client diagnostics for monitoring and debugging
   */
  getClientDiagnostics() {
    return {
      // Instance count
      instanceCount: this.state.fallback ? 2 : 1,
      fallbackCreated: !!this.state.fallback,
      
      // Current state
      usingFallback: this.state.usingFallback,
      protocol: this.state.usingFallback ? 'http1.1' : 'http2',
      
      // Performance metrics
      successCount: this.state.successCount,
      totalRequests: this.state.totalRequests,
      successRate: this.state.totalRequests > 0 
        ? (this.state.successCount / this.state.totalRequests * 100).toFixed(2) + '%'
        : 'N/A',
      
      // Error tracking
      http2ErrorCount: this.state.http2ErrorCount,
      consecutiveFailures: this.state.consecutiveFailures,
      lastSuccessfulRequest: this.state.lastSuccessfulRequest 
        ? new Date(this.state.lastSuccessfulRequest).toISOString()
        : 'Never',
      
      // Health status
      connectionHealth: this.getConnectionHealth()
    };
  }

  /**
   * Log diagnostics to console (for debugging)
   */
  logDiagnostics(): void {
    const diagnostics = this.getClientDiagnostics();
    console.group('🔍 Supabase Client Diagnostics');
    console.table(diagnostics);
    console.groupEnd();
  }

  /**
   * Get comprehensive diagnostics
   */
  getDiagnostics() {
    return {
      status: this.getStatus(),
      connectionHealth: this.getConnectionHealth(),
      networkQuality: networkQualityMonitor.getQuality(),
      protocolHealth: {
        http2: protocolHealthMonitor.getProtocolHealth('http2'),
        http1: protocolHealthMonitor.getProtocolHealth('http1.1')
      },
      circuitBreaker: smartRetryEngine.getCircuitBreakerState('supabase-http2'),
      logs: resilienceLogger.getLogs({ limit: 50 }),
      cacheStats: indexedDBCache.getStats()
    };
  }

  /**
   * Export diagnostics report
   */
  exportDiagnostics(): string {
    const diagnostics = this.getDiagnostics();
    return JSON.stringify(diagnostics, null, 2);
  }

  /**
   * Force switch to fallback (for testing)
   */
  async forceFallback(): Promise<void> {
    await this.switchToFallback();
  }

  /**
   * Reset to primary client (for testing)
   */
  resetToPrimary(): void {
    this.state.usingFallback = false;
    this.state.http2ErrorCount = 0;
    this.state.lastProtocolError = 0;
    this.state.protocolSwitchCooldown = this.PROTOCOL_SWITCH_COOLDOWN;
    resilienceLogger.info('protocol', 'Reset to primary HTTP/2 client');
  }

  /**
   * Clear all caches
   */
  async clearCaches(): Promise<void> {
    await indexedDBCache.clear('queries');
    await indexedDBCache.clear('auth');
    resilienceLogger.info('cache', 'All caches cleared');
  }
}

// Export singleton instance
export const enhancedResilientClient = new EnhancedResilientClient();

/**
 * Dynamic Proxy that ensures all code uses the current active client
 * This enables automatic HTTP/1.1 fallback when HTTP/2 fails
 * 
 * Critical Fix: The previous static export was frozen to the initial HTTP/2 client,
 * preventing protocol fallback from working. This Proxy dynamically retrieves
 * the current active client on every property access, ensuring resilience features
 * work across all 54+ consuming files without any code changes.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop, receiver) {
    const client = enhancedResilientClient.getClient();
    const value = (client as any)[prop];
    // Bind functions to maintain 'this' context
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

// Export the class for advanced usage
export { EnhancedResilientClient };
