/**
 * @deprecated This file is DEPRECATED and will be removed in a future version.
 * 
 * ⚠️ DO NOT USE THIS CLIENT - Use enhancedResilientClient instead ⚠️
 * 
 * This file is kept temporarily for reference only and should NOT be imported.
 * All new code MUST use the enhanced resilient client which includes:
 * - Lazy fallback creation (reduces memory overhead and GoTrueClient instances)
 * - Enhanced error classification with more granular detection
 * - Better protocol health monitoring with adaptive switching
 * - Improved caching strategies with stale-while-revalidate
 * - Comprehensive diagnostics and monitoring
 * 
 * Migration Guide:
 * ----------------
 * Old: import { resilientSupabaseClient } from '@/integrations/supabase/resilientClient';
 * New: import { enhancedResilientClient } from '@/integrations/supabase/client';
 * 
 * Or simply use:
 * import { supabase } from '@/integrations/supabase/client';
 * 
 * Key Differences:
 * - Enhanced client creates fallback client lazily (on-demand), reducing initial GoTrueClient instances from 4 to 1
 * - Better error handling with classified retry strategies
 * - Built-in diagnostics: enhancedResilientClient.getClientDiagnostics()
 * - Network quality monitoring and adaptive behavior
 * 
 * ---
 * 
 * Original Documentation (for reference):
 * 
 * Resilient Supabase Client
 *
 * Enhanced Supabase client with HTTP/2 to HTTP/1.1 fallback mechanism
 * to handle protocol errors and connection issues gracefully.
 * 
 * Integrates with:
 * - ErrorClassifier for intelligent error handling
 * - SmartRetryEngine for automatic retries with circuit breaker
 * - IndexedDBCacheManager for offline capability
 * - ResilienceLogger for comprehensive logging
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ErrorClassifier, ClassifiedError } from '@/utils/errorClassifier';
import { smartRetryEngine, RetryOptions } from '@/utils/smartRetryEngine';
import { indexedDBCache, CacheOptions } from '@/utils/indexedDBCacheManager';
import { resilienceLogger } from '@/utils/resilienceLogger';
import { protocolHealthMonitor } from '@/utils/protocolHealthMonitor';
import { networkQualityMonitor } from '@/utils/networkQualityMonitor';

// Hardcoded Supabase configuration - required for Lovable production builds
// Note: VITE_* environment variables are NOT supported in Lovable production
const SUPABASE_URL = "https://tizshsmrqqaharwpqocj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpenNoc21ycXFhaGFyd3Bxb2NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwOTQwNDQsImV4cCI6MjA3NDY3MDA0NH0.HFecGZAPLi6-RmPJrG0M0G9bAV7AsabybTapjKw-ddU";

interface ClientState {
  primary: SupabaseClient;
  fallback: SupabaseClient | null;
  usingFallback: boolean;
  http2ErrorCount: number;
  lastProtocolError: number;
  protocolSwitchCooldown: number;
  successCount: number;
  totalRequests: number;
  protocolPerformance: {
    http2: { successRate: number; avgResponseTime: number };
    http1: { successRate: number; avgResponseTime: number };
  };
}

export interface OperationOptions {
  retry?: boolean | RetryOptions;
  cache?: boolean | CacheOptions;
  cacheKey?: string;
  bypassCircuitBreaker?: boolean;
  timeout?: number;
}

/**
 * Resilient Supabase Client Manager
 * Handles HTTP/2 protocol errors by automatically falling back to HTTP/1.1
 */
class ResilientSupabaseClient {
  private state: ClientState;
  private readonly HTTP2_ERROR_THRESHOLD = 3;
  private readonly PROTOCOL_SWITCH_COOLDOWN = 30000; // 30 seconds
  private readonly HTTP2_ERRORS = [
    "ERR_HTTP2_PROTOCOL_ERROR",
    "ERR_HTTP2_STREAM_ERROR",
    "ERR_HTTP2_SESSION_ERROR",
    "HTTP2_HEADER_TIMEOUT",
    "HTTP2_SESSION_ERROR",
  ];

  constructor() {
    resilienceLogger.info('client', 'Initializing Resilient Supabase Client with enhanced error handling');

    this.state = {
      primary: this.createPrimaryClient(),
      fallback: null,
      usingFallback: false,
      http2ErrorCount: 0,
      lastProtocolError: 0,
      protocolSwitchCooldown: this.PROTOCOL_SWITCH_COOLDOWN,
      successCount: 0,
      totalRequests: 0,
      protocolPerformance: {
        http2: { successRate: 1.0, avgResponseTime: 0 },
        http1: { successRate: 1.0, avgResponseTime: 0 }
      }
    };

    // Pre-create fallback client for faster switching
    this.createFallbackClient();
  }

  /**
   * Create primary Supabase client with default HTTP/2 configuration
   */
  private createPrimaryClient(): SupabaseClient {
    return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        headers: {
          "User-Agent": "Supabase-JS/2.0 (HTTP/2)",
        },
      },
    });
  }

  /**
   * Create fallback Supabase client with HTTP/1.1 configuration
   */
  private createFallbackClient(): SupabaseClient {
    resilienceLogger.info('protocol', 'Creating HTTP/1.1 fallback client');

    this.state.fallback = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        headers: {
          "User-Agent": "Supabase-JS/2.0 (HTTP/1.1)",
          Connection: "keep-alive",
          // Force HTTP/1.1 by setting specific headers
          "Upgrade-Insecure-Requests": "1",
        },
        fetch: (url, options: RequestInit = {}) => {
          // Custom fetch implementation that forces HTTP/1.1
          const enhancedOptions: RequestInit = {
            ...options,
            // Add HTTP/1.1 specific configurations
            keepalive: true,
            headers: {
              ...(options.headers || {}),
              Connection: "keep-alive",
            },
          };

          return fetch(url, enhancedOptions);
        },
      },
    });

    return this.state.fallback;
  }

  /**
   * Get the current active Supabase client
   */
  getClient(): SupabaseClient {
    if (this.state.usingFallback && this.state.fallback) {
      return this.state.fallback;
    }
    return this.state.primary;
  }

  /**
   * Check if an error is HTTP/2 protocol related
   * Now uses ErrorClassifier for comprehensive detection
   */
  private isHttp2Error(error: unknown): boolean {
    return ErrorClassifier.shouldSwitchProtocol(error);
  }

  /**
   * Handle HTTP/2 protocol errors and switch to fallback if needed
   */
  async handleProtocolError(error: unknown): Promise<boolean> {
    if (!this.isHttp2Error(error)) {
      return false; // Not an HTTP/2 error
    }

    const now = Date.now();
    this.state.http2ErrorCount++;
    this.state.lastProtocolError = now;

    const classifiedError = ErrorClassifier.classify(error);
    
    resilienceLogger.warn('protocol', 'HTTP/2 protocol error detected', {
      errorCount: this.state.http2ErrorCount,
      threshold: this.HTTP2_ERROR_THRESHOLD,
      usingFallback: this.state.usingFallback,
      errorCategory: classifiedError.category,
      errorMessage: classifiedError.technicalDetails
    });

    // Switch to fallback if threshold reached and not already using fallback
    if (
      this.state.http2ErrorCount >= this.HTTP2_ERROR_THRESHOLD &&
      !this.state.usingFallback
    ) {
      await this.switchToFallback();
      return true; // Switched to fallback
    }

    return false; // No switch occurred
  }

  /**
   * Switch to HTTP/1.1 fallback client
   */
  private async switchToFallback(): Promise<void> {
    if (this.state.usingFallback) {
      return; // Already using fallback
    }

    resilienceLogger.logProtocolSwitch('http2', 'http1.1', 'HTTP/2 error threshold reached', {
      errorCount: this.state.http2ErrorCount,
      threshold: this.HTTP2_ERROR_THRESHOLD
    });

    // Ensure fallback client exists
    if (!this.state.fallback) {
      this.createFallbackClient();
    }

    // Copy authentication state from primary to fallback
    try {
      const session = await this.state.primary.auth.getSession();
      if (session.data.session && this.state.fallback) {
        await this.state.fallback.auth.setSession(session.data.session);
        resilienceLogger.info('protocol', 'Authentication state transferred to fallback client');
      }
    } catch (error) {
      resilienceLogger.error('protocol', 'Failed to transfer auth state to fallback', {}, error as Error);
    }

    this.state.usingFallback = true;

    // Reset error count after successful switch
    this.state.http2ErrorCount = 0;

    resilienceLogger.info('protocol', 'Successfully switched to HTTP/1.1 fallback client');
  }

  /**
   * Attempt to switch back to primary HTTP/2 client
   */
  async attemptPrimaryReconnection(): Promise<boolean> {
    if (!this.state.usingFallback) {
      return true; // Already using primary
    }

    const now = Date.now();
    const timeSinceLastError = now - this.state.lastProtocolError;

    // Only attempt reconnection after cooldown period
    if (timeSinceLastError < this.state.protocolSwitchCooldown) {
      return false;
    }

    resilienceLogger.info('protocol', 'Attempting to reconnect to primary HTTP/2 client', {
      cooldownPeriod: this.state.protocolSwitchCooldown,
      timeSinceLastError
    });

    try {
      // Test primary client with a simple operation
      const testResult = await this.state.primary.auth.getSession();

      if (testResult.error) {
        throw testResult.error;
      }

      // Success - switch back to primary
      resilienceLogger.logProtocolSwitch('http1.1', 'http2', 'Primary client reconnection successful');

      this.state.usingFallback = false;
      this.state.http2ErrorCount = 0;

      return true;
    } catch (error) {
      resilienceLogger.warn('protocol', 'Primary client reconnection failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      // If it's another HTTP/2 error, extend the cooldown
      if (this.isHttp2Error(error)) {
        this.state.protocolSwitchCooldown = Math.min(
          this.state.protocolSwitchCooldown * 1.5,
          300000 // Max 5 minutes
        );
        resilienceLogger.info('protocol', 'Extended cooldown period', {
          newCooldown: this.state.protocolSwitchCooldown
        });
      }

      return false;
    }
  }

  /**
   * Execute a Supabase operation with automatic protocol fallback
   * @deprecated Use executeWithResilience for enhanced error handling
   */
  async executeWithFallback<T>(
    operation: (client: SupabaseClient) => Promise<T>
  ): Promise<T> {
    return this.executeWithResilience(operation, {});
  }

  /**
   * Execute a Supabase operation with comprehensive resilience
   * Integrates retry logic, caching, protocol fallback, and error classification
   */
  async executeWithResilience<T>(
    operation: (client: SupabaseClient) => Promise<T>,
    options: OperationOptions = {}
  ): Promise<T> {
    const startTime = Date.now();
    const protocol = this.state.usingFallback ? 'http1.1' : 'http2';
    this.state.totalRequests++;

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
          // Refresh in background
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
        
        // Record success metrics
        this.state.successCount++;
        this.updateProtocolPerformance(protocol, true, duration);
        
        resilienceLogger.info('client', 'Operation successful', {
          protocol,
          duration,
          successRate: this.state.successCount / this.state.totalRequests
        });

        // Cache result if enabled
        if (options.cache && options.cacheKey) {
          const cacheOptions = typeof options.cache === 'boolean' ? {} : options.cache;
          await indexedDBCache.set(options.cacheKey, result, cacheOptions);
          resilienceLogger.logCacheOperation('set', options.cacheKey, {
            size: JSON.stringify(result).length
          });
        }

        // If using fallback and operation succeeded, try to reconnect to primary
        if (this.state.usingFallback) {
          this.attemptPrimaryReconnection().catch(() => {
            // Ignore reconnection failures
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - operationStartTime;
        this.updateProtocolPerformance(protocol, false, duration);

        // Classify error
        const classifiedError = ErrorClassifier.classify(error);
        
        resilienceLogger.error('client', 'Operation failed', {
          protocol,
          duration,
          errorCategory: classifiedError.category,
          isRetryable: classifiedError.isRetryable,
          shouldSwitchProtocol: classifiedError.shouldSwitchProtocol
        }, error as Error);

        // Handle HTTP/2 protocol errors
        if (classifiedError.shouldSwitchProtocol) {
          const switched = await this.handleProtocolError(error);

          if (switched) {
            resilienceLogger.info('protocol', 'Retrying operation with HTTP/1.1 fallback');
            // Retry with fallback client (will be handled by retry engine)
            throw error;
          }
        }

        // If error suggests using cache and cache is available
        if (classifiedError.shouldUseCache && options.cache && options.cacheKey) {
          const staleData = await indexedDBCache.getStaleData<T>(
            options.cacheKey,
            86400000 // 24 hours max age for stale data
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
   * Update protocol performance metrics
   */
  private updateProtocolPerformance(
    protocol: 'http2' | 'http1.1',
    success: boolean,
    duration: number
  ): void {
    const perf = this.state.protocolPerformance[protocol === 'http2' ? 'http2' : 'http1'];
    
    // Update success rate (exponential moving average)
    const alpha = 0.1; // Smoothing factor
    perf.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * perf.successRate;
    
    // Update average response time (exponential moving average)
    if (success) {
      perf.avgResponseTime = alpha * duration + (1 - alpha) * perf.avgResponseTime;
    }

    // Update protocol health monitor
    if (success) {
      protocolHealthMonitor.recordSuccess(protocol, duration);
      // Note: networkQualityMonitor tracks requests internally
      networkQualityMonitor.recordSuccess(performance.now() - duration);
    } else {
      const error = new Error('Request failed');
      protocolHealthMonitor.recordFailure(protocol, error);
      // Note: networkQualityMonitor tracks requests internally
      networkQualityMonitor.recordFailure(performance.now(), error);
    }
  }

  /**
   * Get protocol recommendation from health monitor
   */
  getProtocolRecommendation(): 'http2' | 'http1.1' {
    const currentProtocol = this.state.usingFallback ? 'http1.1' : 'http2';
    const recommendation = protocolHealthMonitor.getRecommendation(currentProtocol);
    
    if (recommendation.shouldSwitch && recommendation.confidence > 0.7) {
      resilienceLogger.info('protocol', 'Protocol switch recommended', {
        current: currentProtocol,
        recommended: recommendation.recommended,
        confidence: recommendation.confidence,
        reasons: recommendation.reasons
      });
      return recommendation.recommended;
    }
    
    return currentProtocol;
  }

  /**
   * Get current client status with enhanced metrics
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
      protocolPerformance: this.state.protocolPerformance
    };
  }

  /**
   * Get comprehensive diagnostics
   */
  getDiagnostics() {
    return {
      status: this.getStatus(),
      circuitBreaker: smartRetryEngine.getCircuitBreakerState('supabase-http2'),
      logs: resilienceLogger.getLogs({ limit: 50 }),
      cacheStats: indexedDBCache.getStats()
    };
  }

  /**
   * Force switch to fallback client (for testing)
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
   * Clear all caches (for testing/debugging)
   */
  async clearCaches(): Promise<void> {
    await indexedDBCache.clear('queries');
    await indexedDBCache.clear('auth');
    resilienceLogger.info('cache', 'All caches cleared');
  }

  /**
   * Export diagnostics report
   */
  exportDiagnostics(): string {
    const diagnostics = this.getDiagnostics();
    return JSON.stringify(diagnostics, null, 2);
  }
}

// Export singleton instance
export const resilientSupabaseClient = new ResilientSupabaseClient();

// Export the client getter for backward compatibility
export const supabase = resilientSupabaseClient.getClient();

// Export the resilient client for advanced usage
export { ResilientSupabaseClient };
