/**
 * System Monitoring Service
 * 
 * This service provides comprehensive monitoring for the staff registration routing system.
 * It tracks performance metrics, system health, routing decisions, status changes, and provides
 * audit logging for security and compliance purposes.
 */

import {
  AuditLogEntry,
  StaffStatus,
  RouteDecision,
} from '@/types/staff-registration';

/**
 * Performance metrics for system monitoring
 */
export interface PerformanceMetrics {
  /** Route guard operation metrics */
  routeGuard: {
    totalOperations: number;
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
    cacheHitRate: number;
  };
  /** Staff type detection metrics */
  staffTypeDetection: {
    totalOperations: number;
    averageResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
  };
  /** Staff status management metrics */
  statusManagement: {
    totalOperations: number;
    averageResponseTime: number;
    statusTransitions: Record<string, number>;
    errorRate: number;
  };
  /** Registration flow metrics */
  registrationFlow: {
    totalAttempts: number;
    successfulRegistrations: number;
    failedRegistrations: number;
    averageCompletionTime: number;
    commonFailureReasons: Record<string, number>;
  };
  /** Overall system metrics */
  system: {
    uptime: number;
    memoryUsage: number;
    activeUsers: number;
    totalRequests: number;
    errorRate: number;
  };
}

/**
 * System health status
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    database: 'healthy' | 'degraded' | 'unhealthy';
    authentication: 'healthy' | 'degraded' | 'unhealthy';
    routing: 'healthy' | 'degraded' | 'unhealthy';
    registration: 'healthy' | 'degraded' | 'unhealthy';
  };
  alerts: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: string;
    component?: string;
  }>;
  lastChecked: string;
}

/**
 * Audit event types
 */
export type AuditEventType = 
  | 'route_decision'
  | 'status_change'
  | 'registration_attempt'
  | 'registration_complete'
  | 'access_denied'
  | 'authentication_failure'
  | 'system_error'
  | 'configuration_change'
  | 'data_access'
  | 'security_event';

/**
 * Enhanced audit log entry with additional context
 */
export interface EnhancedAuditLogEntry {
  id: string;
  userId: string;
  action: AuditEventType;
  details: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  eventType: AuditEventType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  sessionId?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

/**
 * Monitoring configuration
 */
interface MonitoringConfig {
  /** Enable performance monitoring */
  enablePerformanceMonitoring: boolean;
  /** Enable audit logging */
  enableAuditLogging: boolean;
  /** Enable health checks */
  enableHealthChecks: boolean;
  /** Health check interval in milliseconds */
  healthCheckInterval: number;
  /** Maximum audit log entries to keep in memory */
  maxAuditLogEntries: number;
  /** Performance metrics retention period in milliseconds */
  metricsRetentionPeriod: number;
  /** Alert thresholds */
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    memoryUsage: number;
  };
}

const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  enablePerformanceMonitoring: true,
  enableAuditLogging: true,
  enableHealthChecks: true,
  healthCheckInterval: 30000, // 30 seconds
  maxAuditLogEntries: 10000,
  metricsRetentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
  alertThresholds: {
    errorRate: 5, // 5%
    responseTime: 2000, // 2 seconds
    memoryUsage: 80, // 80%
  },
};

/**
 * System Monitoring Service
 */
export class SystemMonitoringService {
  private config: MonitoringConfig;
  private auditLogs: EnhancedAuditLogEntry[] = [];
  private performanceMetrics: PerformanceMetrics;
  private systemHealth: SystemHealth;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();
  private activeOperations = new Map<string, { startTime: number; type: string }>();

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...DEFAULT_MONITORING_CONFIG, ...config };
    
    this.performanceMetrics = this.initializeMetrics();
    this.systemHealth = this.initializeHealth();
    
    if (this.config.enableHealthChecks) {
      this.startHealthChecks();
    }
  }

  /**
   * Logs a routing decision for audit purposes
   */
  logRoutingDecision(
    userId: string,
    path: string,
    decision: RouteDecision,
    processingTime: number,
    sessionId?: string
  ): void {
    if (!this.config.enableAuditLogging) return;

    const auditEntry: EnhancedAuditLogEntry = {
      id: crypto.randomUUID(),
      userId,
      action: 'route_decision',
      eventType: 'route_decision',
      severity: decision.allowed ? 'info' : 'warning',
      source: 'RouteGuard',
      sessionId,
      details: {
        path,
        allowed: decision.allowed,
        redirectTo: decision.redirectTo,
        reason: decision.reason,
        processingTimeMs: processingTime,
      },
      timestamp: new Date().toISOString(),
    };

    this.addAuditLog(auditEntry);
    this.updateRouteGuardMetrics(processingTime, decision.allowed);
  }

  /**
   * Logs a status change for audit purposes
   */
  logStatusChange(
    userId: string,
    fromStatus: StaffStatus | null,
    toStatus: StaffStatus,
    reason: string,
    performedBy?: string,
    sessionId?: string
  ): void {
    if (!this.config.enableAuditLogging) return;

    const auditEntry: EnhancedAuditLogEntry = {
      id: crypto.randomUUID(),
      userId,
      action: 'status_change',
      eventType: 'status_change',
      severity: 'info',
      source: 'StaffStatusManager',
      sessionId,
      details: {
        fromStatus,
        toStatus,
        reason,
        performedBy: performedBy || userId,
        transition: `${fromStatus || 'null'} -> ${toStatus}`,
      },
      timestamp: new Date().toISOString(),
    };

    this.addAuditLog(auditEntry);
    this.updateStatusManagementMetrics(fromStatus, toStatus);
  }

  /**
   * Logs a registration attempt
   */
  logRegistrationAttempt(
    userId: string,
    success: boolean,
    processingTime: number,
    errorReason?: string,
    sessionId?: string
  ): void {
    if (!this.config.enableAuditLogging) return;

    const auditEntry: EnhancedAuditLogEntry = {
      id: crypto.randomUUID(),
      userId,
      action: success ? 'registration_complete' : 'registration_attempt',
      eventType: success ? 'registration_complete' : 'registration_attempt',
      severity: success ? 'info' : 'warning',
      source: 'RegistrationFlowController',
      sessionId,
      details: {
        success,
        processingTimeMs: processingTime,
        errorReason,
      },
      timestamp: new Date().toISOString(),
    };

    this.addAuditLog(auditEntry);
    this.updateRegistrationMetrics(success, processingTime, errorReason);
  }

  /**
   * Logs an access denied event
   */
  logAccessDenied(
    userId: string,
    path: string,
    reason: string,
    sessionId?: string,
    ipAddress?: string
  ): void {
    if (!this.config.enableAuditLogging) return;

    const auditEntry: EnhancedAuditLogEntry = {
      id: crypto.randomUUID(),
      userId,
      action: 'access_denied',
      eventType: 'access_denied',
      severity: 'warning',
      source: 'RouteGuard',
      sessionId,
      ipAddress,
      details: {
        path,
        reason,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    this.addAuditLog(auditEntry);
  }

  /**
   * Logs a system error
   */
  logSystemError(
    error: Error,
    context: string,
    userId?: string,
    sessionId?: string
  ): void {
    if (!this.config.enableAuditLogging) return;

    const auditEntry: EnhancedAuditLogEntry = {
      id: crypto.randomUUID(),
      userId: userId || 'system',
      action: 'system_error',
      eventType: 'system_error',
      severity: 'error',
      source: context,
      sessionId,
      details: {
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        context,
      },
      timestamp: new Date().toISOString(),
    };

    this.addAuditLog(auditEntry);
    this.incrementSystemErrorCount();
  }

  /**
   * Logs a security event
   */
  logSecurityEvent(
    eventType: string,
    description: string,
    userId?: string,
    sessionId?: string,
    ipAddress?: string,
    severity: 'info' | 'warning' | 'error' | 'critical' = 'warning'
  ): void {
    if (!this.config.enableAuditLogging) return;

    const auditEntry: EnhancedAuditLogEntry = {
      id: crypto.randomUUID(),
      userId: userId || 'anonymous',
      action: 'security_event',
      eventType: 'security_event',
      severity,
      source: 'SecurityMonitor',
      sessionId,
      ipAddress,
      details: {
        eventType,
        description,
      },
      timestamp: new Date().toISOString(),
    };

    this.addAuditLog(auditEntry);
  }

  /**
   * Starts tracking an operation for performance monitoring
   */
  startOperation(operationId: string, type: string): void {
    if (!this.config.enablePerformanceMonitoring) return;

    this.activeOperations.set(operationId, {
      startTime: Date.now(),
      type,
    });
  }

  /**
   * Ends tracking an operation and records metrics
   */
  endOperation(operationId: string, success: boolean = true): void {
    if (!this.config.enablePerformanceMonitoring) return;

    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    const duration = Date.now() - operation.startTime;
    this.activeOperations.delete(operationId);

    // Update metrics based on operation type
    switch (operation.type) {
      case 'staff_type_detection':
        this.updateStaffTypeDetectionMetrics(duration, success);
        break;
      case 'route_guard':
        this.updateRouteGuardMetrics(duration, success);
        break;
      case 'status_management':
        this.updateStatusManagementMetrics(null, null, duration, success);
        break;
      case 'registration':
        this.updateRegistrationMetrics(success, duration);
        break;
    }
  }

  /**
   * Performs a comprehensive system health check
   */
  async performHealthCheck(): Promise<SystemHealth> {
    const healthCheck: SystemHealth = {
      status: 'healthy',
      components: {
        database: 'healthy',
        authentication: 'healthy',
        routing: 'healthy',
        registration: 'healthy',
      },
      alerts: [],
      lastChecked: new Date().toISOString(),
    };

    try {
      // Check database health
      healthCheck.components.database = await this.checkDatabaseHealth();
      
      // Check authentication health
      healthCheck.components.authentication = await this.checkAuthenticationHealth();
      
      // Check routing health
      healthCheck.components.routing = await this.checkRoutingHealth();
      
      // Check registration health
      healthCheck.components.registration = await this.checkRegistrationHealth();

      // Generate alerts based on metrics
      healthCheck.alerts = this.generateHealthAlerts();

      // Determine overall status
      const componentStatuses = Object.values(healthCheck.components);
      if (componentStatuses.some(status => status === 'unhealthy')) {
        healthCheck.status = 'unhealthy';
      } else if (componentStatuses.some(status => status === 'degraded')) {
        healthCheck.status = 'degraded';
      }

      this.systemHealth = healthCheck;
      return healthCheck;

    } catch (error) {
      console.error('Health check failed:', error);
      
      healthCheck.status = 'unhealthy';
      healthCheck.alerts.push({
        id: crypto.randomUUID(),
        severity: 'critical',
        message: `Health check failed: ${(error as Error).message}`,
        timestamp: new Date().toISOString(),
      });

      this.systemHealth = healthCheck;
      return healthCheck;
    }
  }

  /**
   * Gets current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Gets current system health
   */
  getSystemHealth(): SystemHealth {
    return { ...this.systemHealth };
  }

  /**
   * Gets audit logs with optional filtering
   */
  getAuditLogs(
    limit: number = 100,
    eventType?: AuditEventType,
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): EnhancedAuditLogEntry[] {
    let logs = [...this.auditLogs];

    // Apply filters
    if (eventType) {
      logs = logs.filter(log => log.eventType === eventType);
    }

    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }

    if (startDate) {
      logs = logs.filter(log => new Date(log.timestamp) >= startDate);
    }

    if (endDate) {
      logs = logs.filter(log => new Date(log.timestamp) <= endDate);
    }

    // Sort by timestamp (newest first) and limit
    return logs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Exports audit logs for compliance purposes
   */
  exportAuditLogs(
    format: 'json' | 'csv' = 'json',
    filters?: {
      eventType?: AuditEventType;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): string {
    const logs = this.getAuditLogs(
      this.auditLogs.length,
      filters?.eventType,
      filters?.userId,
      filters?.startDate,
      filters?.endDate
    );

    if (format === 'csv') {
      return this.convertLogsToCSV(logs);
    }

    return JSON.stringify(logs, null, 2);
  }

  /**
   * Clears old audit logs based on retention policy
   */
  cleanupAuditLogs(): void {
    const cutoffTime = Date.now() - this.config.metricsRetentionPeriod;
    
    this.auditLogs = this.auditLogs.filter(log => 
      new Date(log.timestamp).getTime() > cutoffTime
    );

    // Also enforce maximum entries limit
    if (this.auditLogs.length > this.config.maxAuditLogEntries) {
      this.auditLogs = this.auditLogs.slice(-this.config.maxAuditLogEntries);
    }
  }

  /**
   * Updates configuration
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart health checks if interval changed
    if (newConfig.healthCheckInterval && this.healthCheckInterval) {
      this.stopHealthChecks();
      this.startHealthChecks();
    }
  }

  /**
   * Stops monitoring and cleans up resources
   */
  stop(): void {
    this.stopHealthChecks();
    this.activeOperations.clear();
  }

  // Private helper methods

  private initializeMetrics(): PerformanceMetrics {
    return {
      routeGuard: {
        totalOperations: 0,
        averageResponseTime: 0,
        successRate: 100,
        errorRate: 0,
        cacheHitRate: 0,
      },
      staffTypeDetection: {
        totalOperations: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
      },
      statusManagement: {
        totalOperations: 0,
        averageResponseTime: 0,
        statusTransitions: {},
        errorRate: 0,
      },
      registrationFlow: {
        totalAttempts: 0,
        successfulRegistrations: 0,
        failedRegistrations: 0,
        averageCompletionTime: 0,
        commonFailureReasons: {},
      },
      system: {
        uptime: 0,
        memoryUsage: 0,
        activeUsers: 0,
        totalRequests: 0,
        errorRate: 0,
      },
    };
  }

  private initializeHealth(): SystemHealth {
    return {
      status: 'healthy',
      components: {
        database: 'healthy',
        authentication: 'healthy',
        routing: 'healthy',
        registration: 'healthy',
      },
      alerts: [],
      lastChecked: new Date().toISOString(),
    };
  }

  private addAuditLog(entry: EnhancedAuditLogEntry): void {
    this.auditLogs.push(entry);
    
    // Enforce maximum entries limit
    if (this.auditLogs.length > this.config.maxAuditLogEntries) {
      this.auditLogs = this.auditLogs.slice(-this.config.maxAuditLogEntries);
    }
  }

  private updateRouteGuardMetrics(processingTime: number, success: boolean): void {
    const metrics = this.performanceMetrics.routeGuard;
    
    metrics.totalOperations++;
    metrics.averageResponseTime = 
      (metrics.averageResponseTime * (metrics.totalOperations - 1) + processingTime) / metrics.totalOperations;
    
    if (success) {
      metrics.successRate = (metrics.successRate * (metrics.totalOperations - 1) + 100) / metrics.totalOperations;
    } else {
      metrics.successRate = (metrics.successRate * (metrics.totalOperations - 1)) / metrics.totalOperations;
    }
    
    metrics.errorRate = 100 - metrics.successRate;
  }

  private updateStaffTypeDetectionMetrics(processingTime: number, success: boolean): void {
    const metrics = this.performanceMetrics.staffTypeDetection;
    
    metrics.totalOperations++;
    metrics.averageResponseTime = 
      (metrics.averageResponseTime * (metrics.totalOperations - 1) + processingTime) / metrics.totalOperations;
    
    if (!success) {
      metrics.errorRate = (metrics.errorRate * (metrics.totalOperations - 1) + 100) / metrics.totalOperations;
    } else {
      metrics.errorRate = (metrics.errorRate * (metrics.totalOperations - 1)) / metrics.totalOperations;
    }
  }

  private updateStatusManagementMetrics(
    fromStatus: StaffStatus | null,
    toStatus: StaffStatus | null,
    processingTime?: number,
    success?: boolean
  ): void {
    const metrics = this.performanceMetrics.statusManagement;
    
    if (processingTime !== undefined) {
      metrics.totalOperations++;
      metrics.averageResponseTime = 
        (metrics.averageResponseTime * (metrics.totalOperations - 1) + processingTime) / metrics.totalOperations;
    }

    if (fromStatus !== undefined && toStatus !== undefined) {
      const transition = `${fromStatus || 'null'} -> ${toStatus}`;
      metrics.statusTransitions[transition] = (metrics.statusTransitions[transition] || 0) + 1;
    }

    if (success !== undefined && !success) {
      metrics.errorRate = (metrics.errorRate * (metrics.totalOperations - 1) + 100) / metrics.totalOperations;
    } else if (success !== undefined) {
      metrics.errorRate = (metrics.errorRate * (metrics.totalOperations - 1)) / metrics.totalOperations;
    }
  }

  private updateRegistrationMetrics(success: boolean, processingTime: number, errorReason?: string): void {
    const metrics = this.performanceMetrics.registrationFlow;
    
    metrics.totalAttempts++;
    
    if (success) {
      metrics.successfulRegistrations++;
      metrics.averageCompletionTime = 
        (metrics.averageCompletionTime * (metrics.successfulRegistrations - 1) + processingTime) / metrics.successfulRegistrations;
    } else {
      metrics.failedRegistrations++;
      
      if (errorReason) {
        metrics.commonFailureReasons[errorReason] = (metrics.commonFailureReasons[errorReason] || 0) + 1;
      }
    }
  }

  private incrementSystemErrorCount(): void {
    this.performanceMetrics.system.totalRequests++;
    this.performanceMetrics.system.errorRate = 
      (this.performanceMetrics.system.errorRate * (this.performanceMetrics.system.totalRequests - 1) + 100) / 
      this.performanceMetrics.system.totalRequests;
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Scheduled health check failed:', error);
      }
    }, this.config.healthCheckInterval);
  }

  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async checkDatabaseHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    try {
      // In a real implementation, this would test database connectivity
      // For now, we'll simulate based on error rates
      const errorRate = this.performanceMetrics.system.errorRate;
      
      if (errorRate > 10) return 'unhealthy';
      if (errorRate > 5) return 'degraded';
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private async checkAuthenticationHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    try {
      // Check authentication system health
      const errorRate = this.performanceMetrics.staffTypeDetection.errorRate;
      
      if (errorRate > 10) return 'unhealthy';
      if (errorRate > 5) return 'degraded';
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private async checkRoutingHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    try {
      const metrics = this.performanceMetrics.routeGuard;
      
      if (metrics.errorRate > 10 || metrics.averageResponseTime > 5000) return 'unhealthy';
      if (metrics.errorRate > 5 || metrics.averageResponseTime > 2000) return 'degraded';
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private async checkRegistrationHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    try {
      const metrics = this.performanceMetrics.registrationFlow;
      const failureRate = metrics.totalAttempts > 0 ? 
        (metrics.failedRegistrations / metrics.totalAttempts) * 100 : 0;
      
      if (failureRate > 20) return 'unhealthy';
      if (failureRate > 10) return 'degraded';
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private generateHealthAlerts(): SystemHealth['alerts'] {
    const alerts: SystemHealth['alerts'] = [];
    const thresholds = this.config.alertThresholds;

    // Check error rate
    if (this.performanceMetrics.system.errorRate > thresholds.errorRate) {
      alerts.push({
        id: crypto.randomUUID(),
        severity: this.performanceMetrics.system.errorRate > thresholds.errorRate * 2 ? 'critical' : 'high',
        message: `System error rate is ${this.performanceMetrics.system.errorRate.toFixed(2)}%`,
        timestamp: new Date().toISOString(),
        component: 'system',
      });
    }

    // Check response time
    if (this.performanceMetrics.routeGuard.averageResponseTime > thresholds.responseTime) {
      alerts.push({
        id: crypto.randomUUID(),
        severity: this.performanceMetrics.routeGuard.averageResponseTime > thresholds.responseTime * 2 ? 'high' : 'medium',
        message: `Route guard response time is ${this.performanceMetrics.routeGuard.averageResponseTime.toFixed(0)}ms`,
        timestamp: new Date().toISOString(),
        component: 'routing',
      });
    }

    return alerts;
  }

  private convertLogsToCSV(logs: EnhancedAuditLogEntry[]): string {
    if (logs.length === 0) return '';

    const headers = ['timestamp', 'userId', 'eventType', 'severity', 'source', 'action', 'details'];
    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const row = [
        log.timestamp,
        log.userId,
        log.eventType,
        log.severity,
        log.source,
        log.action,
        JSON.stringify(log.details).replace(/"/g, '""'),
      ];
      csvRows.push(row.map(field => `"${field}"`).join(','));
    }

    return csvRows.join('\n');
  }
}

/**
 * Default instance of the system monitoring service
 */
export const systemMonitoringService = new SystemMonitoringService();