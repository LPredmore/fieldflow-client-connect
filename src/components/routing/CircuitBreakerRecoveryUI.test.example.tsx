/**
 * Example usage and manual testing guide for CircuitBreakerRecoveryUI
 * 
 * This file demonstrates how to use the component and provides
 * a manual testing checklist.
 */

import { CircuitBreakerRecoveryUI } from './CircuitBreakerRecoveryUI';
import { CircuitBreakerStatus } from '@/services/auth/CircuitBreakerRecoveryService';

/**
 * Example 1: Circuit breaker open with countdown
 */
export function ExampleOpenWithCountdown() {
  const status: CircuitBreakerStatus = {
    state: 'open',
    failureCount: 3,
    lastFailureTime: Date.now() - 10000, // 10 seconds ago
    lastSuccessTime: Date.now() - 60000, // 1 minute ago
    nextRetryTime: Date.now() + 20000 // 20 seconds from now
  };

  const handleReset = async () => {
    console.log('Reset triggered');
    // Simulate reset delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Reset complete');
  };

  return (
    <CircuitBreakerRecoveryUI
      status={status}
      onReset={handleReset}
    />
  );
}

/**
 * Example 2: Circuit breaker open with error
 */
export function ExampleOpenWithError() {
  const status: CircuitBreakerStatus = {
    state: 'open',
    failureCount: 5,
    lastFailureTime: Date.now() - 5000,
    lastSuccessTime: null,
    nextRetryTime: Date.now() + 25000
  };

  const error = new Error('Network connection failed');

  const handleReset = async () => {
    throw new Error('Reset failed - network still unavailable');
  };

  return (
    <CircuitBreakerRecoveryUI
      status={status}
      onReset={handleReset}
      error={error}
    />
  );
}

/**
 * Example 3: Circuit breaker in half-open state
 */
export function ExampleHalfOpen() {
  const status: CircuitBreakerStatus = {
    state: 'half-open',
    failureCount: 3,
    lastFailureTime: Date.now() - 30000,
    lastSuccessTime: null,
    nextRetryTime: null
  };

  const handleReset = async () => {
    console.log('Testing connection...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('Connection test complete');
  };

  return (
    <CircuitBreakerRecoveryUI
      status={status}
      onReset={handleReset}
    />
  );
}

/**
 * Manual Testing Checklist
 * 
 * Test Case 1: Initial Display
 * - [ ] Component renders with correct title "System Protection Mode"
 * - [ ] Error message is clear and user-friendly
 * - [ ] Status information shows failure count
 * - [ ] Countdown timer displays correctly
 * - [ ] "Reset and Retry" button is visible and enabled
 * 
 * Test Case 2: Reset Button Click
 * - [ ] Button shows loading state when clicked
 * - [ ] Button text changes to "Resetting..."
 * - [ ] Spinner icon animates
 * - [ ] Button is disabled during reset
 * - [ ] Success message appears after successful reset
 * - [ ] Success message auto-hides after 3 seconds
 * 
 * Test Case 3: Failed Reset
 * - [ ] Error alert appears with failure message
 * - [ ] Reset attempt counter increments
 * - [ ] Button re-enables after failure
 * - [ ] User can retry after failure
 * 
 * Test Case 4: Multiple Failed Resets
 * - [ ] After 2 failed attempts, support link appears
 * - [ ] Support link opens email client
 * - [ ] Email has pre-filled subject
 * 
 * Test Case 5: Countdown Timer
 * - [ ] Timer shows seconds when < 60 seconds
 * - [ ] Timer shows minutes when >= 60 seconds
 * - [ ] Timer updates in real-time
 * - [ ] Shows "Ready to retry" when time expires
 * 
 * Test Case 6: Different States
 * - [ ] Open state shows countdown
 * - [ ] Half-open state shows "Testing connection..."
 * - [ ] Closed state (component should not be visible)
 * 
 * Test Case 7: Development Mode
 * - [ ] Technical details section appears in dev mode
 * - [ ] Details show full status object
 * - [ ] Error details are formatted correctly
 * - [ ] Timestamps are in ISO format
 * 
 * Test Case 8: Accessibility
 * - [ ] Can navigate with keyboard (Tab key)
 * - [ ] Can activate button with Enter/Space
 * - [ ] Focus indicators are visible
 * - [ ] Color contrast is sufficient
 * 
 * Test Case 9: Responsive Design
 * - [ ] Layout works on mobile screens
 * - [ ] Layout works on tablet screens
 * - [ ] Layout works on desktop screens
 * - [ ] Text is readable at all sizes
 * 
 * Test Case 10: Integration
 * - [ ] Component receives status updates
 * - [ ] onReset callback is called correctly
 * - [ ] Component unmounts when circuit breaker closes
 * - [ ] No memory leaks or console errors
 */

/**
 * How to trigger circuit breaker for testing:
 * 
 * 1. In browser console:
 *    ```javascript
 *    // Simulate failures
 *    for (let i = 0; i < 3; i++) {
 *      window.circuitBreakerRecoveryService.recordFailure(new Error('Test failure'));
 *    }
 *    ```
 * 
 * 2. Or modify CircuitBreakerRecoveryService config:
 *    ```javascript
 *    window.circuitBreakerRecoveryService.updateConfig({
 *      failureThreshold: 1, // Open after 1 failure
 *      resetTimeout: 10000  // 10 seconds
 *    });
 *    ```
 * 
 * 3. Then cause an authentication failure:
 *    - Try to login with invalid credentials
 *    - Or disconnect network and try to login
 */
