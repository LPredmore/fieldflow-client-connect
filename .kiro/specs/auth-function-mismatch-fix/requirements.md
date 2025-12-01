# Requirements Document

## Introduction

This specification addresses a critical authentication issue where staff members cannot access the staff dashboard due to a function name mismatch between the frontend and database. The frontend is calling a non-existent RPC function `get_user_role`, while the database has `get_current_user_role`, causing authentication failures and infinite redirect loops.

## Glossary

- **RPC Function**: Remote Procedure Call function in Supabase that can be invoked from the frontend
- **Authentication System**: The system responsible for verifying user identity and determining user roles
- **Staff Dashboard**: The protected area of the application accessible only to staff members
- **Function Mismatch**: When the frontend calls a database function that doesn't exist due to naming inconsistency

## Requirements

### Requirement 1

**User Story:** As a staff member, I want to be able to log in and access the staff dashboard without encountering infinite redirect loops, so that I can perform my job functions.

#### Acceptance Criteria

1. WHEN a staff member logs in with valid credentials, THE Authentication System SHALL successfully determine their user role
2. WHEN the user role is successfully retrieved, THE Authentication System SHALL allow access to the staff dashboard
3. WHEN the authentication process completes, THE Authentication System SHALL NOT cause infinite redirect loops between /staff/dashboard and /auth
4. THE Authentication System SHALL complete role determination within 5 seconds to prevent timeout errors
5. WHEN network connectivity is available, THE Authentication System SHALL successfully communicate with the database

### Requirement 2

**User Story:** As a developer, I want the frontend and database function names to be consistent, so that RPC calls succeed and the authentication system works reliably.

#### Acceptance Criteria

1. THE Authentication System SHALL call database functions that actually exist in the database schema
2. WHEN the frontend makes an RPC call for user role, THE Database SHALL have a corresponding function with the exact same name
3. THE Database Function SHALL return the user's role in the expected format
4. THE Authentication System SHALL handle both successful responses and error cases appropriately
5. THE Function Names SHALL be consistent across frontend code, database schema, and type definitions

### Requirement 3

**User Story:** As a system administrator, I want clear error messages and logging when authentication fails, so that I can quickly diagnose and resolve issues.

#### Acceptance Criteria

1. WHEN an RPC function call fails, THE Authentication System SHALL log the specific error with function name and error type
2. WHEN a function doesn't exist, THE Error Message SHALL clearly indicate the missing function name
3. THE Authentication System SHALL distinguish between network errors, function not found errors, and permission errors
4. WHEN authentication fails, THE System SHALL provide actionable error information for debugging
5. THE Logging System SHALL capture sufficient detail to diagnose function name mismatches