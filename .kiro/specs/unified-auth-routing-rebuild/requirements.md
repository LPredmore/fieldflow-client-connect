# Requirements Document

## Introduction

This specification addresses a critical production issue where competing authentication and routing logic creates an infinite request loop, causing HTTP2 protocol errors and triggering circuit breaker protection mode. The application becomes completely inaccessible due to multiple authentication flows executing simultaneously, each attempting to determine user roles and redirect appropriately.

The system must support two distinct user types (clients and staff) with staff users having additional role attributes (is_clinician, is_admin) that determine their access and initial routing destination.

## Glossary

- **Authentication System**: The unified service responsible for verifying user identity and loading user data exactly once per session
- **Role Detection Service**: The single source of truth for determining user type (client vs staff) and staff attributes (is_clinician, is_admin)
- **Routing Guard**: The centralized component that enforces access control and performs redirects based on user roles
- **Circuit Breaker**: The protection mechanism that opens when too many failed requests occur, preventing system overload
- **Request Deduplication**: The mechanism that prevents multiple identical queries from executing simultaneously
- **User Session**: The authenticated state containing user identity, role, and permissions cached for the session duration
- **Staff User**: A user with role='staff' in profiles table, may have additional clinician record
- **Client User**: A user with role='client' in profiles table, accesses /client/* routes
- **Clinical Staff**: Staff user with is_clinician=true in clinicians table
- **Non-Clinical Staff**: Staff user with is_clinician=false in clinicians table
- **Admin Staff**: Staff user with is_admin=true in clinicians table

## Requirements

### Requirement 1: Single Authentication Flow

**User Story:** As a system administrator, I want exactly one authentication flow to execute when a user logs in, so that the system doesn't create duplicate requests and overwhelm the database.

#### Acceptance Criteria

1. WHEN a user completes authentication, THE Authentication System SHALL execute exactly one data fetching sequence
2. WHEN the Authentication System fetches user data, THE Authentication System SHALL retrieve profile, clinician record (if applicable), and permissions in a single coordinated operation
3. IF multiple components request user data simultaneously, THEN THE Authentication System SHALL deduplicate requests and return the same data to all requesters
4. WHEN user data is successfully loaded, THE Authentication System SHALL cache the data for the session duration
5. THE Authentication System SHALL NOT allow competing or parallel authentication flows to execute

### Requirement 2: Unified Role Detection

**User Story:** As a developer, I want a single service to determine user roles and attributes, so that routing decisions are consistent and don't conflict.

#### Acceptance Criteria

1. THE Role Detection Service SHALL be the single source of truth for user role determination
2. WHEN determining user type, THE Role Detection Service SHALL read the role field from the profiles table
3. WHERE the user role is 'staff', THE Role Detection Service SHALL fetch the clinicians record to determine is_clinician and is_admin attributes
4. WHERE the user role is 'client', THE Role Detection Service SHALL NOT query the clinicians table
5. THE Role Detection Service SHALL return a complete user context object containing role, is_clinician, is_admin, and permissions
6. THE Role Detection Service SHALL cache role determination results for the session duration
7. IF the clinicians record does not exist for a staff user, THEN THE Role Detection Service SHALL treat is_clinician and is_admin as false

### Requirement 3: Centralized Routing Logic

**User Story:** As a user, I want to be redirected to the correct portal immediately after login, so that I can access my appropriate dashboard without loops or errors.

#### Acceptance Criteria

1. THE Routing Guard SHALL be the only component making routing decisions based on user roles
2. WHEN a staff user with is_clinician=true logs in, THE Routing Guard SHALL redirect to /staff/registration
3. WHEN a staff user with is_clinician=false logs in, THE Routing Guard SHALL redirect to /staff/dashboard
4. WHEN a client user logs in, THE Routing Guard SHALL redirect to /client/dashboard
5. THE Routing Guard SHALL NOT create redirect loops
6. THE Routing Guard SHALL complete all redirects within 2 seconds of authentication
7. IF role detection fails, THEN THE Routing Guard SHALL redirect to an error page with clear messaging
8. THE Routing Guard SHALL prevent access to /staff/* routes for client users
9. THE Routing Guard SHALL prevent access to /client/* routes for staff users

### Requirement 4: Request Deduplication

**User Story:** As a system operator, I want duplicate database queries to be prevented, so that the system doesn't overwhelm the database connection pool.

#### Acceptance Criteria

1. WHEN multiple components request the same data simultaneously, THE Authentication System SHALL execute only one database query
2. THE Authentication System SHALL queue duplicate requests and resolve them with the same result
3. WHEN a query is in flight, THE Authentication System SHALL track it by a unique key combining table name and filter parameters
4. THE Authentication System SHALL maintain an in-memory registry of pending queries
5. WHEN a query completes, THE Authentication System SHALL resolve all queued duplicate requests with the same data
6. THE Authentication System SHALL clear completed queries from the registry within 100 milliseconds

### Requirement 5: Circuit Breaker Recovery

**User Story:** As a user experiencing the protection mode error, I want the system to automatically recover when the issue is resolved, so that I can access the application without manual intervention.

#### Acceptance Criteria

1. WHEN the circuit breaker opens due to excessive failures, THE Authentication System SHALL display a user-friendly error message
2. THE Authentication System SHALL provide a manual "Reset and Retry" button in the error state
3. WHEN the user clicks "Reset and Retry", THE Authentication System SHALL reset the circuit breaker state
4. THE Authentication System SHALL clear all cached authentication state on reset
5. THE Authentication System SHALL attempt to re-authenticate the user after reset
6. WHERE the circuit breaker is open for more than 30 seconds, THE Authentication System SHALL automatically attempt a half-open state test
7. IF the half-open test succeeds, THEN THE Authentication System SHALL close the circuit breaker and resume normal operation

### Requirement 6: Competing Logic Removal

**User Story:** As a developer, I want all competing authentication and routing logic removed from the codebase, so that only the unified flow executes.

#### Acceptance Criteria

1. THE Authentication System SHALL identify all existing authentication flows in the codebase
2. THE Authentication System SHALL remove or disable all authentication flows except the unified flow
3. THE Authentication System SHALL identify all existing routing logic that makes role-based decisions
4. THE Authentication System SHALL consolidate all routing logic into the Routing Guard
5. THE Authentication System SHALL remove duplicate role detection logic from individual components
6. WHERE components need user role information, THE Authentication System SHALL provide it through the Role Detection Service
7. THE Authentication System SHALL ensure no component directly queries profiles, clinicians, or user_permissions tables for authentication purposes

### Requirement 7: Performance and Reliability

**User Story:** As a user, I want the application to load quickly and reliably, so that I can start working without delays or errors.

#### Acceptance Criteria

1. WHEN a user logs in, THE Authentication System SHALL complete role detection within 1 second under normal network conditions
2. THE Authentication System SHALL complete the entire authentication and routing flow within 2 seconds
3. THE Authentication System SHALL handle network errors gracefully with exponential backoff retry logic
4. WHERE a query fails, THE Authentication System SHALL retry up to 3 times before failing
5. THE Authentication System SHALL log all authentication flow steps for debugging purposes
6. THE Authentication System SHALL provide clear error messages for each failure scenario
7. THE Authentication System SHALL NOT create more than 5 concurrent database connections during authentication

### Requirement 8: Session Management

**User Story:** As a user, I want my session to remain valid while I'm actively using the application, so that I don't have to re-authenticate frequently.

#### Acceptance Criteria

1. WHEN user data is loaded, THE Authentication System SHALL cache it in memory for the session duration
2. THE Authentication System SHALL invalidate cached data when the user logs out
3. THE Authentication System SHALL refresh cached data when the user manually triggers a refresh
4. WHERE cached data exists, THE Authentication System SHALL NOT query the database for the same information
5. THE Authentication System SHALL provide a method to invalidate specific cached data items
6. WHEN the user's role or permissions change, THE Authentication System SHALL detect the change and refresh cached data
7. THE Authentication System SHALL store session data in a way that survives page refreshes but not browser restarts
