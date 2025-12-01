/**
 * Performance Testing Framework
 * 
 * Implements comprehensive performance testing with automated validation,
 * regression detection, and alerting for query performance optimizations.
 * 
 * Requirements: 1.1, 3.1, 4.1
 */

export interface PerformanceTest {
  name: string;
  description: string;
  scenario: TestScenario;
  expectedMaxDuration: number;
  cacheHitRateThreshold: number;
  errorRateThreshold: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  requirements: string[];
}

export interface TestScenario {
  type: 'page_load' | 'navigation' | 'query_performance' | 'cache_behavior' | 'error_recovery';
  setup: () => Promise<void>;
  execute: () => Promise<TestResult>;
  cleanup: () => Promise<void>;
  timeout: number;
}

export interface TestResult {
  success: boolean;
  duration: number;
  metrics: PerformanceMetrics;
  errors: TestError[];
  warnings: string[];
  details: Record<string, any>;
}

export interface PerformanceMetrics {
  // Core performance metrics
  loadTime: number;
  renderTime: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  
  // Query performance
  queryCount: number;
  averageQueryTime: number;
  slowQueryCount: number;
  
  // Cache performance
  cacheHitRate: number;
  cacheHitCount: number;
  cacheMissCount: number;
  
  // Error tracking
  errorCount: number;
  errorRate: number;
  
  // Circuit breaker metrics
  circuitBreakerActivations: number;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  
  // Memory and resource usage
  memoryUsage?: number;
  memoryDelta?: number;
  
  // Authentication metrics
  authenticationDelays: number;
  authenticationErrors: number;
  
  // Deduplication metrics
  deduplicationSavings: number;
  duplicateRequestCount: number;
}

export interface TestError {
  type: 'performance' | 'functional' | 'timeout' | 'assertion';
  message: string;
  stack?: string;
  timestamp: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface PerformanceBaseline {
  name: string;
  version: string;
  timestamp: number;
  metrics: PerformanceMetrics;
  environment: TestEnvironment;
}

export interface TestEnvironment {
  nodeVersion: string;
  browserVersion?: string;
  platform: string;
  memoryLimit?: number;
  cpuCores?: number;
}

export interface RegressionDetectionConfig {
  thresholds: {
    loadTimeIncrease: number; // Percentage increase that triggers regression
    cacheHitRateDecrease: number;
    errorRateIncrease: number;
    memoryUsageIncrease: number;
  };
  baselineWindow: number; // Number of previous runs to compare against
  alerting: {
    enabled: boolean;
    channels: ('console' | 'file' | 'webhook')[];
    webhookUrl?: string;
  };
}

export class PerformanceTestRunner {
  private baselines: Map<string, PerformanceBaseline[]> = new Map();
  private config: RegressionDetectionConfig;
  private currentMetrics: PerformanceMetrics | null = null;
  private testStartTime: number = 0;
  private queryTracker: QueryTracker;
  private cacheTracker: CacheTracker;
  private memoryTracker: MemoryTracker;

  constructor(config: RegressionDetectionConfig) {
    this.config = config;
    this.queryTracker = new QueryTracker();
    this.cacheTracker = new CacheTracker();
    this.memoryTracker = new MemoryTracker();
  }

  async runTest(test: PerformanceTest): Promise<TestResult> {
    console.log(`Starting performance test: ${test.name}`);
    
    try {
      // Setup test environment
      await this.setupTest(test);
      
      // Execute test scenario
      const result = await this.executeTestWithTimeout(test);
      
      // Validate performance metrics
      const validationResult = await this.validatePerformance(test, result);
      
      // Check for regressions
      const regressionResult = await this.detectRegressions(test.name, result.metrics);
      
      // Cleanup
      await test.scenario.cleanup();
      
      return {
        ...result,
        ...validationResult,
        ...regressionResult,
      };
    } catch (error) {
      console.error(`Performance test failed: ${test.name}`, error);
      
      return {
        success: false,
        duration: Date.now() - this.testStartTime,
        metrics: this.getCurrentMetrics(),
        errors: [{
          type: 'performance',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: Date.now(),
          severity: 'critical',
        }],
        warnings: [],
        details: { error: error instanceof Error ? error.message : error },
      };
    }
  }

  async runTestSuite(tests: PerformanceTest[]): Promise<TestSuiteResult> {
    const results: TestResult[] = [];
    const startTime = Date.now();
    
    console.log(`Running performance test suite with ${tests.length} tests`);
    
    for (const test of tests) {
      const result = await this.runTest(test);
      results.push(result);
      
      // Stop on critical failures if configured
      if (!result.success && test.priority === 'critical') {
        console.error(`Critical test failed: ${test.name}. Stopping test suite.`);
        break;
      }
    }
    
    const endTime = Date.now();
    const summary = this.generateTestSummary(results);
    
    return {
      results,
      summary,
      duration: endTime - startTime,
      timestamp: endTime,
    };
  }

  private async setupTest(test: PerformanceTest): Promise<void> {
    this.testStartTime = Date.now();
    this.queryTracker.reset();
    this.cacheTracker.reset();
    this.memoryTracker.startTracking();
    
    await test.scenario.setup();
  }

  private async executeTestWithTimeout(test: PerformanceTest): Promise<TestResult> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Test timeout after ${test.scenario.timeout}ms`));
      }, test.scenario.timeout);

      try {
        const result = await test.scenario.execute();
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private async validatePerformance(test: PerformanceTest, result: TestResult): Promise<Partial<TestResult>> {
    const warnings: string[] = [...result.warnings];
    const errors: TestError[] = [...result.errors];
    
    // Validate duration
    if (result.duration > test.expectedMaxDuration) {
      errors.push({
        type: 'performance',
        message: `Test duration ${result.duration}ms exceeds expected maximum ${test.expectedMaxDuration}ms`,
        timestamp: Date.now(),
        severity: 'high',
      });
    }
    
    // Validate cache hit rate
    if (result.metrics.cacheHitRate < test.cacheHitRateThreshold) {
      warnings.push(
        `Cache hit rate ${(result.metrics.cacheHitRate * 100).toFixed(1)}% below threshold ${(test.cacheHitRateThreshold * 100).toFixed(1)}%`
      );
    }
    
    // Validate error rate
    if (result.metrics.errorRate > test.errorRateThreshold) {
      errors.push({
        type: 'performance',
        message: `Error rate ${(result.metrics.errorRate * 100).toFixed(1)}% exceeds threshold ${(test.errorRateThreshold * 100).toFixed(1)}%`,
        timestamp: Date.now(),
        severity: 'high',
      });
    }
    
    return {
      warnings,
      errors,
      success: result.success && errors.length === 0,
    };
  }

  private async detectRegressions(testName: string, metrics: PerformanceMetrics): Promise<Partial<TestResult>> {
    const baselines = this.baselines.get(testName) || [];
    
    if (baselines.length === 0) {
      // No baseline to compare against, store current as baseline
      this.storeBaseline(testName, metrics);
      return { warnings: ['No baseline available for regression detection'] };
    }
    
    const recentBaselines = baselines
      .slice(-this.config.baselineWindow)
      .map(b => b.metrics);
    
    const avgBaseline = this.calculateAverageMetrics(recentBaselines);
    const regressions = this.compareMetrics(avgBaseline, metrics);
    
    if (regressions.length > 0) {
      await this.alertRegressions(testName, regressions);
    }
    
    // Store current metrics as new baseline
    this.storeBaseline(testName, metrics);
    
    return {
      warnings: regressions.map(r => r.message),
    };
  }

  private compareMetrics(baseline: PerformanceMetrics, current: PerformanceMetrics): RegressionAlert[] {
    const regressions: RegressionAlert[] = [];
    
    // Check load time regression
    const loadTimeIncrease = (current.loadTime - baseline.loadTime) / baseline.loadTime;
    if (loadTimeIncrease > this.config.thresholds.loadTimeIncrease) {
      regressions.push({
        type: 'load_time',
        message: `Load time increased by ${(loadTimeIncrease * 100).toFixed(1)}% (${baseline.loadTime}ms → ${current.loadTime}ms)`,
        severity: 'high',
        baseline: baseline.loadTime,
        current: current.loadTime,
      });
    }
    
    // Check cache hit rate regression
    const cacheHitRateDecrease = baseline.cacheHitRate - current.cacheHitRate;
    if (cacheHitRateDecrease > this.config.thresholds.cacheHitRateDecrease) {
      regressions.push({
        type: 'cache_hit_rate',
        message: `Cache hit rate decreased by ${(cacheHitRateDecrease * 100).toFixed(1)}% (${(baseline.cacheHitRate * 100).toFixed(1)}% → ${(current.cacheHitRate * 100).toFixed(1)}%)`,
        severity: 'medium',
        baseline: baseline.cacheHitRate,
        current: current.cacheHitRate,
      });
    }
    
    // Check error rate regression
    const errorRateIncrease = current.errorRate - baseline.errorRate;
    if (errorRateIncrease > this.config.thresholds.errorRateIncrease) {
      regressions.push({
        type: 'error_rate',
        message: `Error rate increased by ${(errorRateIncrease * 100).toFixed(1)}% (${(baseline.errorRate * 100).toFixed(1)}% → ${(current.errorRate * 100).toFixed(1)}%)`,
        severity: 'critical',
        baseline: baseline.errorRate,
        current: current.errorRate,
      });
    }
    
    // Check memory usage regression
    if (baseline.memoryUsage && current.memoryUsage) {
      const memoryIncrease = (current.memoryUsage - baseline.memoryUsage) / baseline.memoryUsage;
      if (memoryIncrease > this.config.thresholds.memoryUsageIncrease) {
        regressions.push({
          type: 'memory_usage',
          message: `Memory usage increased by ${(memoryIncrease * 100).toFixed(1)}% (${(baseline.memoryUsage / 1024 / 1024).toFixed(1)}MB → ${(current.memoryUsage / 1024 / 1024).toFixed(1)}MB)`,
          severity: 'medium',
          baseline: baseline.memoryUsage,
          current: current.memoryUsage,
        });
      }
    }
    
    return regressions;
  }

  private calculateAverageMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    if (metrics.length === 0) {
      throw new Error('Cannot calculate average of empty metrics array');
    }
    
    const sum = metrics.reduce((acc, m) => ({
      loadTime: acc.loadTime + m.loadTime,
      renderTime: acc.renderTime + m.renderTime,
      queryCount: acc.queryCount + m.queryCount,
      averageQueryTime: acc.averageQueryTime + m.averageQueryTime,
      slowQueryCount: acc.slowQueryCount + m.slowQueryCount,
      cacheHitRate: acc.cacheHitRate + m.cacheHitRate,
      cacheHitCount: acc.cacheHitCount + m.cacheHitCount,
      cacheMissCount: acc.cacheMissCount + m.cacheMissCount,
      errorCount: acc.errorCount + m.errorCount,
      errorRate: acc.errorRate + m.errorRate,
      circuitBreakerActivations: acc.circuitBreakerActivations + m.circuitBreakerActivations,
      circuitBreakerState: m.circuitBreakerState, // Use last state
      memoryUsage: (acc.memoryUsage || 0) + (m.memoryUsage || 0),
      authenticationDelays: acc.authenticationDelays + m.authenticationDelays,
      authenticationErrors: acc.authenticationErrors + m.authenticationErrors,
      deduplicationSavings: acc.deduplicationSavings + m.deduplicationSavings,
      duplicateRequestCount: acc.duplicateRequestCount + m.duplicateRequestCount,
    }), {
      loadTime: 0,
      renderTime: 0,
      queryCount: 0,
      averageQueryTime: 0,
      slowQueryCount: 0,
      cacheHitRate: 0,
      cacheHitCount: 0,
      cacheMissCount: 0,
      errorCount: 0,
      errorRate: 0,
      circuitBreakerActivations: 0,
      circuitBreakerState: 'closed' as const,
      memoryUsage: 0,
      authenticationDelays: 0,
      authenticationErrors: 0,
      deduplicationSavings: 0,
      duplicateRequestCount: 0,
    });
    
    const count = metrics.length;
    
    return {
      loadTime: sum.loadTime / count,
      renderTime: sum.renderTime / count,
      queryCount: sum.queryCount / count,
      averageQueryTime: sum.averageQueryTime / count,
      slowQueryCount: sum.slowQueryCount / count,
      cacheHitRate: sum.cacheHitRate / count,
      cacheHitCount: sum.cacheHitCount / count,
      cacheMissCount: sum.cacheMissCount / count,
      errorCount: sum.errorCount / count,
      errorRate: sum.errorRate / count,
      circuitBreakerActivations: sum.circuitBreakerActivations / count,
      circuitBreakerState: sum.circuitBreakerState,
      memoryUsage: sum.memoryUsage > 0 ? sum.memoryUsage / count : undefined,
      authenticationDelays: sum.authenticationDelays / count,
      authenticationErrors: sum.authenticationErrors / count,
      deduplicationSavings: sum.deduplicationSavings / count,
      duplicateRequestCount: sum.duplicateRequestCount / count,
    };
  }

  private storeBaseline(testName: string, metrics: PerformanceMetrics): void {
    const baselines = this.baselines.get(testName) || [];
    
    baselines.push({
      name: testName,
      version: '1.0.0', // Could be read from package.json
      timestamp: Date.now(),
      metrics,
      environment: this.getCurrentEnvironment(),
    });
    
    // Keep only recent baselines
    const maxBaselines = this.config.baselineWindow * 2;
    if (baselines.length > maxBaselines) {
      baselines.splice(0, baselines.length - maxBaselines);
    }
    
    this.baselines.set(testName, baselines);
  }

  private getCurrentEnvironment(): TestEnvironment {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      cpuCores: require('os').cpus().length,
    };
  }

  private async alertRegressions(testName: string, regressions: RegressionAlert[]): Promise<void> {
    if (!this.config.alerting.enabled) {
      return;
    }
    
    const alert = {
      testName,
      timestamp: new Date().toISOString(),
      regressions,
      severity: regressions.some(r => r.severity === 'critical') ? 'critical' : 'high',
    };
    
    for (const channel of this.config.alerting.channels) {
      switch (channel) {
        case 'console':
          console.error('🚨 Performance Regression Detected:', alert);
          break;
        case 'file':
          await this.writeAlertToFile(alert);
          break;
        case 'webhook':
          if (this.config.alerting.webhookUrl) {
            await this.sendWebhookAlert(alert);
          }
          break;
      }
    }
  }

  private async writeAlertToFile(alert: any): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');
    
    const alertsDir = path.join(process.cwd(), 'performance-alerts');
    await fs.mkdir(alertsDir, { recursive: true });
    
    const filename = `regression-${Date.now()}.json`;
    const filepath = path.join(alertsDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(alert, null, 2));
  }

  private async sendWebhookAlert(alert: any): Promise<void> {
    try {
      const response = await fetch(this.config.alerting.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });
      
      if (!response.ok) {
        console.error('Failed to send webhook alert:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending webhook alert:', error);
    }
  }

  private getCurrentMetrics(): PerformanceMetrics {
    return this.currentMetrics || {
      loadTime: 0,
      renderTime: 0,
      queryCount: 0,
      averageQueryTime: 0,
      slowQueryCount: 0,
      cacheHitRate: 0,
      cacheHitCount: 0,
      cacheMissCount: 0,
      errorCount: 0,
      errorRate: 0,
      circuitBreakerActivations: 0,
      circuitBreakerState: 'closed',
      authenticationDelays: 0,
      authenticationErrors: 0,
      deduplicationSavings: 0,
      duplicateRequestCount: 0,
    };
  }

  private generateTestSummary(results: TestResult[]): TestSummary {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = totalDuration / totalTests;
    
    const allErrors = results.flatMap(r => r.errors);
    const criticalErrors = allErrors.filter(e => e.severity === 'critical').length;
    
    return {
      totalTests,
      passedTests,
      failedTests,
      passRate: passedTests / totalTests,
      totalDuration,
      averageDuration,
      criticalErrors,
      regressionCount: results.filter(r => 
        r.warnings.some(w => w.includes('increased') || w.includes('decreased'))
      ).length,
    };
  }
}

// Supporting interfaces
export interface RegressionAlert {
  type: 'load_time' | 'cache_hit_rate' | 'error_rate' | 'memory_usage';
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  baseline: number;
  current: number;
}

export interface TestSuiteResult {
  results: TestResult[];
  summary: TestSummary;
  duration: number;
  timestamp: number;
}

export interface TestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  passRate: number;
  totalDuration: number;
  averageDuration: number;
  criticalErrors: number;
  regressionCount: number;
}

// Tracking utilities
class QueryTracker {
  private queries: QueryMetric[] = [];
  
  reset(): void {
    this.queries = [];
  }
  
  recordQuery(table: string, duration: number, cached: boolean): void {
    this.queries.push({
      table,
      duration,
      cached,
      timestamp: Date.now(),
    });
  }
  
  getMetrics(): Partial<PerformanceMetrics> {
    const totalQueries = this.queries.length;
    const cachedQueries = this.queries.filter(q => q.cached).length;
    const slowQueries = this.queries.filter(q => q.duration > 2000).length;
    const averageQueryTime = totalQueries > 0 
      ? this.queries.reduce((sum, q) => sum + q.duration, 0) / totalQueries 
      : 0;
    
    return {
      queryCount: totalQueries,
      averageQueryTime,
      slowQueryCount: slowQueries,
      cacheHitCount: cachedQueries,
      cacheMissCount: totalQueries - cachedQueries,
      cacheHitRate: totalQueries > 0 ? cachedQueries / totalQueries : 0,
    };
  }
}

class CacheTracker {
  private hits: number = 0;
  private misses: number = 0;
  
  reset(): void {
    this.hits = 0;
    this.misses = 0;
  }
  
  recordHit(): void {
    this.hits++;
  }
  
  recordMiss(): void {
    this.misses++;
  }
  
  getMetrics(): Partial<PerformanceMetrics> {
    const total = this.hits + this.misses;
    return {
      cacheHitCount: this.hits,
      cacheMissCount: this.misses,
      cacheHitRate: total > 0 ? this.hits / total : 0,
    };
  }
}

class MemoryTracker {
  private initialMemory: number = 0;
  
  startTracking(): void {
    this.initialMemory = this.getCurrentMemoryUsage();
  }
  
  getMetrics(): Partial<PerformanceMetrics> {
    const currentMemory = this.getCurrentMemoryUsage();
    return {
      memoryUsage: currentMemory,
      memoryDelta: currentMemory - this.initialMemory,
    };
  }
  
  private getCurrentMemoryUsage(): number {
    if (typeof window !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    
    return 0;
  }
}

interface QueryMetric {
  table: string;
  duration: number;
  cached: boolean;
  timestamp: number;
}