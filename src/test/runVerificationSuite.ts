#!/usr/bin/env node

/**
 * Comprehensive test runner for database query performance fix verification
 * 
 * This script runs all verification tests and provides a detailed report
 * of the fix effectiveness against the original requirements.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface TestResult {
  testFile: string;
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  metrics?: {
    loadTime?: number;
    errorCount?: number;
    circuitBreakerState?: string;
  };
}

interface VerificationReport {
  timestamp: string;
  overallStatus: 'passed' | 'failed';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  requirements: {
    [key: string]: {
      status: 'passed' | 'failed';
      tests: TestResult[];
      description: string;
    };
  };
  performanceMetrics: {
    averageLoadTime: number;
    maxLoadTime: number;
    totalErrors: number;
    circuitBreakerRecoveries: number;
  };
}

class VerificationRunner {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  async runAllTests(): Promise<VerificationReport> {
    console.log('🚀 Starting Database Query Performance Fix Verification Suite\n');

    const testFiles = [
      'src/test/integration.test.tsx',
      'src/test/performanceRegression.test.tsx',
      'src/test/fixVerification.test.tsx',
    ];

    for (const testFile of testFiles) {
      await this.runTestFile(testFile);
    }

    return this.generateReport();
  }

  private async runTestFile(testFile: string): Promise<void> {
    console.log(`📋 Running ${testFile}...`);
    
    try {
      const startTime = Date.now();
      
      // Run the test file using vitest
      const output = execSync(`npx vitest run ${testFile} --reporter=json`, {
        encoding: 'utf-8',
        timeout: 120000, // 2 minutes timeout
      });

      const duration = Date.now() - startTime;
      
      // Parse vitest JSON output
      try {
        const testResults = JSON.parse(output);
        this.parseVitestResults(testFile, testResults, duration);
      } catch (parseError) {
        // If JSON parsing fails, treat as a single failed test
        this.results.push({
          testFile,
          testName: 'Test execution',
          status: 'failed',
          duration,
          error: 'Failed to parse test results',
        });
      }

      console.log(`✅ Completed ${testFile} in ${duration}ms\n`);
      
    } catch (error: any) {
      console.log(`❌ Failed ${testFile}: ${error.message}\n`);
      
      this.results.push({
        testFile,
        testName: 'Test execution',
        status: 'failed',
        duration: Date.now() - Date.now(),
        error: error.message,
      });
    }
  }

  private parseVitestResults(testFile: string, vitestResults: any, duration: number): void {
    // Parse vitest JSON output format
    if (vitestResults.testResults) {
      vitestResults.testResults.forEach((suite: any) => {
        if (suite.assertionResults) {
          suite.assertionResults.forEach((test: any) => {
            this.results.push({
              testFile,
              testName: test.title || test.fullName,
              status: test.status === 'passed' ? 'passed' : 'failed',
              duration: test.duration || 0,
              error: test.failureMessages?.join('\n'),
            });
          });
        }
      });
    } else {
      // Fallback for different vitest output formats
      this.results.push({
        testFile,
        testName: 'All tests',
        status: vitestResults.success ? 'passed' : 'failed',
        duration,
        error: vitestResults.error,
      });
    }
  }

  private generateReport(): VerificationReport {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'passed').length;
    const failedTests = this.results.filter(r => r.status === 'failed').length;
    const skippedTests = this.results.filter(r => r.status === 'skipped').length;

    const loadTimes = this.results
      .map(r => r.metrics?.loadTime)
      .filter((time): time is number => typeof time === 'number');

    const report: VerificationReport = {
      timestamp: new Date().toISOString(),
      overallStatus: failedTests === 0 ? 'passed' : 'failed',
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      requirements: this.categorizeByRequirements(),
      performanceMetrics: {
        averageLoadTime: loadTimes.length > 0 ? loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length : 0,
        maxLoadTime: loadTimes.length > 0 ? Math.max(...loadTimes) : 0,
        totalErrors: this.results.reduce((sum, r) => sum + (r.metrics?.errorCount || 0), 0),
        circuitBreakerRecoveries: this.results.filter(r => 
          r.metrics?.circuitBreakerState === 'CLOSED' && r.testName.includes('recovery')
        ).length,
      },
    };

    return report;
  }

  private categorizeByRequirements(): VerificationReport['requirements'] {
    const requirements = {
      'REQ-1.1': {
        description: 'Services page loads in under 5 seconds',
        status: 'failed' as const,
        tests: [] as TestResult[],
      },
      'REQ-2.2': {
        description: 'No 60-second hangs on database errors',
        status: 'failed' as const,
        tests: [] as TestResult[],
      },
      'REQ-3.2': {
        description: 'Circuit breaker recovers appropriately',
        status: 'failed' as const,
        tests: [] as TestResult[],
      },
      'REQ-5.1': {
        description: 'Conditional loading works correctly',
        status: 'failed' as const,
        tests: [] as TestResult[],
      },
    };

    // Categorize tests by requirements
    this.results.forEach(result => {
      if (result.testName.includes('Services page') || result.testName.includes('load time')) {
        requirements['REQ-1.1'].tests.push(result);
      }
      if (result.testName.includes('60 second') || result.testName.includes('hang')) {
        requirements['REQ-2.2'].tests.push(result);
      }
      if (result.testName.includes('circuit breaker') || result.testName.includes('recovery')) {
        requirements['REQ-3.2'].tests.push(result);
      }
      if (result.testName.includes('conditional') || result.testName.includes('loading')) {
        requirements['REQ-5.1'].tests.push(result);
      }
    });

    // Determine status for each requirement
    Object.keys(requirements).forEach(reqKey => {
      const req = requirements[reqKey];
      if (req.tests.length > 0) {
        req.status = req.tests.every(t => t.status === 'passed') ? 'passed' : 'failed';
      }
    });

    return requirements;
  }

  printReport(report: VerificationReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 DATABASE QUERY PERFORMANCE FIX VERIFICATION REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n📅 Timestamp: ${report.timestamp}`);
    console.log(`🎯 Overall Status: ${report.overallStatus.toUpperCase()}`);
    console.log(`📈 Test Summary: ${report.passedTests}/${report.totalTests} passed`);
    
    if (report.failedTests > 0) {
      console.log(`❌ Failed Tests: ${report.failedTests}`);
    }
    if (report.skippedTests > 0) {
      console.log(`⏭️  Skipped Tests: ${report.skippedTests}`);
    }

    console.log('\n📋 REQUIREMENTS VERIFICATION:');
    console.log('-'.repeat(50));
    
    Object.entries(report.requirements).forEach(([reqId, req]) => {
      const statusIcon = req.status === 'passed' ? '✅' : '❌';
      console.log(`${statusIcon} ${reqId}: ${req.description}`);
      console.log(`   Tests: ${req.tests.filter(t => t.status === 'passed').length}/${req.tests.length} passed`);
      
      if (req.status === 'failed') {
        req.tests.filter(t => t.status === 'failed').forEach(test => {
          console.log(`   ❌ ${test.testName}: ${test.error || 'Failed'}`);
        });
      }
    });

    console.log('\n⚡ PERFORMANCE METRICS:');
    console.log('-'.repeat(30));
    console.log(`Average Load Time: ${report.performanceMetrics.averageLoadTime.toFixed(2)}ms`);
    console.log(`Max Load Time: ${report.performanceMetrics.maxLoadTime.toFixed(2)}ms`);
    console.log(`Total Errors: ${report.performanceMetrics.totalErrors}`);
    console.log(`Circuit Breaker Recoveries: ${report.performanceMetrics.circuitBreakerRecoveries}`);

    if (report.overallStatus === 'passed') {
      console.log('\n🎉 ALL FIXES VERIFIED SUCCESSFULLY!');
      console.log('The database query performance issues have been resolved.');
    } else {
      console.log('\n⚠️  SOME FIXES NEED ATTENTION');
      console.log('Please review the failed tests above.');
    }

    console.log('\n' + '='.repeat(80));
  }

  saveReport(report: VerificationReport): void {
    const reportPath = join(process.cwd(), 'verification-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  }
}

// Main execution
async function main() {
  const runner = new VerificationRunner();
  
  try {
    const report = await runner.runAllTests();
    runner.printReport(report);
    runner.saveReport(report);
    
    // Exit with appropriate code
    process.exit(report.overallStatus === 'passed' ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Verification suite failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { VerificationRunner, type VerificationReport, type TestResult };