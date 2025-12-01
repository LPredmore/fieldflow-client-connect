/**
 * Comprehensive System Test Runner for Clinician Registration Routing System
 * 
 * Orchestrates all system tests including integration tests, performance tests,
 * and cross-browser compatibility tests.
 */

import { execSync } from 'child_process';
import { performance } from 'perf_hooks';

interface TestSuite {
  name: string;
  command: string;
  timeout: number;
  critical: boolean;
}

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
}

interface SystemTestReport {
  totalSuites: number;
  passedSuites: number;
  failedSuites: number;
  totalDuration: number;
  results: TestResult[];
  summary: string;
}

class ClinicianRoutingSystemTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'Unit Tests - Staff Type Detector',
      command: 'npx vitest run src/utils/__tests__/staffTypeDetector.test.ts',
      timeout: 30000,
      critical: true,
    },
    {
      name: 'Integration Tests - Clinician Registration Routing',
      command: 'npx vitest run src/test/clinicianRegistrationRoutingIntegration.test.tsx',
      timeout: 60000,
      critical: true,
    },
    {
      name: 'Performance Tests - Route Guard Performance',
      command: 'npx vitest run src/test/routeGuardPerformance.test.ts',
      timeout: 120000,
      critical: false,
    },
    {
      name: 'Error Scenario Tests - Edge Cases',
      command: 'npx vitest run src/test/clinicianRoutingErrorScenarios.test.ts',
      timeout: 45000,
      critical: true,
    },
    {
      name: 'Cross-Browser Compatibility Tests',
      command: 'npx vitest run src/test/clinicianRoutingCompatibility.test.ts',
      timeout: 90000,
      critical: false,
    },
  ];

  async runAllTests(): Promise<SystemTestReport> {
    console.log('🚀 Starting Comprehensive Clinician Registration Routing System Tests');
    console.log('=' .repeat(80));

    const startTime = performance.now();
    const results: TestResult[] = [];

    for (const suite of this.testSuites) {
      console.log(`\n📋 Running: ${suite.name}`);
      console.log('-'.repeat(50));

      const result = await this.runTestSuite(suite);
      results.push(result);

      if (result.passed) {
        console.log(`✅ ${suite.name} - PASSED (${result.duration.toFixed(2)}ms)`);
      } else {
        console.log(`❌ ${suite.name} - FAILED (${result.duration.toFixed(2)}ms)`);
        if (result.error) {
          console.log(`Error: ${result.error}`);
        }
        
        if (suite.critical) {
          console.log(`🚨 Critical test failed. Stopping execution.`);
          break;
        }
      }
    }

    const endTime = performance.now();
    const totalDuration = endTime - startTime;

    const report = this.generateReport(results, totalDuration);
    this.printReport(report);

    return report;
  }

  private async runTestSuite(suite: TestSuite): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const output = execSync(suite.command, {
        encoding: 'utf8',
        timeout: suite.timeout,
        stdio: 'pipe',
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      return {
        suite: suite.name,
        passed: true,
        duration,
        output,
      };
    } catch (error: any) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      return {
        suite: suite.name,
        passed: false,
        duration,
        output: error.stdout || '',
        error: error.message || 'Unknown error',
      };
    }
  }

  private generateReport(results: TestResult[], totalDuration: number): SystemTestReport {
    const totalSuites = results.length;
    const passedSuites = results.filter(r => r.passed).length;
    const failedSuites = totalSuites - passedSuites;

    let summary = '';
    if (failedSuites === 0) {
      summary = '🎉 All tests passed! The Clinician Registration Routing System is ready for deployment.';
    } else {
      const criticalFailures = results.filter(r => !r.passed && this.testSuites.find(s => s.name === r.suite)?.critical).length;
      if (criticalFailures > 0) {
        summary = `🚨 ${criticalFailures} critical test(s) failed. System is not ready for deployment.`;
      } else {
        summary = `⚠️ ${failedSuites} non-critical test(s) failed. Review before deployment.`;
      }
    }

    return {
      totalSuites,
      passedSuites,
      failedSuites,
      totalDuration,
      results,
      summary,
    };
  }

  private printReport(report: SystemTestReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(80));

    console.log(`\n📈 Test Statistics:`);
    console.log(`   Total Test Suites: ${report.totalSuites}`);
    console.log(`   Passed: ${report.passedSuites}`);
    console.log(`   Failed: ${report.failedSuites}`);
    console.log(`   Total Duration: ${(report.totalDuration / 1000).toFixed(2)} seconds`);

    console.log(`\n📋 Detailed Results:`);
    report.results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const duration = (result.duration / 1000).toFixed(2);
      console.log(`   ${status} - ${result.suite} (${duration}s)`);
      
      if (!result.passed && result.error) {
        console.log(`     Error: ${result.error.substring(0, 100)}...`);
      }
    });

    console.log(`\n🎯 Summary:`);
    console.log(`   ${report.summary}`);

    console.log('\n' + '='.repeat(80));
  }

  async runSpecificTest(testName: string): Promise<TestResult | null> {
    const suite = this.testSuites.find(s => s.name.toLowerCase().includes(testName.toLowerCase()));
    
    if (!suite) {
      console.log(`❌ Test suite not found: ${testName}`);
      console.log('Available test suites:');
      this.testSuites.forEach(s => console.log(`   - ${s.name}`));
      return null;
    }

    console.log(`🚀 Running specific test: ${suite.name}`);
    const result = await this.runTestSuite(suite);
    
    if (result.passed) {
      console.log(`✅ ${suite.name} - PASSED`);
    } else {
      console.log(`❌ ${suite.name} - FAILED`);
      console.log(`Error: ${result.error}`);
    }

    return result;
  }

  listAvailableTests(): void {
    console.log('📋 Available Test Suites:');
    console.log('='.repeat(50));
    
    this.testSuites.forEach((suite, index) => {
      const criticalBadge = suite.critical ? '🔴 CRITICAL' : '🟡 NON-CRITICAL';
      console.log(`${index + 1}. ${suite.name}`);
      console.log(`   ${criticalBadge} - Timeout: ${suite.timeout / 1000}s`);
      console.log(`   Command: ${suite.command}`);
      console.log('');
    });
  }

  async validateSystemReadiness(): Promise<boolean> {
    console.log('🔍 Validating System Readiness for Deployment');
    console.log('='.repeat(50));

    const criticalTests = this.testSuites.filter(s => s.critical);
    let allCriticalPassed = true;

    for (const suite of criticalTests) {
      console.log(`\n🔍 Validating: ${suite.name}`);
      const result = await this.runTestSuite(suite);
      
      if (result.passed) {
        console.log(`✅ ${suite.name} - VALIDATED`);
      } else {
        console.log(`❌ ${suite.name} - VALIDATION FAILED`);
        allCriticalPassed = false;
      }
    }

    console.log('\n' + '='.repeat(50));
    if (allCriticalPassed) {
      console.log('🎉 System is ready for deployment!');
      console.log('All critical tests passed successfully.');
    } else {
      console.log('🚨 System is NOT ready for deployment!');
      console.log('One or more critical tests failed.');
    }

    return allCriticalPassed;
  }
}

// CLI interface
if (require.main === module) {
  const runner = new ClinicianRoutingSystemTestRunner();
  const command = process.argv[2];

  switch (command) {
    case 'all':
      runner.runAllTests();
      break;
    case 'list':
      runner.listAvailableTests();
      break;
    case 'validate':
      runner.validateSystemReadiness();
      break;
    case 'run':
      const testName = process.argv[3];
      if (testName) {
        runner.runSpecificTest(testName);
      } else {
        console.log('❌ Please specify a test name');
        runner.listAvailableTests();
      }
      break;
    default:
      console.log('🚀 Clinician Registration Routing System Test Runner');
      console.log('Usage:');
      console.log('  npm run test:clinician-routing all      - Run all tests');
      console.log('  npm run test:clinician-routing list     - List available tests');
      console.log('  npm run test:clinician-routing validate - Validate system readiness');
      console.log('  npm run test:clinician-routing run <name> - Run specific test');
      break;
  }
}

export { ClinicianRoutingSystemTestRunner };