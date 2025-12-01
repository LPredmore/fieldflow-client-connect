/**
 * Resilience Logger
 * 
 * Comprehensive logging system for network resilience operations.
 * Provides structured logging with sanitization and diagnostics export.
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  context?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface NetworkLogEntry extends LogEntry {
  category: 'network';
  context: {
    url?: string;
    method?: string;
    status?: number;
    duration?: number;
    protocol?: 'http2' | 'http1.1';
    retryCount?: number;
    cacheHit?: boolean;
  };
}

export interface ErrorLogEntry extends LogEntry {
  category: 'error';
  context: {
    errorType: string;
    isRetryable: boolean;
    severity: string;
    operation?: string;
  };
}

export interface CacheLogEntry extends LogEntry {
  category: 'cache';
  context: {
    operation: 'get' | 'set' | 'delete' | 'invalidate';
    key: string;
    hit?: boolean;
    age?: number;
    size?: number;
  };
}

export interface ProtocolLogEntry extends LogEntry {
  category: 'protocol';
  context: {
    from: 'http2' | 'http1.1';
    to: 'http2' | 'http1.1';
    reason: string;
    errorCount?: number;
  };
}

/**
 * Resilience Logger
 * 
 * Centralized logging for all resilience operations
 */
export class ResilienceLogger {
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 1000; // Keep last 1000 logs
  private readonly SENSITIVE_PATTERNS = [
    /password/i,
    /token/i,
    /secret/i,
    /api[_-]?key/i,
    /authorization/i,
    /bearer/i
  ];

  /**
   * Log debug message
   */
  debug(category: string, message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, category, message, context);
  }

  /**
   * Log info message
   */
  info(category: string, message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, category, message, context);
  }

  /**
   * Log warning message
   */
  warn(category: string, message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, category, message, context);
  }

  /**
   * Log error message
   */
  error(category: string, message: string, context?: Record<string, any>, error?: Error): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: LogLevel.ERROR,
      category,
      message,
      context: context ? this.sanitizeContext(context) : undefined,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : undefined
    };

    this.addLog(entry);
    console.error(`[${category}] ${message}`, context, error);
  }

  /**
   * Log critical message
   */
  critical(category: string, message: string, context?: Record<string, any>, error?: Error): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: LogLevel.CRITICAL,
      category,
      message,
      context: context ? this.sanitizeContext(context) : undefined,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : undefined
    };

    this.addLog(entry);
    console.error(`[${category}] CRITICAL: ${message}`, context, error);
  }

  /**
   * Log network request
   */
  logNetworkRequest(
    url: string,
    method: string,
    protocol: 'http2' | 'http1.1',
    context?: Record<string, any>
  ): void {
    this.info('network', `${method} ${url}`, {
      url: this.sanitizeUrl(url),
      method,
      protocol,
      ...context
    });
  }

  /**
   * Log network response
   */
  logNetworkResponse(
    url: string,
    status: number,
    duration: number,
    context?: Record<string, any>
  ): void {
    const level = status >= 500 ? LogLevel.ERROR : status >= 400 ? LogLevel.WARN : LogLevel.INFO;
    
    this.log(level, 'network', `Response ${status} in ${duration}ms`, {
      url: this.sanitizeUrl(url),
      status,
      duration,
      ...context
    });
  }

  /**
   * Log network error
   */
  logNetworkError(
    url: string,
    error: Error,
    context?: Record<string, any>
  ): void {
    this.error('network', `Network error: ${error.message}`, {
      url: this.sanitizeUrl(url),
      ...context
    }, error);
  }

  /**
   * Log cache operation
   */
  logCacheOperation(
    operation: 'get' | 'set' | 'delete' | 'invalidate',
    key: string,
    context?: Record<string, any>
  ): void {
    this.debug('cache', `Cache ${operation}: ${key}`, {
      operation,
      key,
      ...context
    });
  }

  /**
   * Log protocol switch
   */
  logProtocolSwitch(
    from: 'http2' | 'http1.1',
    to: 'http2' | 'http1.1',
    reason: string,
    context?: Record<string, any>
  ): void {
    this.warn('protocol', `Protocol switch: ${from} → ${to}`, {
      from,
      to,
      reason,
      ...context
    });
  }

  /**
   * Log retry attempt
   */
  logRetryAttempt(
    operation: string,
    attempt: number,
    maxAttempts: number,
    delay: number,
    context?: Record<string, any>
  ): void {
    this.info('retry', `Retry attempt ${attempt}/${maxAttempts} for ${operation} (delay: ${delay}ms)`, {
      operation,
      attempt,
      maxAttempts,
      delay,
      ...context
    });
  }

  /**
   * Log circuit breaker state change
   */
  logCircuitBreakerStateChange(
    operation: string,
    state: 'OPEN' | 'CLOSED' | 'HALF_OPEN',
    context?: Record<string, any>
  ): void {
    const level = state === 'OPEN' ? LogLevel.ERROR : LogLevel.INFO;
    
    this.log(level, 'circuit-breaker', `Circuit breaker ${state} for ${operation}`, {
      operation,
      state,
      ...context
    });
  }

  /**
   * Generic log method
   */
  private log(level: LogLevel, category: string, message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      context: context ? this.sanitizeContext(context) : undefined
    };

    this.addLog(entry);

    // Console output based on level
    const consoleMethod = level === LogLevel.ERROR || level === LogLevel.CRITICAL ? 'error' :
                         level === LogLevel.WARN ? 'warn' :
                         level === LogLevel.DEBUG ? 'debug' : 'log';
    
    console[consoleMethod](`[${category}] ${message}`, context);
  }

  /**
   * Add log entry to buffer
   */
  private addLog(entry: LogEntry): void {
    this.logs.push(entry);

    // Keep only last MAX_LOGS entries
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }
  }

  /**
   * Sanitize context to remove sensitive data
   */
  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(context)) {
      // Check if key contains sensitive pattern
      if (this.SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Recursively sanitize objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeContext(value);
      } else if (typeof value === 'string' && value.length > 1000) {
        // Truncate very long strings
        sanitized[key] = value.substring(0, 1000) + '... [truncated]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize URL to remove sensitive query parameters
   */
  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // Remove sensitive query parameters
      for (const key of urlObj.searchParams.keys()) {
        if (this.SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
          urlObj.searchParams.set(key, '[REDACTED]');
        }
      }

      return urlObj.toString();
    } catch {
      // If URL parsing fails, return as-is
      return url;
    }
  }

  /**
   * Get logs filtered by criteria
   */
  getLogs(filter?: {
    level?: LogLevel;
    category?: string;
    since?: number;
    limit?: number;
  }): LogEntry[] {
    let filtered = [...this.logs];

    if (filter?.level) {
      filtered = filtered.filter(log => log.level === filter.level);
    }

    if (filter?.category) {
      filtered = filtered.filter(log => log.category === filter.category);
    }

    if (filter?.since) {
      filtered = filtered.filter(log => log.timestamp >= filter.since);
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  /**
   * Get error logs
   */
  getErrors(since?: number): ErrorLogEntry[] {
    return this.getLogs({
      level: LogLevel.ERROR,
      since
    }) as ErrorLogEntry[];
  }

  /**
   * Get network logs
   */
  getNetworkLogs(since?: number): NetworkLogEntry[] {
    return this.getLogs({
      category: 'network',
      since
    }) as NetworkLogEntry[];
  }

  /**
   * Get cache logs
   */
  getCacheLogs(since?: number): CacheLogEntry[] {
    return this.getLogs({
      category: 'cache',
      since
    }) as CacheLogEntry[];
  }

  /**
   * Get protocol logs
   */
  getProtocolLogs(since?: number): ProtocolLogEntry[] {
    return this.getLogs({
      category: 'protocol',
      since
    }) as ProtocolLogEntry[];
  }

  /**
   * Export diagnostics report
   */
  exportDiagnostics(): string {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalLogs: this.logs.length,
        errors: this.logs.filter(l => l.level === LogLevel.ERROR || l.level === LogLevel.CRITICAL).length,
        warnings: this.logs.filter(l => l.level === LogLevel.WARN).length,
        networkRequests: this.logs.filter(l => l.category === 'network').length,
        cacheOperations: this.logs.filter(l => l.category === 'cache').length,
        protocolSwitches: this.logs.filter(l => l.category === 'protocol').length
      },
      recentErrors: this.getErrors(Date.now() - 3600000), // Last hour
      recentNetworkLogs: this.getNetworkLogs(Date.now() - 3600000),
      recentProtocolLogs: this.getProtocolLogs(Date.now() - 3600000),
      allLogs: this.logs
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
    console.log('[ResilienceLogger] Logs cleared');
  }

  /**
   * Get log statistics
   */
  getStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    byCategory: Record<string, number>;
    errorRate: number;
  } {
    const byLevel: Record<LogLevel, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
      [LogLevel.CRITICAL]: 0
    };

    const byCategory: Record<string, number> = {};

    for (const log of this.logs) {
      byLevel[log.level]++;
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
    }

    const errorCount = byLevel[LogLevel.ERROR] + byLevel[LogLevel.CRITICAL];
    const errorRate = this.logs.length > 0 ? errorCount / this.logs.length : 0;

    return {
      total: this.logs.length,
      byLevel,
      byCategory,
      errorRate
    };
  }
}

// Export singleton instance
export const resilienceLogger = new ResilienceLogger();
