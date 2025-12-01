/**
 * Policy Performance Benchmark Runner
 * 
 * Utility to run performance benchmarks for RLS policies and generate reports.
 * Can be used for continuous monitoring and performance regression detection.
 * 
 * Requirements: 2.1, 2.2, 3.1
 */

import {
  PolicyTestConfig,
  PolicyPerformanceBenchmark,
  benchmarkPolicyPerformance,
  runComprehensivePolicyTests
} from './rlsPolicyTestUtils';

export interface PerformanceReport {
  timestamp: string;
  environment: string;
  overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  benchmarks: PolicyPerformanceBenchmark[];
  summary: {
    totalTables: number;
    averageResponseTime: number;
    slowestTable: string;
    fastestTable: string;
    tablesWithIssues: string[];
  };
  recommendations: string[];
}

export interface PerformanceThresholds {
  maxAverageExecutionTime: number; // milliseconds
  minSuccessRate: number; // percentage
  maxExecutionTime: number; // milliseconds
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  maxAverageExecutionTime: 2000, // 2 seconds
  minSuccessRate: 95, // 95%
  maxExecutionTime: 5000 // 5 seconds
};

/**
 * Runs performance benchmarks for all critical tables
 */
export async function runPerformanceBenchmarks(
  config: PolicyTestConfig,
  thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS,
  iterations: number = 10
): Promise<PerformanceReport> {
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || 'development';
  
  // Tables to benchmark
  const criticalTables = [
    'clinicians',
    'profiles', 
    'user_permissions',
    'customers',
    'appointment_occurrences',
    'services'
  ];

  const benchmarks: PolicyPerformanceBenchmark[] = [];
  
  console.log(`Starting performance benchmarks for ${criticalTables.length} tables...`);
  
  for (const table of criticalTables) {
    console.log(`Benchmarking ${table}...`);
    
    try {
      const benchmark = await benchmarkPolicyPerformance(
        config,
        table,
        'SELECT',
        iterations
      );
      
      benchmarks.push(benchmark);
      
      console.log(`${table}: ${benchmark.averageExecutionTime.toFixed(2)}ms avg, ${benchmark.successRate}% success`);
    } catch (error) {
      console.error(`Failed to benchmark ${table}:`, error);
      
      // Add failed benchmark
      benchmarks.push({
        tableName: table,
        operation: 'SELECT',
        averageExecutionTime: -1,
        minExecutionTime: -1,
        maxExecutionTime: -1,
        totalExecutions: 0,
        successRate: 0
      });
    }
  }

  // Generate summary
  const validBenchmarks = benchmarks.filter(b => b.averageExecutionTime > 0);
  const averageResponseTime = validBenchmarks.length > 0 
    ? validBenchmarks.reduce((sum, b) => sum + b.averageExecutionTime, 0) / validBenchmarks.length
    : 0;

  const slowestBenchmark = validBenchmarks.reduce((slowest, current) => 
    current.averageExecutionTime > slowest.averageExecutionTime ? current : slowest,
    validBenchmarks[0] || { tableName: 'none', averageExecutionTime: 0 }
  );

  const fastestBenchmark = validBenchmarks.reduce((fastest, current) => 
    current.averageExecutionTime < fastest.averageExecutionTime ? current : fastest,
    validBenchmarks[0] || { tableName: 'none', averageExecutionTime: 0 }
  );

  const tablesWithIssues = benchmarks
    .filter(b => 
      b.averageExecutionTime > thresholds.maxAverageExecutionTime ||
      b.successRate < thresholds.minSuccessRate ||
      b.maxExecutionTime > thresholds.maxExecutionTime
    )
    .map(b => b.tableName);

  // Determine overall health
  let overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  
  if (tablesWithIssues.length > 0) {
    const criticalIssues = benchmarks.some(b => 
      b.successRate < 50 || b.averageExecutionTime > thresholds.maxAverageExecutionTime * 2
    );
    overallHealth = criticalIssues ? 'CRITICAL' : 'WARNING';
  }

  // Generate recommendations
  const recommendations = generateRecommendations(benchmarks, thresholds);

  const report: PerformanceReport = {
    timestamp,
    environment,
    overallHealth,
    benchmarks,
    summary: {
      totalTables: criticalTables.length,
      averageResponseTime,
      slowestTable: slowestBenchmark.tableName,
      fastestTable: fastestBenchmark.tableName,
      tablesWithIssues
    },
    recommendations
  };

  return report;
}

/**
 * Generates performance recommendations based on benchmark results
 */
function generateRecommendations(
  benchmarks: PolicyPerformanceBenchmark[],
  thresholds: PerformanceThresholds
): string[] {
  const recommendations: string[] = [];

  benchmarks.forEach(benchmark => {
    if (benchmark.averageExecutionTime > thresholds.maxAverageExecutionTime) {
      recommendations.push(
        `${benchmark.tableName}: Average execution time (${benchmark.averageExecutionTime.toFixed(2)}ms) exceeds threshold (${thresholds.maxAverageExecutionTime}ms). Consider optimizing RLS policies or adding indexes.`
      );
    }

    if (benchmark.successRate < thresholds.minSuccessRate) {
      recommendations.push(
        `${benchmark.tableName}: Success rate (${benchmark.successRate}%) is below threshold (${thresholds.minSuccessRate}%). Check for policy errors or circular dependencies.`
      );
    }

    if (benchmark.maxExecutionTime > thresholds.maxExecutionTime) {
      recommendations.push(
        `${benchmark.tableName}: Maximum execution time (${benchmark.maxExecutionTime.toFixed(2)}ms) is concerning. Investigate potential infinite recursion or complex policy logic.`
      );
    }

    if (benchmark.successRate === 0) {
      recommendations.push(
        `${benchmark.tableName}: Complete failure to execute queries. Check RLS policies for syntax errors or circular dependencies.`
      );
    }
  });

  // General recommendations
  if (recommendations.length === 0) {
    recommendations.push('All policy performance metrics are within acceptable thresholds.');
  } else {
    recommendations.push('Consider running the comprehensive policy test suite to identify specific issues.');
    recommendations.push('Review database indexes on user_id and tenant_id columns for affected tables.');
    recommendations.push('Simplify RLS policies to use direct auth.uid() comparisons where possible.');
  }

  return recommendations;
}

/**
 * Formats and displays a performance report
 */
export function displayPerformanceReport(report: PerformanceReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('RLS POLICY PERFORMANCE REPORT');
  console.log('='.repeat(60));
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Environment: ${report.environment}`);
  console.log(`Overall Health: ${report.overallHealth}`);
  console.log('');

  console.log('SUMMARY:');
  console.log(`  Total Tables Tested: ${report.summary.totalTables}`);
  console.log(`  Average Response Time: ${report.summary.averageResponseTime.toFixed(2)}ms`);
  console.log(`  Slowest Table: ${report.summary.slowestTable}`);
  console.log(`  Fastest Table: ${report.summary.fastestTable}`);
  console.log(`  Tables with Issues: ${report.summary.tablesWithIssues.length}`);
  
  if (report.summary.tablesWithIssues.length > 0) {
    console.log(`    - ${report.summary.tablesWithIssues.join(', ')}`);
  }
  console.log('');

  console.log('DETAILED BENCHMARKS:');
  report.benchmarks.forEach(benchmark => {
    const status = benchmark.successRate >= 95 && benchmark.averageExecutionTime <= 2000 ? '✓' : '⚠';
    console.log(`  ${status} ${benchmark.tableName}:`);
    console.log(`      Avg: ${benchmark.averageExecutionTime.toFixed(2)}ms`);
    console.log(`      Min: ${benchmark.minExecutionTime.toFixed(2)}ms`);
    console.log(`      Max: ${benchmark.maxExecutionTime.toFixed(2)}ms`);
    console.log(`      Success Rate: ${benchmark.successRate}%`);
    console.log(`      Executions: ${benchmark.totalExecutions}`);
  });
  console.log('');

  console.log('RECOMMENDATIONS:');
  report.recommendations.forEach((rec, index) => {
    console.log(`  ${index + 1}. ${rec}`);
  });
  console.log('');
}

/**
 * Saves performance report to file
 */
export function savePerformanceReport(report: PerformanceReport, filename?: string): string {
  const defaultFilename = `policy-performance-${new Date().toISOString().split('T')[0]}.json`;
  const filepath = filename || defaultFilename;
  
  try {
    const fs = require('fs');
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`Performance report saved to: ${filepath}`);
    return filepath;
  } catch (error) {
    console.error('Failed to save performance report:', error);
    throw error;
  }
}

/**
 * Main function to run performance benchmarks and generate report
 */
export async function main(config?: PolicyTestConfig): Promise<void> {
  const testConfig = config || {
    supabaseUrl: process.env.VITE_SUPABASE_URL || 'https://test.supabase.co',
    supabaseKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'test-key',
    testUserId: 'benchmark-user-id',
    testTenantId: 'benchmark-tenant-id'
  };

  try {
    console.log('Starting RLS Policy Performance Benchmarks...');
    
    const report = await runPerformanceBenchmarks(testConfig);
    
    displayPerformanceReport(report);
    
    if (process.env.SAVE_REPORT !== 'false') {
      savePerformanceReport(report);
    }
    
    // Exit with error code if health is critical
    if (report.overallHealth === 'CRITICAL') {
      console.error('CRITICAL issues detected in RLS policy performance!');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Failed to run performance benchmarks:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}