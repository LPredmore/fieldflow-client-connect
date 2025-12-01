# Unified Authentication System Testing Guide

## Quick Start

### Run All Authentication Tests

```bash
npm test src/test/unifiedAuthSystem.test.tsx
```

### Run Specific Test Suite

```bash
# Authentication flow tests
npm test src/test/unifiedAuthSystem.test.tsx -t "Authentication Flow"

# Error scenario tests
npm test src/test/unifiedAuthSystem.test.tsx -t "Error Scenarios"

# Circuit breaker tests
npm test src/test/unifiedAuthSystem.test.tsx -t "Circuit Breaker"

# Performance tests
npm test src/test/unifiedAuthSystem.test.tsx -t "Performance"
```

## Test Suites Overview

### 1. Authentication Flow Tests (8.1)

Tests the complete authentication flow for each user type:
- Clinical staff → `/staff/registration`
- Non-clinical staff → `/staff/dashboard`
- Client users → `/client/dashboard`

**What's Tested:**
- User authentication
- Role detection
- Routing decisions
- Query deduplication

### 2. Error Scenario Tests (8.2)

Tests error handling and recovery:
- Network errors
- Invalid credentials
- Missing database records
- Circuit breaker activation

**What's Tested:**
- Graceful error handling
- Error messages
- System resilience
- Fallback behavior

### 3. Circuit Breaker Tests (8.3)

Tests circuit breaker protection:
- Failure threshold detection
- Circuit breaker state transitions
- Manual reset functionality
- Recovery UI display

**What's Tested:**
- Failure counting
- State management
- Reset mechanism
- UI integration

### 4. Redirect Loop Prevention (8.4)

Tests redirect safety mechanisms:
- Redirect tracking
- Loop detection
- Rate limiting

**What's Tested:**
- Redirect history
- Loop prevention
- System stability

### 5. Session Persistence Tests (8.5)

Tests session management:
- Session restoration
- Cache persistence
- Logout cleanup

**What's Tested:**
- Session storage
- Cache management
- Data persistence

### 6. Access Control Tests (8.6)

Tests portal access restrictions:
- Cross-portal blocking
- Role-based access
- Unauthorized access handling

**What's Tested:**
- Route protection
- Access enforcement
- Redirect behavior

### 7. Performance Tests (8.7)

Tests system performance:
- Authentication speed
- Query optimization
- Deduplication effectiveness

**What's Tested:**
- Load times
- Query counts
- Performance metrics

## Mock Data Reference

### Client User
```typescript
{
  id: 'client-user-id',
  email: 'client@example.com',
  role: 'client'
}
```

### Clinical Staff User
```typescript
{
  id: 'clinical-staff-id',
  email: 'clinical@example.com',
  role: 'staff',
  is_clinician: true
}
```

### Non-Clinical Staff User
```typescript
{
  id: 'non-clinical-staff-id',
  email: 'staff@example.com',
  role: 'staff',
  is_clinician: false
}
```

## Debugging Tests

### Enable Verbose Logging

```bash
DEBUG=* npm test src/test/unifiedAuthSystem.test.tsx
```

### Run Single Test

```bash
npm test src/test/unifiedAuthSystem.test.tsx -t "should authenticate clinical staff"
```

### Watch Mode

```bash
npm run test:watch src/test/unifiedAuthSystem.test.tsx
```

## Common Issues

### Issue: Tests Timeout

**Solution**: Increase timeout in test configuration
```typescript
await waitFor(() => {
  expect(screen.getByText('Dashboard')).toBeInTheDocument();
}, { timeout: 5000 });
```

### Issue: Mock Not Working

**Solution**: Verify mock is set up before test runs
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  // Set up mocks here
});
```

### Issue: Async State Updates

**Solution**: Use `waitFor` for async assertions
```typescript
await waitFor(() => {
  expect(someAsyncValue).toBe(expectedValue);
});
```

## Manual Testing Checklist

Some scenarios require manual verification:

- [ ] Login as clinical staff in browser
- [ ] Verify redirect to `/staff/registration`
- [ ] Check network tab for duplicate queries
- [ ] Login as non-clinical staff
- [ ] Verify redirect to `/staff/dashboard`
- [ ] Login as client user
- [ ] Verify redirect to `/client/dashboard`
- [ ] Test with network throttling (3G)
- [ ] Verify performance < 2 seconds
- [ ] Test circuit breaker recovery UI
- [ ] Verify session persists on refresh
- [ ] Test logout clears all data

## Performance Benchmarks

Expected performance metrics:
- **Authentication Flow**: < 2 seconds
- **Database Queries**: ≤ 1 per table
- **Cache Hit Rate**: > 90% on subsequent requests
- **Memory Usage**: < 50MB for auth state

## Test Coverage Goals

- **Line Coverage**: > 80%
- **Branch Coverage**: > 75%
- **Function Coverage**: > 85%
- **Statement Coverage**: > 80%

## Contributing

When adding new tests:
1. Follow existing test structure
2. Use descriptive test names
3. Add comments for complex scenarios
4. Update this README with new test info
5. Ensure tests are deterministic

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
