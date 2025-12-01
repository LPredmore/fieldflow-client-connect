#!/usr/bin/env node

/**
 * RLS Policy Test Runner
 * 
 * Command-line utility to run RLS policy tests and performance benchmarks.
 * 
 * Usage:
 *   npm run test:policies
 *   npm run test:policies -- --performance
 *   npm run test:policies -- --comprehensive
 * 
 * Requirements: 2.1, 2.2, 3.1
 */

import { 
  PolicyTestConfig,
  runComprehensivePolicyTests 
} from './rlsPolicyTestUtils';
import { 
  runPerformanceBenchmarks, 
  displayPerformanceReport,
  savePerformanceReport 
} from './policyPerformanceRunner';

interface TestOptions {
  performance: boolean;
  comprehensive: boolean;
  save: boolean;
  iterations: number;
  tables: string[];
  config?: PolicyTestConfig;
}

/**
 * Parse command line arguments
 */
function parseArgs(): TestOptions {
  const args = process.argv.slice(2);
  
  return {
    performance: args.includes('--performance') || args.includes('-p'),
    comprehensive: args.includes('--comprehensive') || args.includes('-c'),
    save: args.includes('--save') || args.includes('-s'),
    iterations: parseInt(args.find(arg => arg.startsWith('--iterations='))?.split('=')[1] || '10'),
    tables: args.find(arg => arg.startsWith('--tables='))?.split('=')[1]?.split(',') || []
  };
}

/**
 * Get test configuration from environment or defaults
 */
function getTestConfig(): PolicyTestConfig {
  return {
    supabaseUrl: process.env.VITE_SUPABASE_URL || 'https://tizshsmrqqaharwpqocj.supabase.co',
    supabaseKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'test-key',
    testUserId: process.env.TEST_USER_ID || 'test-user-id',
    testTenantId: process.env.TEST_TENANT_ID || 'test-tenant-id'
  };
}

/**
 * Display help information
 */
function displayHelp(): void {
  console.log(`
RLS Policy Test Runner

Usage:
  npm run test:policies [options]

Options:
  --performance, -p     Run performance benchmarks
  --comprehensive, -c   Run comprehensive policy tests
  --save, -s           Save results to file
  --iterations=N       Number of iterations for performance tests (default: 10)
  --tables=table1,table2  Specific tables to test (comma-separated)
  --help, -h           Show this help message

Examples:
  npm run test:policies --performance
  npm run test:policies --comprehensive --save
  npm run test:policies --performance --iterations=20 --tables=clinicians,profiles
`);
}

/**
 * Run comprehensive policy tests
 */
async function runComprehensiveTests(config: PolicyTestConfig, tables?: string[]): Promise<void> {
  console.log('Running comprehensive RLS policy tests...\n');
  
  const tablesToTest = tables && tables.length > 0 
    ? tables 
    : ['clinicians', 'profiles', 'user_permissions'];
  
  try {
    const results = await runComprehensivePolicyTests(config, tablesToTest);
    
    console.log('COMPREHENSIVE POLICY TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`Overall Health: ${results.overallHealth}\n`);
    
    // Display circular dependency test results
    console.log('CIRCULAR DEPENDENCY TESTS:');
    results.circularDependencyTests.forEach(test => {
      const status = test.result.hasCircularDependency ? '❌ FAIL' : '✅ PASS';
      console.log(`  ${status} ${test.table}`);
      if (test.result.hasCircularDependency) {
        console.log(`    Error: ${test.result.error}`);
      }
      console.log(`    Execution Time: ${test.result.executionTime.toFixed(2)}ms`);
    });
    console.log('');
    
    // Display user isolation test results
    console.log('USER ISOLATION TESTS:');
    results.userIsolationTests.forEach(test => {
      const status = test.result.isolated ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${status} ${test.table}`);
      if (!test.result.isolated) {
        console.log(`    Error: ${test.result.error}`);
      }
    });
    console.log('');
    
    // Display performance benchmarks
    console.log('PERFORMANCE BENCHMARKS:');
    results.performanceBenchmarks.forEach(benchmark => {
      const status = benchmark.averageExecutionTime <= 2000 && benchmark.successRate >= 95 ? '✅' : '⚠️';
      console.log(`  ${status} ${benchmark.tableName}:`);
      console.log(`    Average: ${benchmark.averageExecutionTime.toFixed(2)}ms`);
      console.log(`    Success Rate: ${benchmark.successRate}%`);
    });
    console.log('');
    
    // Summary and recommendations
    if (results.overallHealth === 'CRITICAL') {
      console.log('🚨 CRITICAL ISSUES DETECTED:');
      console.log('  - Circular dependencies or user isolation failures found');
      console.log('  - Immediate action required to fix RLS policies');
      process.exit(1);
    } else if (results.overallHealth === 'WARNING') {
      console.log('⚠️  WARNING: Performance issues detected');
      console.log('  - Consider optimizing RLS policies or database indexes');
    } else {
      console.log('✅ All policy tests passed successfully');
    }
    
  } catch (error) {
    console.error('Failed to run comprehensive tests:', error);
    process.exit(1);
  }
}

/**
 * Run performance benchmarks
 */
async function runPerformanceTests(
  config: PolicyTestConfig, 
  iterations: number, 
  tables?: string[],
  save: boolean = false
): Promise<void> {
  console.log(`Running performance benchmarks (${iterations} iterations)...\n`);
  
  try {
    const report = await runPerformanceBenchmarks(config, undefined, iterations);
    
    displayPerformanceReport(report);
    
    if (save) {
      savePerformanceReport(report);
    }
    
    if (report.overallHealth === 'CRITICAL') {
      console.error('🚨 CRITICAL performance issues detected!');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Failed to run performance benchmarks:', error);
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const options = parseArgs();
  
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    displayHelp();
    return;
  }
  
  const config = getTestConfig();
  
  console.log('RLS Policy Test Runner');
  console.log('='.repeat(30));
  console.log(`Supabase URL: ${config.supabaseUrl}`);
  console.log(`Test User ID: ${config.testUserId}`);
  console.log(`Test Tenant ID: ${config.testTenantId}\n`);
  
  try {
    if (options.comprehensive) {
      await runComprehensiveTests(config, options.tables);
    } else if (options.performance) {
      await runPerformanceTests(config, options.iterations, options.tables, options.save);
    } else {
      // Default: run both comprehensive and performance tests
      console.log('Running both comprehensive and performance tests...\n');
      await runComprehensiveTests(config, options.tables);
      console.log('\n' + '='.repeat(50) + '\n');
      await runPerformanceTests(config, options.iterations, options.tables, options.save);
    }
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main as runPolicyTests };