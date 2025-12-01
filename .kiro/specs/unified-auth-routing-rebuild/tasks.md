# Implementation Plan

- [x] 1. Create core services and utilities





  - Build foundational services that will power the unified authentication system
  - _Requirements: 1.1, 1.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 1.1 Create QueryDeduplicator service


  - Implement QueryDeduplicator class with deduplicate(), clear(), and clearAll() methods
  - Add pending query registry using Map<string, PendingQuery>
  - Implement promise queuing for duplicate requests
  - Add automatic cleanup after query completion
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 1.2 Create SessionCacheService


  - Implement SessionCacheService with set(), get(), has(), delete(), and clear() methods
  - Add in-memory Map for fast access
  - Implement sessionStorage sync for persistence
  - Add TTL support for cache entries
  - Create cache key generation utilities
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7_


- [x] 1.3 Create RoleDetectionService

  - Implement RoleDetectionService class with detectUserRole(), getCachedRole(), and invalidateCache() methods
  - Add logic to query profiles table for user role
  - Implement conditional clinician table query for staff users
  - Implement conditional user_permissions table query for staff users
  - Build UserRoleContext object with all role attributes
  - Integrate with SessionCacheService for caching
  - Integrate with QueryDeduplicator to prevent duplicate queries
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 1.4 Create CircuitBreakerRecoveryService


  - Implement circuit breaker state management (closed, open, half-open)
  - Add failure tracking and threshold detection
  - Implement automatic half-open state testing after timeout
  - Create reset() method to manually close circuit breaker
  - Add state change event emitters
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
- [x] 2. Build AuthenticationProvider



- [ ] 2. Build AuthenticationProvider

  - Create the top-level authentication context that coordinates the unified flow
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1, 7.2, 8.1, 8.2, 8.3_

- [x] 2.1 Create AuthenticationContext and types


  - Define AuthenticationContextValue interface
  - Define User, UserProfile, StaffAttributes, and UserPermissions types
  - Create React context with default values
  - Export useAuth hook for consuming context
  - _Requirements: 1.1, 1.2_

- [x] 2.2 Implement AuthenticationProvider component


  - Create AuthenticationProvider component with state management
  - Implement login() method that authenticates with Supabase
  - Implement loadUserData() method that coordinates data fetching
  - Add integration with RoleDetectionService
  - Implement logout() method that clears all state
  - Implement resetAuth() method that resets circuit breaker and clears cache
  - Implement refreshUserData() method for manual refresh
  - Add loading and error state management
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1, 7.2, 8.1, 8.2, 8.3_

- [x] 2.3 Add Supabase auth session management


  - Listen to Supabase auth state changes
  - Handle session restoration on page load
  - Trigger loadUserData() when session is restored
  - Handle session expiration
  - _Requirements: 1.1, 8.7_

- [x] 2.4 Implement error handling and retry logic


  - Add try-catch blocks around all async operations
  - Implement exponential backoff retry for network errors
  - Create AuthError class with error types
  - Add user-friendly error messages
  - Integrate with CircuitBreakerRecoveryService
  - _Requirements: 7.3, 7.4, 7.5, 7.6_

- [x] 3. Build UnifiedRoutingGuard





  - Create the single routing decision component that replaces all competing logic
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [x] 3.1 Create UnifiedRoutingGuard component


  - Create UnifiedRoutingGuard component that wraps route content
  - Access user data from AuthenticationContext
  - Implement determineRoute() function with routing logic
  - Add redirect execution using React Router
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3.2 Implement routing logic for all user types

  - Add routing logic for client users → /client/dashboard
  - Add routing logic for clinical staff (is_clinician=true) → /staff/registration
  - Add routing logic for non-clinical staff (is_clinician=false) → /staff/dashboard
  - Add routing logic for unauthenticated users → /login
  - Add access control to prevent cross-portal access
  - _Requirements: 3.2, 3.3, 3.4, 3.8, 3.9_

- [x] 3.3 Add redirect loop prevention

  - Track redirect history with timestamps
  - Implement redirect rate limiting (max 3 per 5 seconds)
  - Add redirect cooldown period (100ms between redirects)
  - Show error page if redirect limit exceeded
  - _Requirements: 3.5, 3.6_

- [x] 3.4 Add error handling for routing failures

  - Handle missing user data gracefully
  - Show error page with clear messaging for role detection failures
  - Provide "Reset and Retry" option on error page
  - Log routing decisions for debugging
  - _Requirements: 3.7, 7.6_

- [x] 4. Create CircuitBreakerRecoveryUI component



  - Build user interface for circuit breaker recovery
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 4.1 Create CircuitBreakerRecoveryUI component


  - Create component that displays when circuit breaker is open
  - Add user-friendly error message explaining the issue
  - Add "Reset and Retry" button
  - Add loading indicator during reset
  - Show success/failure feedback after reset attempt
  - Add link to support if reset fails multiple times
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 4.2 Integrate with AuthenticationProvider


  - Connect to circuit breaker state from CircuitBreakerRecoveryService
  - Call resetAuth() when user clicks "Reset and Retry"
  - Show component when circuit breaker is open
  - Hide component when circuit breaker closes
  - _Requirements: 5.2, 5.3, 5.4_

- [x] 5. Integrate new system into application


  - Wire up the new authentication system in the app structure
  - _Requirements: 1.1, 1.5, 3.1, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 5.1 Wrap application with AuthenticationProvider


  - Import AuthenticationProvider in App.tsx or main entry point
  - Wrap entire application with AuthenticationProvider
  - Ensure provider is above all route components
  - Verify context is accessible throughout app
  - _Requirements: 1.1, 1.5_

- [x] 5.2 Replace existing routing with UnifiedRoutingGuard


  - Identify current routing structure
  - Wrap protected routes with UnifiedRoutingGuard
  - Remove old route guards and protection logic
  - Test routing for all user types
  - _Requirements: 3.1, 6.3, 6.4_

- [x] 5.3 Update components to use new auth context


  - Find all components that check user roles or permissions
  - Replace with useAuth() hook from AuthenticationContext
  - Remove direct Supabase queries for user data
  - Remove local role detection logic
  - _Requirements: 6.5, 6.6, 6.7_

- [-] 6. Audit and remove competing authentication logic


  - Systematically identify and remove all old authentication flows
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 6.1 Identify all existing authentication flows


  - Search codebase for Supabase auth.signIn calls
  - Search for components that fetch user data on mount
  - Search for role detection logic in components
  - Document all locations in a checklist
  - _Requirements: 6.1, 6.2_


- [x] 6.2 Identify all existing routing logic

  - Search for useNavigate and Navigate components with role checks
  - Search for route guards and protection components
  - Search for redirect logic based on user roles
  - Document all locations in a checklist
  - _Requirements: 6.3, 6.4_

- [x] 6.3 Remove or disable old authentication flows


  - Comment out old authentication logic (don't delete yet)
  - Add comments explaining why code is disabled
  - Ensure no old flows can execute
  - Test that only new unified flow runs
  - _Requirements: 6.2, 6.5_

- [ ] 6.4 Remove old routing and role detection logic
  - Delete old route guard components
  - Remove role detection logic from individual components
  - Delete duplicate routing decision code
  - Clean up unused imports
  - _Requirements: 6.4, 6.5, 6.6_

- [ ] 6.5 Remove direct database queries for auth data
  - Find all direct queries to profiles table for auth
  - Find all direct queries to clinicians table for role detection
  - Find all direct queries to user_permissions table
  - Replace with useAuth() hook or remove if redundant
  - _Requirements: 6.7_

- [x] 7. Add monitoring and debugging tools




  - Implement logging and monitoring for the authentication flow
  - _Requirements: 7.5, 7.6_

- [x] 7.1 Add authentication flow logging


  - Log each step of authentication flow with timestamps
  - Log role detection results
  - Log routing decisions
  - Log query deduplication events
  - Log circuit breaker state changes
  - Use console.debug for development, structured logging for production
  - _Requirements: 7.5_

- [x] 7.2 Create debug panel component (development only)


  - Create collapsible debug panel showing auth state
  - Display current user, role, and permissions
  - Show cache contents
  - Show circuit breaker state
  - Add buttons to manually trigger actions (refresh, reset, clear cache)
  - Only render in development environment
  - _Requirements: 7.5, 7.6_

- [x] 8. Testing and validation



  - Comprehensive testing of the new unified system
  - _Requirements: All requirements_


- [x] 8.1 Test authentication flow for each user type

  - Test login as clinical staff user (is_clinician=true)
  - Verify redirect to /staff/registration
  - Test login as non-clinical staff user (is_clinician=false)
  - Verify redirect to /staff/dashboard
  - Test login as client user
  - Verify redirect to /client/dashboard
  - Verify no duplicate queries in network tab
  - _Requirements: 1.1, 1.3, 2.2, 2.3, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_


- [x] 8.2 Test error scenarios
  - Test with network errors (disconnect during login)
  - Test with invalid credentials
  - Test with missing clinician record for staff user
  - Test with missing permissions record
  - Verify appropriate error messages shown
  - Verify circuit breaker opens after repeated failures
  - _Requirements: 5.1, 5.6, 5.7, 7.3, 7.4, 7.6_


- [x] 8.3 Test circuit breaker recovery
  - Trigger circuit breaker open state (simulate repeated failures)
  - Verify CircuitBreakerRecoveryUI displays
  - Click "Reset and Retry" button
  - Verify circuit breaker resets
  - Verify authentication retries successfully
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_


- [x] 8.4 Test redirect loop prevention
  - Attempt to trigger redirect loop (if possible)
  - Verify redirect rate limiting works
  - Verify error page shows after limit exceeded
  - Verify reset option works
  - _Requirements: 3.5, 3.6_

- [x] 8.5 Test session persistence

  - Login successfully
  - Refresh page
  - Verify user remains authenticated
  - Verify no duplicate queries on refresh
  - Logout
  - Verify all cached data cleared
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.7_


- [x] 8.6 Test access control
  - Login as client user
  - Attempt to access /staff/* routes
  - Verify redirect to /client/dashboard
  - Login as staff user
  - Attempt to access /client/* routes
  - Verify redirect to appropriate staff route
  - _Requirements: 3.8, 3.9_


- [x] 8.7 Performance testing

  - Measure time from login to dashboard load
  - Verify completes within 2 seconds
  - Check number of database queries (should be minimal)
  - Verify query deduplication working
  - Test with slow network (throttle to 3G)
  - _Requirements: 7.1, 7.2, 7.3, 7.7_

- [x] 9. Documentation and cleanup




  - Document the new system and clean up old code
  - _Requirements: All requirements_


- [x] 9.1 Create developer documentation

  - Document the unified authentication flow
  - Document how to use AuthenticationProvider
  - Document how to access user data in components
  - Document error handling patterns
  - Add code examples for common scenarios
  - _Requirements: All requirements_


- [x] 9.2 Delete old authentication code

  - Remove all commented-out old authentication flows
  - Delete unused components and services
  - Delete unused utility functions
  - Clean up imports throughout codebase
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_


- [x] 9.3 Update README and setup instructions

  - Update README with new authentication architecture
  - Document environment variables needed
  - Add troubleshooting section for common issues
  - Document circuit breaker recovery process
  - _Requirements: All requirements_
