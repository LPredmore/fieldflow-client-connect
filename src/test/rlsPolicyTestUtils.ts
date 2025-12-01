/**
 * RLS Policy Test Utilities
 * 
 * Helper functions to test Row Level Security (RLS) policy behavior in isolation,
 * validate user access control, and benchmark policy evaluation performance.
 * 
 * Requirements: 2.1, 2.2, 3.1
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';

export interface PolicyTestConfig {
  supabaseUrl: string;
  supabaseKey: string;
  testUserId?: string;
  testTenantId?: string;
}

export interface PolicyTestResult {
  success: boolean;
  error?: string;
  executionTime: number;
  rowsReturned?: number;
  data?: any[];
}

export interface UserAccessTestCase {
  description: string;
  userId: string;
  tenantId: string;
  expectedAccess: boolean;
  tableName: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  testData?: any;
}

export interface PolicyPerformanceBenchmark {
  tableName: string;
  operation: string;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  totalExecutions: number;
  successRate: number;
}

/**
 * Creates a test Supabase client with specific user authentication
 */
export function createTestClient(config: PolicyTestConfig, userToken?: string): SupabaseClient<Database> {
  const client = createClient<Database>(config.supabaseUrl, config.supabaseKey, {
    auth: {
      storage: {
        getItem: (key: string) => userToken || null,
        setItem: (key: string, value: string) => {},
        removeItem: (key: string) => {},
      },
      persistSession: false,
      autoRefreshToken: false,
    }
  });

  return client;
}

/**
 * Generates a mock JWT token for testing purposes
 */
export function generateMockJWT(userId: string, tenantId?: string): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    sub: userId,
    aud: 'authenticated',
    role: 'authenticated',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...(tenantId && { tenant_id: tenantId })
  };

  // This is a mock implementation - in real tests, you'd use a proper JWT library
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  
  return `${encodedHeader}.${encodedPayload}.mock-signature`;
}

/**
 * Tests RLS policy behavior for a specific table and operation
 */
export async function testPolicyBehavior(
  client: SupabaseClient<Database>,
  tableName: string,
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
  testData?: any
): Promise<PolicyTestResult> {
  const startTime = performance.now();
  
  try {
    let result;
    
    switch (operation) {
      case 'SELECT':
        result = await client.from(tableName as any).select('*').limit(10);
        break;
      case 'INSERT':
        if (!testData) {
          throw new Error('Test data required for INSERT operation');
        }
        result = await client.from(tableName as any).insert(testData).select();
        break;
      case 'UPDATE':
        if (!testData) {
          throw new Error('Test data required for UPDATE operation');
        }
        result = await client.from(tableName as any).update(testData).eq('id', testData.id).select();
        break;
      case 'DELETE':
        if (!testData?.id) {
          throw new Error('Test data with ID required for DELETE operation');
        }
        result = await client.from(tableName as any).delete().eq('id', testData.id);
        break;
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }

    const endTime = performance.now();
    const executionTime = endTime - startTime;

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
        executionTime
      };
    }

    return {
      success: true,
      executionTime,
      rowsReturned: Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0,
      data: result.data
    };

  } catch (error) {
    const endTime = performance.now();
    const executionTime = endTime - startTime;

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime
    };
  }
}

/**
 * Tests user access control validation for multiple scenarios
 */
export async function runUserAccessTests(
  config: PolicyTestConfig,
  testCases: UserAccessTestCase[]
): Promise<{ testCase: UserAccessTestCase; result: PolicyTestResult }[]> {
  const results: { testCase: UserAccessTestCase; result: PolicyTestResult }[] = [];

  for (const testCase of testCases) {
    const userToken = generateMockJWT(testCase.userId, testCase.tenantId);
    const client = createTestClient(config, userToken);

    const result = await testPolicyBehavior(
      client,
      testCase.tableName,
      testCase.operation,
      testCase.testData
    );

    // Validate that the result matches expected access
    const accessGranted = result.success;
    const accessExpected = testCase.expectedAccess;

    if (accessGranted !== accessExpected) {
      result.success = false;
      result.error = `Access control validation failed. Expected ${accessExpected ? 'access granted' : 'access denied'}, got ${accessGranted ? 'access granted' : 'access denied'}`;
    }

    results.push({ testCase, result });
  }

  return results;
}

/**
 * Runs performance benchmarks for policy evaluation
 */
export async function benchmarkPolicyPerformance(
  config: PolicyTestConfig,
  tableName: string,
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
  iterations: number = 10,
  testData?: any
): Promise<PolicyPerformanceBenchmark> {
  const executionTimes: number[] = [];
  let successCount = 0;

  const userToken = generateMockJWT(config.testUserId || 'test-user-id', config.testTenantId);
  const client = createTestClient(config, userToken);

  for (let i = 0; i < iterations; i++) {
    const result = await testPolicyBehavior(client, tableName, operation, testData);
    
    executionTimes.push(result.executionTime);
    if (result.success) {
      successCount++;
    }

    // Add small delay between iterations to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const averageExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
  const minExecutionTime = Math.min(...executionTimes);
  const maxExecutionTime = Math.max(...executionTimes);
  const successRate = (successCount / iterations) * 100;

  return {
    tableName,
    operation,
    averageExecutionTime,
    minExecutionTime,
    maxExecutionTime,
    totalExecutions: iterations,
    successRate
  };
}

/**
 * Tests for circular dependency detection in RLS policies
 */
export async function detectCircularDependencies(
  client: SupabaseClient<Database>,
  tableName: string
): Promise<{ hasCircularDependency: boolean; error?: string; executionTime: number }> {
  const startTime = performance.now();

  try {
    // Attempt a simple select query with a timeout to detect infinite recursion
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout - possible infinite recursion')), 5000);
    });

    const queryPromise = client.from(tableName as any).select('*').limit(1);

    const result = await Promise.race([queryPromise, timeoutPromise]);
    const endTime = performance.now();

    return {
      hasCircularDependency: false,
      executionTime: endTime - startTime
    };

  } catch (error) {
    const endTime = performance.now();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    const hasCircularDependency = 
      errorMessage.includes('infinite recursion') ||
      errorMessage.includes('Query timeout') ||
      errorMessage.includes('circular dependency');

    return {
      hasCircularDependency,
      error: errorMessage,
      executionTime: endTime - startTime
    };
  }
}

/**
 * Validates that policies maintain proper security isolation between users
 */
export async function validateUserIsolation(
  config: PolicyTestConfig,
  tableName: string,
  user1Id: string,
  user2Id: string,
  tenantId: string
): Promise<{ isolated: boolean; error?: string }> {
  try {
    // Create test data for user1
    const user1Token = generateMockJWT(user1Id, tenantId);
    const user1Client = createTestClient(config, user1Token);

    // Create test data for user2
    const user2Token = generateMockJWT(user2Id, tenantId);
    const user2Client = createTestClient(config, user2Token);

    // Test that user1 can only see their own data
    const user1Result = await user1Client.from(tableName as any).select('*');
    
    // Test that user2 can only see their own data
    const user2Result = await user2Client.from(tableName as any).select('*');

    if (user1Result.error || user2Result.error) {
      return {
        isolated: false,
        error: `Query error: ${user1Result.error?.message || user2Result.error?.message}`
      };
    }

    // Check that users don't see each other's data
    const user1Data = user1Result.data || [];
    const user2Data = user2Result.data || [];

    // Verify user1 data doesn't contain user2's records
    const user1HasUser2Data = user1Data.some((record: any) => 
      record.user_id === user2Id || record.created_by_user_id === user2Id
    );

    // Verify user2 data doesn't contain user1's records
    const user2HasUser1Data = user2Data.some((record: any) => 
      record.user_id === user1Id || record.created_by_user_id === user1Id
    );

    if (user1HasUser2Data || user2HasUser1Data) {
      return {
        isolated: false,
        error: 'Users can access each other\'s data - isolation failed'
      };
    }

    return { isolated: true };

  } catch (error) {
    return {
      isolated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Comprehensive policy test suite runner
 */
export async function runComprehensivePolicyTests(
  config: PolicyTestConfig,
  tablesToTest: string[] = ['clinicians', 'profiles', 'user_permissions']
): Promise<{
  circularDependencyTests: { table: string; result: any }[];
  userIsolationTests: { table: string; result: any }[];
  performanceBenchmarks: PolicyPerformanceBenchmark[];
  overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}> {
  const circularDependencyTests = [];
  const userIsolationTests = [];
  const performanceBenchmarks = [];

  const client = createTestClient(config);

  for (const table of tablesToTest) {
    // Test for circular dependencies
    const circularTest = await detectCircularDependencies(client, table);
    circularDependencyTests.push({ table, result: circularTest });

    // Test user isolation
    const isolationTest = await validateUserIsolation(
      config,
      table,
      'user1-test-id',
      'user2-test-id',
      config.testTenantId || 'test-tenant-id'
    );
    userIsolationTests.push({ table, result: isolationTest });

    // Performance benchmark
    const benchmark = await benchmarkPolicyPerformance(config, table, 'SELECT', 5);
    performanceBenchmarks.push(benchmark);
  }

  // Determine overall health
  const hasCircularDependencies = circularDependencyTests.some(test => test.result.hasCircularDependency);
  const hasIsolationIssues = userIsolationTests.some(test => !test.result.isolated);
  const hasPerformanceIssues = performanceBenchmarks.some(benchmark => 
    benchmark.averageExecutionTime > 2000 || benchmark.successRate < 90
  );

  let overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  
  if (hasCircularDependencies || hasIsolationIssues) {
    overallHealth = 'CRITICAL';
  } else if (hasPerformanceIssues) {
    overallHealth = 'WARNING';
  }

  return {
    circularDependencyTests,
    userIsolationTests,
    performanceBenchmarks,
    overallHealth
  };
}