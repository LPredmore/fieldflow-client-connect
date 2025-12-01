/**
 * Authentication Logger
 * 
 * Centralized logging utility for authentication flow.
 * Uses console.debug for development, structured logging for production.
 * 
 * Requirements: 7.5
 */

export enum AuthLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export enum AuthLogCategory {
  AUTHENTICATION = 'authentication',
  ROLE_DETECTION = 'role_detection',
  ROUTING = 'routing',
  QUERY_DEDUPLICATION = 'query_deduplication',
  CIRCUIT_BREAKER = 'circuit_breaker',
  CACHE = 'cache',
  SESSION = 'session'
}

interface LogEntry {
  timestamp: string;
  level: AuthLogLevel;
  category: AuthLogCategory;
  message: string;
  data?: Record<string, any>;
  userId?: string;
}

class AuthLogger {
  private isDevelopment = import.meta.env.DEV;
  private logHistory: LogEntry[] = [];
  private readonly MAX_HISTORY = 100;

  /**
   * Log authentication flow step
   */
  logAuth(message: string, data?: Record<string, any>, userId?: string): void {
    this.log(AuthLogLevel.INFO, AuthLogCategory.AUTHENTICATION, message, data, userId);
  }

  /**
   * Log role detection event
   */
  logRoleDetection(message: string, data?: Record<string, any>, userId?: string): void {
    this.log(AuthLogLevel.INFO, AuthLogCategory.ROLE_DETECTION, message, data, userId);
  }

  /**
   * Log routing decision
   */
  logRouting(message: string, data?: Record<string, any>, userId?: string): void {
    this.log(AuthLogLevel.INFO, AuthLogCategory.ROUTING, message, data, userId);
  }

  /**
   * Log query deduplication event
   */
  logQueryDedup(message: string, data?: Record<string, any>): void {
    this.log(AuthLogLevel.DEBUG, AuthLogCategory.QUERY_DEDUPLICATION, message, data);
  }

  /**
   * Log circuit breaker state change
   */
  logCircuitBreaker(message: string, data?: Record<string, any>): void {
    this.log(AuthLogLevel.WARN, AuthLogCategory.CIRCUIT_BREAKER, message, data);
  }

  /**
   * Log cache operation
   */
  logCache(message: string, data?: Record<string, any>): void {
    this.log(AuthLogLevel.DEBUG, AuthLogCategory.CACHE, message, data);
  }

  /**
   * Log session event
   */
  logSession(message: string, data?: Record<string, any>, userId?: string): void {
    this.log(AuthLogLevel.INFO, AuthLogCategory.SESSION, message, data, userId);
  }

  /**
   * Log error
   */
  logError(category: AuthLogCategory, message: string, error?: Error, data?: Record<string, any>): void {
    const errorData = {
      ...data,
      error: error ? {
        message: error.message,
        name: error.name,
        stack: error.stack
      } : undefined
    };
    this.log(AuthLogLevel.ERROR, category, message, errorData);
  }

  /**
   * Core logging method
   */
  private log(
    level: AuthLogLevel,
    category: AuthLogCategory,
    message: string,
    data?: Record<string, any>,
    userId?: string
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      userId
    };

    // Add to history
    this.logHistory.push(entry);
    if (this.logHistory.length > this.MAX_HISTORY) {
      this.logHistory.shift();
    }

    // Console output
    if (this.isDevelopment) {
      this.logToConsole(entry);
    } else {
      this.logStructured(entry);
    }
  }

  /**
   * Log to console (development)
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.category}]`;
    const userInfo = entry.userId ? `[user:${entry.userId}]` : '';
    const fullMessage = `${prefix}${userInfo} ${entry.message}`;

    switch (entry.level) {
      case AuthLogLevel.DEBUG:
        console.debug(fullMessage, entry.data || '');
        break;
      case AuthLogLevel.INFO:
        console.log(fullMessage, entry.data || '');
        break;
      case AuthLogLevel.WARN:
        console.warn(fullMessage, entry.data || '');
        break;
      case AuthLogLevel.ERROR:
        console.error(fullMessage, entry.data || '');
        break;
    }
  }

  /**
   * Log structured data (production)
   */
  private logStructured(entry: LogEntry): void {
    // In production, you might send this to a logging service
    // For now, we'll use console with structured format
    const structuredLog = {
      '@timestamp': entry.timestamp,
      level: entry.level,
      category: entry.category,
      message: entry.message,
      userId: entry.userId,
      ...entry.data
    };

    // Only log warnings and errors in production
    if (entry.level === AuthLogLevel.WARN || entry.level === AuthLogLevel.ERROR) {
      console.log(JSON.stringify(structuredLog));
    }
  }

  /**
   * Get log history
   */
  getHistory(): LogEntry[] {
    return [...this.logHistory];
  }

  /**
   * Get log history for specific category
   */
  getHistoryByCategory(category: AuthLogCategory): LogEntry[] {
    return this.logHistory.filter(entry => entry.category === category);
  }

  /**
   * Get log history for specific user
   */
  getHistoryByUser(userId: string): LogEntry[] {
    return this.logHistory.filter(entry => entry.userId === userId);
  }

  /**
   * Clear log history
   */
  clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logHistory, null, 2);
  }
}

// Export singleton instance
export const authLogger = new AuthLogger();
