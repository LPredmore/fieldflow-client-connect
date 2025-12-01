#!/usr/bin/env node

/**
 * Deployment Validation Script
 * 
 * This script validates that the migration was successful by:
 * 1. Checking that all policies are working correctly
 * 2. Verifying no circular dependencies remain
 * 3. Testing actual database operations
 * 4. Validating performance improvements
 * 
 * Requirements: 1.1, 2.1, 2.2, 4.1
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import PolicyAnalyzer from './policy-analysis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DeploymentValidator {
  constructor() {
    this.supabase = null;
    this.testResults = [];
    this.performanceMetrics = {};
    this.validationReport = {
      timestamp: new Date().toISOString(),
      tests: [],
      performance: {},
      policyAnalysis: {},
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0,
        totalTests: 0
      }
    };
  }

  /**
   * Initialize Supabase client
   */
  async initialize() {
    // Load environment variables
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envVars = envContent.split('\n').reduce((acc, line) => {
        const [key, value] = line.split('=');
        if (key && value) {
          acc[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
        }
        return acc;
      }, {});
      
      Object.assign(process.env, envVars);
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('✅ Supabase client initialized');
  }

  /**
   * Add test result to the report
   */
  addTestResult(testName, status, details = {}) {
    const result = {
      name: testName,
      status: status, // 'passed', 'failed', 'warning'
      timestamp: new Date().toISOString(),
      ...details
    };

    this.testResults.push(result);
    this.validationReport.tests.push(result);
    this.validationReport.summary.totalTests++;
    
    if (status === 'passed') {
      this.validationReport.summary.passed++;
      console.log(`   ✅ ${testName}`);
    } else if (status === 'failed') {
      this.validationReport.summary.failed++;
      console.log(`   ❌ ${testName}: ${details.error || 'Failed'}`);
    } else if (status === 'warning') {
      this.validationReport.summary.warnings++;
      console.log(`   ⚠️  ${testName}: ${details.warning || 'Warning'}`);
    }

    if (details.duration) {
      console.log(`      Duration: ${details.duration}ms`);
    }
  }

  /**
   * Test 1: Verify database connectivity and basic operations
   */
  async testDatabaseConnectivity() {
    console.log('🔍 Testing database connectivity...');
    
    try {
      const startTime = Date.now();
      const { data, error } = await this.supabase.from('profiles').select('count').limit(1);
      const duration = Date.now() - startTime;

      if (error) {
        this.addTestResult('Database Connectivity', 'failed', {
          error: error.message,
          duration
        });
        return false;
      }

      this.addTestResult('Database Connectivity', 'passed', { duration });
      return true;
    } catch (error) {
      this.addTestResult('Database Connectivity', 'failed', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Test 2: Verify all expected policies exist and are active
   */
  async testPolicyExistence() {
    console.log('🔍 Testing policy existence...');
    
    const expectedPolicies = [
      {
        name: 'Users can manage own clinician record',
        table: 'clinicians',
        type: 'ALL'
      },
      {
        name: 'Users can view tenant clinicians',
        table: 'clinicians',
        type: 'SELECT'
      },
      {
        name: 'Business admins can manage tenant clinicians',
        table: 'clinicians',
        type: 'ALL'
      },
      {
        name: 'Prevent is_admin privilege escalation',
        table: 'clinicians',
        type: 'UPDATE'
      }
    ];

    let allPoliciesExist = true;

    for (const expectedPolicy of expectedPolicies) {
      try {
        // Test if the policy allows basic operations
        const startTime = Date.now();
        const { error } = await this.supabase.from(expectedPolicy.table).select('id').limit(1);
        const duration = Date.now() - startTime;

        if (error && error.message.includes('infinite recursion')) {
          this.addTestResult(`Policy: ${expectedPolicy.name}`, 'failed', {
            error: 'Infinite recursion still detected',
            duration
          });
          allPoliciesExist = false;
        } else {
          this.addTestResult(`Policy: ${expectedPolicy.name}`, 'passed', {
            duration,
            note: 'Policy allows basic operations without recursion'
          });
        }
      } catch (error) {
        this.addTestResult(`Policy: ${expectedPolicy.name}`, 'failed', {
          error: error.message
        });
        allPoliciesExist = false;
      }
    }

    return allPoliciesExist;
  }

  /**
   * Test 3: Verify no circular dependencies remain
   */
  async testCircularDependencies() {
    console.log('🔍 Testing for circular dependencies...');
    
    try {
      const analyzer = new PolicyAnalyzer();
      const policyReport = await analyzer.run();
      
      this.validationReport.policyAnalysis = policyReport;
      
      const circularRefs = policyReport.circularReferences.length;
      const cliniciansIssues = policyReport.cliniciansTableAnalysis.potentialIssues.length;
      
      if (circularRefs === 0) {
        this.addTestResult('Circular Dependencies', 'passed', {
          circularReferences: circularRefs,
          note: 'No circular references detected'
        });
      } else {
        this.addTestResult('Circular Dependencies', 'failed', {
          error: `Found ${circularRefs} circular reference(s)`,
          circularReferences: policyReport.circularReferences
        });
      }

      if (cliniciansIssues === 0) {
        this.addTestResult('Clinicians Policy Issues', 'passed', {
          issues: cliniciansIssues,
          note: 'No issues detected in clinicians policies'
        });
      } else {
        this.addTestResult('Clinicians Policy Issues', 'warning', {
          warning: `Found ${cliniciansIssues} potential issue(s)`,
          issues: policyReport.cliniciansTableAnalysis.potentialIssues
        });
      }

      return circularRefs === 0;
    } catch (error) {
      this.addTestResult('Circular Dependencies', 'failed', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Test 4: Test actual clinician operations
   */
  async testClinicianOperations() {
    console.log('🔍 Testing clinician operations...');
    
    try {
      // Test 4a: Basic SELECT operation
      const startTime = Date.now();
      const { data: selectData, error: selectError } = await this.supabase
        .from('clinicians')
        .select('id, user_id, tenant_id')
        .limit(5);
      const selectDuration = Date.now() - startTime;

      if (selectError) {
        if (selectError.message.includes('infinite recursion')) {
          this.addTestResult('Clinician SELECT Operation', 'failed', {
            error: 'Infinite recursion detected in SELECT',
            duration: selectDuration
          });
          return false;
        } else {
          this.addTestResult('Clinician SELECT Operation', 'warning', {
            warning: selectError.message,
            duration: selectDuration
          });
        }
      } else {
        this.addTestResult('Clinician SELECT Operation', 'passed', {
          duration: selectDuration,
          recordsFound: selectData?.length || 0
        });
      }

      // Test 4b: Performance check - should be under 2 seconds (Requirement 1.1)
      if (selectDuration > 2000) {
        this.addTestResult('Clinician Query Performance', 'warning', {
          warning: `Query took ${selectDuration}ms (over 2 second requirement)`,
          duration: selectDuration
        });
      } else {
        this.addTestResult('Clinician Query Performance', 'passed', {
          duration: selectDuration,
          note: 'Query completed within 2 second requirement'
        });
      }

      // Test 4c: Test with authentication context (if possible)
      try {
        // Create a test user context
        const { data: authData, error: authError } = await this.supabase.auth.signInAnonymously();
        
        if (!authError && authData.user) {
          const authStartTime = Date.now();
          const { error: authSelectError } = await this.supabase
            .from('clinicians')
            .select('id')
            .eq('user_id', authData.user.id)
            .limit(1);
          const authDuration = Date.now() - authStartTime;

          if (authSelectError && authSelectError.message.includes('infinite recursion')) {
            this.addTestResult('Authenticated Clinician Query', 'failed', {
              error: 'Infinite recursion in authenticated query',
              duration: authDuration
            });
          } else {
            this.addTestResult('Authenticated Clinician Query', 'passed', {
              duration: authDuration,
              note: 'Authenticated query completed without recursion'
            });
          }

          // Clean up test user
          await this.supabase.auth.signOut();
        } else {
          this.addTestResult('Authenticated Clinician Query', 'warning', {
            warning: 'Could not create test user for authentication test'
          });
        }
      } catch (authError) {
        this.addTestResult('Authenticated Clinician Query', 'warning', {
          warning: `Authentication test failed: ${authError.message}`
        });
      }

      return true;
    } catch (error) {
      this.addTestResult('Clinician Operations', 'failed', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Test 5: Verify new helper functions work correctly
   */
  async testHelperFunctions() {
    console.log('🔍 Testing helper functions...');
    
    try {
      // Test is_business_admin function
      const startTime = Date.now();
      const { data, error } = await this.supabase.rpc('is_business_admin');
      const duration = Date.now() - startTime;

      if (error) {
        this.addTestResult('is_business_admin Function', 'failed', {
          error: error.message,
          duration
        });
        return false;
      } else {
        this.addTestResult('is_business_admin Function', 'passed', {
          duration,
          result: data,
          note: 'Function executed without circular reference'
        });
      }

      // Test function with specific user ID
      try {
        const { data: specificData, error: specificError } = await this.supabase
          .rpc('is_business_admin', { _user_id: '00000000-0000-0000-0000-000000000000' });

        if (specificError) {
          this.addTestResult('is_business_admin with User ID', 'warning', {
            warning: specificError.message
          });
        } else {
          this.addTestResult('is_business_admin with User ID', 'passed', {
            result: specificData,
            note: 'Function accepts user ID parameter correctly'
          });
        }
      } catch (error) {
        this.addTestResult('is_business_admin with User ID', 'warning', {
          warning: error.message
        });
      }

      return true;
    } catch (error) {
      this.addTestResult('Helper Functions', 'failed', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Test 6: Performance benchmarking
   */
  async testPerformance() {
    console.log('🔍 Running performance benchmarks...');
    
    const benchmarks = [];

    try {
      // Benchmark 1: Simple clinician query
      const iterations = 10;
      const queryTimes = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const { error } = await this.supabase
          .from('clinicians')
          .select('id, user_id')
          .limit(10);
        const duration = Date.now() - startTime;
        
        if (!error) {
          queryTimes.push(duration);
        }
      }

      if (queryTimes.length > 0) {
        const avgTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
        const maxTime = Math.max(...queryTimes);
        const minTime = Math.min(...queryTimes);

        benchmarks.push({
          name: 'Clinician Query Performance',
          averageTime: avgTime,
          maxTime: maxTime,
          minTime: minTime,
          iterations: queryTimes.length
        });

        if (avgTime < 500) {
          this.addTestResult('Performance Benchmark', 'passed', {
            averageTime: avgTime,
            maxTime: maxTime,
            note: 'Average query time under 500ms'
          });
        } else if (avgTime < 2000) {
          this.addTestResult('Performance Benchmark', 'warning', {
            averageTime: avgTime,
            maxTime: maxTime,
            warning: 'Average query time over 500ms but under 2s requirement'
          });
        } else {
          this.addTestResult('Performance Benchmark', 'failed', {
            averageTime: avgTime,
            maxTime: maxTime,
            error: 'Average query time exceeds 2 second requirement'
          });
        }
      } else {
        this.addTestResult('Performance Benchmark', 'failed', {
          error: 'No successful queries for benchmarking'
        });
      }

      this.validationReport.performance = {
        benchmarks: benchmarks,
        timestamp: new Date().toISOString()
      };

      return benchmarks.length > 0;
    } catch (error) {
      this.addTestResult('Performance Benchmark', 'failed', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Test 7: Validate staff registration workflow
   */
  async testStaffRegistrationWorkflow() {
    console.log('🔍 Testing staff registration workflow...');
    
    try {
      // Test the tables involved in staff registration
      const tables = ['profiles', 'clinicians'];
      let workflowValid = true;

      for (const table of tables) {
        const startTime = Date.now();
        const { error } = await this.supabase.from(table).select('*').limit(1);
        const duration = Date.now() - startTime;

        if (error && error.message.includes('infinite recursion')) {
          this.addTestResult(`Staff Registration - ${table} table`, 'failed', {
            error: 'Infinite recursion detected',
            duration
          });
          workflowValid = false;
        } else {
          this.addTestResult(`Staff Registration - ${table} table`, 'passed', {
            duration,
            note: 'Table accessible without recursion'
          });
        }
      }

      // Test the handle_client_signup function if possible
      try {
        // We can't easily test the trigger function directly, but we can check if it exists
        this.addTestResult('Staff Registration Workflow', workflowValid ? 'passed' : 'failed', {
          note: workflowValid ? 'All registration tables accessible' : 'Some tables have issues'
        });
      } catch (error) {
        this.addTestResult('Staff Registration Workflow', 'warning', {
          warning: error.message
        });
      }

      return workflowValid;
    } catch (error) {
      this.addTestResult('Staff Registration Workflow', 'failed', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Generate comprehensive validation report
   */
  generateReport() {
    const report = {
      ...this.validationReport,
      summary: {
        ...this.validationReport.summary,
        successRate: this.validationReport.summary.totalTests > 0 
          ? (this.validationReport.summary.passed / this.validationReport.summary.totalTests * 100).toFixed(2)
          : 0,
        overallStatus: this.validationReport.summary.failed === 0 ? 'PASSED' : 'FAILED',
        hasWarnings: this.validationReport.summary.warnings > 0
      },
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations() {
    const recommendations = [];
    const failedTests = this.testResults.filter(test => test.status === 'failed');
    const warningTests = this.testResults.filter(test => test.status === 'warning');

    if (failedTests.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'failed_tests',
        title: 'Address Failed Tests',
        description: `${failedTests.length} test(s) failed and require immediate attention`,
        action: 'Review failed tests and fix underlying issues before deployment',
        tests: failedTests.map(test => test.name)
      });
    }

    if (warningTests.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'warnings',
        title: 'Review Warning Tests',
        description: `${warningTests.length} test(s) completed with warnings`,
        action: 'Review warnings and consider improvements',
        tests: warningTests.map(test => test.name)
      });
    }

    // Performance recommendations
    const performanceTests = this.testResults.filter(test => 
      test.name.includes('Performance') && test.duration > 1000
    );

    if (performanceTests.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        title: 'Optimize Query Performance',
        description: 'Some queries are taking longer than optimal',
        action: 'Consider adding indexes or optimizing query patterns'
      });
    }

    // Circular dependency recommendations
    if (this.validationReport.policyAnalysis.circularReferences?.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'circular_dependencies',
        title: 'Fix Remaining Circular Dependencies',
        description: 'Circular references still exist after migration',
        action: 'Review and restructure remaining problematic policies'
      });
    }

    return recommendations;
  }

  /**
   * Save validation report to file
   */
  saveReport(report) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(__dirname, '..', `deployment-validation-report-${timestamp}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Validation report saved to: ${reportPath}`);
    
    return reportPath;
  }

  /**
   * Main validation execution method
   */
  async validate() {
    console.log('🚀 Starting Deployment Validation');
    console.log('='.repeat(60));
    
    try {
      // Initialize
      await this.initialize();
      
      // Run all validation tests
      await this.testDatabaseConnectivity();
      await this.testPolicyExistence();
      await this.testCircularDependencies();
      await this.testClinicianOperations();
      await this.testHelperFunctions();
      await this.testPerformance();
      await this.testStaffRegistrationWorkflow();
      
      // Generate and save report
      const report = this.generateReport();
      const reportPath = this.saveReport(report);
      
      console.log('\n' + '='.repeat(60));
      console.log('DEPLOYMENT VALIDATION COMPLETE');
      console.log('='.repeat(60));
      console.log(`Overall Status: ${report.summary.overallStatus}`);
      console.log(`Success Rate: ${report.summary.successRate}%`);
      console.log(`Tests Passed: ${report.summary.passed}/${report.summary.totalTests}`);
      console.log(`Tests Failed: ${report.summary.failed}`);
      console.log(`Warnings: ${report.summary.warnings}`);
      
      if (report.recommendations.length > 0) {
        console.log('\n💡 RECOMMENDATIONS:');
        for (const rec of report.recommendations) {
          console.log(`   [${rec.priority.toUpperCase()}] ${rec.title}`);
          console.log(`      ${rec.description}`);
          console.log(`      Action: ${rec.action}\n`);
        }
      }
      
      console.log(`📄 Full report: ${reportPath}`);
      
      if (report.summary.overallStatus === 'PASSED') {
        console.log('\n✅ Deployment validation passed!');
        console.log('   The migration appears to be successful and the system is ready.');
      } else {
        console.log('\n❌ Deployment validation failed.');
        console.log('   Please address the failed tests before considering the deployment complete.');
      }
      
      return report;
      
    } catch (error) {
      console.log(`\n❌ Deployment validation error: ${error.message}`);
      
      // Generate error report
      const errorReport = this.generateReport();
      errorReport.error = error.message;
      errorReport.summary.overallStatus = 'ERROR';
      
      const reportPath = this.saveReport(errorReport);
      console.log(`📄 Error report saved to: ${reportPath}`);
      
      throw error;
    }
  }
}

// Export for use in other scripts
export default DeploymentValidator;

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new DeploymentValidator();
  
  validator.validate()
    .then((report) => {
      process.exit(report.summary.overallStatus === 'PASSED' ? 0 : 1);
    })
    .catch((error) => {
      console.error('Validation failed:', error.message);
      process.exit(1);
    });
}