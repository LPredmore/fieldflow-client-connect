import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryLogger } from '@/utils/queryLogger';
import { queryPerformanceAnalyzer } from '@/utils/queryPerformanceAnalyzer';
import { ErrorType } from '@/utils/circuitBreaker';

describe('Query Logging and Monitoring', () => {
  beforeEach(() => {
    queryLogger.clearLogs();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryLogger.clearLogs();
  });

  describe('QueryLogger', () => {
    it('should start and complete a query successfully', () => {
      const queryId = queryLogger.startQuery(
        'users',
        'id, name, email',
        { active: true },
        { column: 'created_at', ascending: false },
        'user123',
        'tenant456'
      );

      expect(queryId).toMatch(/^query_\d+_[a-z0-9]+$/);

      queryLogger.completeQuery(queryId, 150, 25, {
        networkTime: 100,
        processingTime: 50
      });

      const logs = queryLogger.getLogs(1);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        id: queryId,
        table: 'users',
        select: 'id, name, email',
        filters: { active: true },
        success: true,
        duration: 150,
        resultCount: 25,
        queryComplexity: 'simple'
      });
    });

    it('should handle query failures with detailed error information', () => {
      const queryId = queryLogger.startQuery(
        'appointments',
        'id, notes, customer_id',
        { status: 'active' }
      );

      queryLogger.failQuery(queryId, 2500, {
        message: 'Column "notes" does not exist',
        type: ErrorType.SCHEMA_MISMATCH,
        code: '42703',
        details: {
          hint: 'Perhaps you meant to reference the column "description"',
          table: 'appointments'
        }
      }, 2);

      const logs = queryLogger.getLogs(1);
      expect(logs[0]).toMatchObject({
        success: false,
        duration: 2500,
        retryCount: 2,
        error: {
          message: 'Column "notes" does not exist',
          type: ErrorType.SCHEMA_MISMATCH,
          code: '42703'
        }
      });
    });

    it('should assess query complexity correctly', () => {
      // Simple query
      const simpleQueryId = queryLogger.startQuery(
        'users',
        'id, name',
        { active: true }
      );
      
      // Complex query with joins and many filters
      const complexQueryId = queryLogger.startQuery(
        'appointments',
        'id, title, customer!inner(name, email), services!inner(name, category)',
        { 
          status: 'active',
          priority: 'high',
          assigned_to: 'user123',
          created_at: '2024-01-01',
          customer_type: 'commercial',
          service_category: 'plumbing'
        },
        { column: 'created_at', ascending: false }
      );

      const logs = queryLogger.getLogs(2);
      const simpleLog = logs.find(log => log.id === simpleQueryId);
      const complexLog = logs.find(log => log.id === complexQueryId);

      expect(simpleLog?.queryComplexity).toBe('simple');
      expect(complexLog?.queryComplexity).toBe('complex');
    });

    it('should track cache hits and circuit breaker state', () => {
      const queryId = queryLogger.startQuery(
        'customers',
        'id, name',
        { type: 'residential' },
        undefined,
        'user123',
        'tenant456',
        'customers-cache-key',
        true, // cache hit
        30000, // cache age
        false // circuit breaker not open
      );

      queryLogger.completeQuery(queryId, 5, 10, { cacheTime: 5 });

      const logs = queryLogger.getLogs(1);
      expect(logs[0]).toMatchObject({
        cacheHit: true,
        cacheAge: 30000,
        circuitBreakerOpen: false,
        duration: 5
      });
    });

    it('should generate comprehensive metrics', () => {
      // Create a mix of successful and failed queries
      const queries = [
        { table: 'users', duration: 100, success: true, cached: false },
        { table: 'users', duration: 150, success: true, cached: true },
        { table: 'appointments', duration: 2500, success: false, cached: false },
        { table: 'customers', duration: 80, success: true, cached: true },
        { table: 'appointments', duration: 3000, success: false, cached: false }
      ];

      queries.forEach((query, index) => {
        const queryId = queryLogger.startQuery(
          query.table,
          'id, name',
          { active: true },
          undefined,
          'user123',
          'tenant456',
          `cache-key-${index}`,
          query.cached
        );

        if (query.success) {
          queryLogger.completeQuery(queryId, query.duration, 10);
        } else {
          queryLogger.failQuery(queryId, query.duration, {
            message: 'Query failed',
            type: ErrorType.NETWORK_ERROR
          });
        }
      });

      const metrics = queryLogger.getMetrics();
      
      expect(metrics.totalQueries).toBe(5);
      expect(metrics.successfulQueries).toBe(3);
      expect(metrics.failedQueries).toBe(2);
      expect(metrics.cacheHitRate).toBe(0.4); // 2 out of 5 cached
      expect(metrics.slowQueries).toHaveLength(2); // 2 queries > 2000ms
      expect(metrics.recentErrors).toHaveLength(2);
      expect(metrics.errorsByType[ErrorType.NETWORK_ERROR]).toBe(2);
    });

    it('should log query structure analysis', () => {
      const consoleSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      // Test with a problematic query
      queryLogger.logQueryStructure(
        'appointments',
        '*', // SELECT *
        { 
          status: 'active',
          priority: 'high',
          assigned_to: 'user123',
          created_at: '2024-01-01',
          customer_type: 'commercial',
          service_category: 'plumbing'
        }
      );

      expect(consoleSpy).toHaveBeenCalledWith('🔍 [QueryLogger] Query Structure Analysis');
      expect(consoleWarnSpy).toHaveBeenCalledWith('⚠️ Potential Issues:', expect.arrayContaining([
        'Using SELECT * - consider specifying exact columns for better performance',
        'Many filters applied - ensure proper indexing'
      ]));
      expect(consoleGroupEndSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleGroupEndSpy.mockRestore();
    });

    it('should emit performance events', () => {
      const eventSpy = vi.fn();
      
      // Mock window and addEventListener
      Object.defineProperty(window, 'dispatchEvent', {
        value: eventSpy,
        writable: true
      });

      const queryId = queryLogger.startQuery('users', 'id, name', { active: true });
      queryLogger.completeQuery(queryId, 150, 25);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'query-performance',
          detail: expect.objectContaining({
            type: 'query_completed',
            data: expect.objectContaining({
              queryId,
              table: 'users',
              duration: 150,
              resultCount: 25
            })
          })
        })
      );
    });

    it('should trim logs when exceeding maximum entries', () => {
      // Create more logs than the maximum (assuming max is 1000)
      for (let i = 0; i < 1005; i++) {
        const queryId = queryLogger.startQuery(`table${i}`, 'id', {});
        queryLogger.completeQuery(queryId, 100, 1);
      }

      const logs = queryLogger.getLogs(2000); // Request more than max
      expect(logs.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('QueryPerformanceAnalyzer', () => {
    it('should analyze performance and identify bottlenecks', () => {
      // Create test data
      const testLogs = [
        {
          id: 'query1',
          timestamp: new Date(),
          table: 'users',
          select: 'id, name',
          filters: { active: true },
          success: true,
          duration: 3000, // Slow query
          resultCount: 100,
          queryComplexity: 'simple' as const,
          cacheHit: false,
          circuitBreakerOpen: false,
          cacheKey: 'users-id-name-active',
          performanceMetrics: { networkTime: 2500, processingTime: 500 }
        },
        {
          id: 'query2',
          timestamp: new Date(),
          table: 'appointments',
          select: 'id, title',
          filters: { status: 'active' },
          success: false,
          duration: 1000,
          error: {
            message: 'Network timeout',
            type: ErrorType.NETWORK_ERROR
          },
          queryComplexity: 'simple' as const,
          cacheHit: false,
          circuitBreakerOpen: false,
          cacheKey: 'appointments-id-title-status',
          performanceMetrics: {}
        }
      ];

      const analysis = queryPerformanceAnalyzer.analyzePerformance(testLogs);

      expect(analysis.summary.totalQueries).toBe(2);
      expect(analysis.summary.slowQueryCount).toBe(1);
      expect(analysis.summary.errorRate).toBe(0.5);
      expect(analysis.bottlenecks.slowestTables).toHaveLength(1);
      expect(analysis.bottlenecks.slowestTables[0].table).toBe('users');
      expect(analysis.recommendations).toContain(
        expect.stringContaining('Consider optimizing queries for table \'users\'')
      );
    });

    it('should generate optimization suggestions', () => {
      const testLogs = [
        {
          id: 'query1',
          timestamp: new Date(),
          table: 'appointments',
          select: 'id, title, customer!inner(name), services!inner(name), locations!inner(address)',
          filters: { 
            status: 'active',
            priority: 'high',
            assigned_to: 'user123',
            created_at: '2024-01-01',
            customer_type: 'commercial',
            service_category: 'plumbing',
            location_type: 'residential'
          },
          success: true,
          duration: 4000, // Very slow
          resultCount: 50,
          queryComplexity: 'complex' as const,
          cacheHit: false,
          circuitBreakerOpen: false,
          cacheKey: 'appointments-complex-query',
          performanceMetrics: {}
        }
      ];

      const suggestions = queryPerformanceAnalyzer.generateOptimizationSuggestions(testLogs);

      expect(suggestions).toHaveLength(3); // slow_query, complex_select, many_filters
      expect(suggestions[0].severity).toBe('high'); // Slowest query should be high severity
      expect(suggestions.some(s => s.issue === 'slow_query')).toBe(true);
      expect(suggestions.some(s => s.issue === 'complex_select')).toBe(true);
      expect(suggestions.some(s => s.issue === 'many_filters')).toBe(true);
    });

    it('should analyze query patterns', () => {
      const now = new Date();
      const testLogs = [
        // Duplicate queries
        {
          id: 'query1',
          timestamp: new Date(now.getTime() - 3600000), // 1 hour ago
          table: 'users',
          select: 'id, name',
          filters: { active: true },
          success: true,
          duration: 100,
          queryComplexity: 'simple' as const,
          cacheHit: false,
          circuitBreakerOpen: false,
          cacheKey: 'users-id-name-active',
          performanceMetrics: {}
        },
        {
          id: 'query2',
          timestamp: new Date(now.getTime() - 1800000), // 30 minutes ago
          table: 'users',
          select: 'id, name',
          filters: { active: true },
          success: true,
          duration: 120,
          queryComplexity: 'simple' as const,
          cacheHit: false,
          circuitBreakerOpen: false,
          cacheKey: 'users-id-name-active',
          performanceMetrics: {}
        },
        {
          id: 'query3',
          timestamp: now,
          table: 'appointments',
          select: 'id, title',
          filters: { status: 'scheduled' },
          success: true,
          duration: 200,
          queryComplexity: 'simple' as const,
          cacheHit: false,
          circuitBreakerOpen: false,
          cacheKey: 'appointments-id-title-status',
          performanceMetrics: {}
        }
      ];

      const patterns = queryPerformanceAnalyzer.analyzeQueryPatterns(testLogs);

      expect(patterns.duplicateQueries).toHaveLength(1);
      expect(patterns.duplicateQueries[0].count).toBe(2);
      expect(patterns.duplicateQueries[0].avgDuration).toBe(110);

      expect(patterns.tableUsageStats).toHaveLength(2);
      expect(patterns.tableUsageStats[0].table).toBe('users'); // Most queries
      expect(patterns.tableUsageStats[0].queryCount).toBe(2);

      expect(patterns.timeBasedPatterns.length).toBeGreaterThan(0);
    });

    it('should handle empty logs gracefully', () => {
      const analysis = queryPerformanceAnalyzer.analyzePerformance([]);
      
      expect(analysis.summary.totalQueries).toBe(0);
      expect(analysis.bottlenecks.slowestTables).toHaveLength(0);
      expect(analysis.recommendations).toContain('No query data available for analysis');
    });
  });

  describe('Integration Tests', () => {
    it('should work end-to-end with real query flow', () => {
      // Simulate a complete query lifecycle
      const queryId = queryLogger.startQuery(
        'appointment_occurrences',
        `
          *,
          appointment_series!inner(
            title,
            description,
            service_id,
            services!fk_appointment_series_service(id, name, category, description)
          )
        `,
        { tenant_id: 'auto' },
        { column: 'start_at', ascending: false },
        'user123',
        'tenant456'
      );

      // Simulate query completion
      queryLogger.completeQuery(queryId, 1250, 15, {
        networkTime: 1000,
        processingTime: 200,
        cacheTime: 0
      });

      // Get metrics and analyze
      const metrics = queryLogger.getMetrics();
      const logs = queryLogger.getLogs(1);
      const analysis = queryPerformanceAnalyzer.analyzePerformance(logs);

      expect(metrics.totalQueries).toBe(1);
      expect(metrics.successfulQueries).toBe(1);
      expect(logs[0].queryComplexity).toBe('complex'); // Due to joins
      expect(analysis.summary.totalQueries).toBe(1);
      expect(analysis.summary.errorRate).toBe(0);
    });

    it('should handle circuit breaker scenarios', () => {
      // Simulate circuit breaker open scenario
      const queryId = queryLogger.startQuery(
        'appointments',
        'id, notes', // Non-existent column
        { status: 'active' },
        undefined,
        'user123',
        'tenant456',
        'cache-key',
        false, // not cached
        undefined,
        true // circuit breaker open
      );

      queryLogger.failQuery(queryId, 0, {
        message: 'Circuit breaker is open',
        type: ErrorType.NETWORK_ERROR
      });

      const metrics = queryLogger.getMetrics();
      expect(metrics.circuitBreakerActivations).toBe(1);
      expect(metrics.failedQueries).toBe(1);

      const analysis = queryPerformanceAnalyzer.analyzePerformance(queryLogger.getLogs());
      expect(analysis.recommendations).toContain(
        expect.stringContaining('High error rate detected')
      );
    });
  });
});