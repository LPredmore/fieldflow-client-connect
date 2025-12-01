# RLS Policy Testing Framework

This directory contains comprehensive testing utilities for Row Level Security (RLS) policies to prevent infinite recursion and validate user access control.

## Overview

The RLS Policy Testing Framework provides:

1. **Policy Test Utilities** - Helper functions to test policy behavior in isolation
2. **User Access Control Validation** - Test cases to ensure proper user isolation
3. **Performance Benchmarks** - Tools to measure policy evaluation performance
4. **Circular Dependency Detection** - Automated detection of infinite recursion issues

## Files

### Core Utilities

- **`rlsPolicyTestUtils.ts`** - Core testing utilities and helper functions
- **`rlsPolicyTests.test.ts`** - Comprehensive test suite for RLS policies
- **`policyPerformanceRunner.ts`** - Performance benchmark runner and reporting
- **`runPolicyTests.ts`** - Command-line interface for running policy tests

### Test Scripts

- **`npm run test:policies`** - Run all policy tests (comprehensive + performance)
- **`npm run test:policies:performance`** - Run only performance benchmarks
- **`npm run test:policies:comprehensive`** - Run only comprehensive policy tests

## Quick Start

### 1. Run All Policy Tests

```bash
npm run test:policies
```

This runs both comprehensive policy tests and performance benchmarks.

### 2. Run Performance Benchmarks Only

```bash
npm run test:policies:performance
```

### 3. Run Comprehensive Tests Only

```bash
npm run test:policies:comprehensive
```

### 4. Run Tests with Custom Options

```bash
# Run performance tests with 20 iterations
npm run test:policies -- --performance --iterations=20

# Test specific tables only
npm run test:policies -- --tables=clinicians,profiles

# Save results to file
npm run test:policies -- --save
```

## Test Categories

### 1. Circular Dependency Detection

Tests for infinite recursion in RLS policies:

```typescript
const result = await detectCircularDependencies(client, 'clinicians');
if (result.hasCircularDependency) {
  console.log('Circular dependency detected:', result.error);
}
```

### 2. User Access Control Validation

Ensures users can only access their own data:

```typescript
const testCases: UserAccessTestCase[] = [
  {
    description: 'User should access their own clinician record',
    userId: 'user-1',
    tenantId: 'tenant-1',
    expectedAccess: true,
    tableName: 'clinicians',
    operation: 'SELECT'
  }
];

const results = await runUserAccessTests(config, testCases);
```

### 3. Performance Benchmarking

Measures policy evaluation performance:

```typescript
const benchmark = await benchmarkPolicyPerformance(
  config,
  'clinicians',
  'SELECT',
  10 // iterations
);

console.log(`Average execution time: ${benchmark.averageExecutionTime}ms`);
console.log(`Success rate: ${benchmark.successRate}%`);
```

### 4. User Isolation Validation

Verifies that users cannot access each other's data:

```typescript
const result = await validateUserIsolation(
  config,
  'clinicians',
  'user-1',
  'user-2',
  'tenant-1'
);

if (!result.isolated) {
  console.log('User isolation failed:', result.error);
}
```

## Configuration

### Environment Variables

Set these environment variables for testing:

```bash
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
TEST_USER_ID=test-user-id
TEST_TENANT_ID=test-tenant-id
```

### Test Configuration

```typescript
const config: PolicyTestConfig = {
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseKey: 'your-anon-key',
  testUserId: 'test-user-id',
  testTenantId: 'test-tenant-id'
};
```

## Performance Thresholds

Default performance thresholds:

- **Maximum Average Execution Time**: 2000ms (2 seconds)
- **Minimum Success Rate**: 95%
- **Maximum Single Execution Time**: 5000ms (5 seconds)

## Health Status

The framework reports overall health status:

- **HEALTHY** - All tests pass, performance within thresholds
- **WARNING** - Performance issues detected, but no critical failures
- **CRITICAL** - Circular dependencies or user isolation failures detected

## Common Issues and Solutions

### 1. Infinite Recursion Detected

**Problem**: `infinite recursion detected in policy for relation 'clinicians'`

**Solution**: 
- Simplify RLS policies to use direct `auth.uid()` comparisons
- Remove circular references between table policies
- Check policy dependency mapping

### 2. Poor Performance

**Problem**: Policy evaluation takes longer than 2 seconds

**Solution**:
- Add indexes on `user_id` and `tenant_id` columns
- Optimize policy logic to reduce complexity
- Use direct authentication checks instead of subqueries

### 3. User Isolation Failures

**Problem**: Users can access each other's data

**Solution**:
- Verify RLS policies include proper user filtering
- Check that `auth.uid()` is correctly used in policies
- Ensure tenant isolation is properly implemented

## Integration with CI/CD

Add policy tests to your CI/CD pipeline:

```yaml
# .github/workflows/test.yml
- name: Run RLS Policy Tests
  run: npm run test:policies
  
- name: Check Policy Performance
  run: npm run test:policies:performance
```

The tests will exit with error code 1 if critical issues are detected.

## Monitoring and Alerting

Use the performance runner for continuous monitoring:

```typescript
import { runPerformanceBenchmarks } from './policyPerformanceRunner';

// Run daily performance checks
const report = await runPerformanceBenchmarks(config);

if (report.overallHealth === 'CRITICAL') {
  // Send alert to monitoring system
  sendAlert('RLS Policy Critical Issues Detected', report);
}
```

## Requirements Mapping

This testing framework addresses the following requirements:

- **Requirement 2.1**: RLS policies SHALL NOT create circular references or infinite loops
- **Requirement 2.2**: Policies SHALL allow access without recursion and avoid dependency cycles
- **Requirement 3.1**: System SHALL log specific policy and table information for errors
- **Requirement 3.2**: System SHALL provide clear error messages for infinite recursion
- **Requirement 3.3**: System SHALL fail gracefully with actionable error information

## Best Practices

1. **Run tests regularly** - Include in CI/CD pipeline and run before deployments
2. **Monitor performance** - Set up automated performance monitoring
3. **Test edge cases** - Include tests for boundary conditions and error scenarios
4. **Document policy changes** - Update tests when RLS policies are modified
5. **Use realistic test data** - Test with data that resembles production scenarios

## Troubleshooting

### Test Failures

If tests fail, check:

1. **Database connectivity** - Ensure Supabase connection is working
2. **Authentication** - Verify test user credentials are valid
3. **Policy syntax** - Check RLS policies for syntax errors
4. **Indexes** - Ensure required database indexes exist

### Performance Issues

If performance tests fail:

1. **Check database load** - High database load can affect test results
2. **Review policy complexity** - Complex policies may need optimization
3. **Verify indexes** - Missing indexes can cause slow policy evaluation
4. **Check network latency** - Network issues can affect test timing

For additional help, refer to the design document at `.kiro/specs/clinicians-infinite-recursion-fix/design.md`.