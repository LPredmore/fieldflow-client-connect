# Requirements Document

## Introduction

The application is experiencing critical performance issues where pages take 60+ seconds to load due to database query errors in the `useUnifiedAppointments` hook. The root cause is a schema mismatch where the code attempts to query a non-existent `notes` column from the `appointment_series` table, triggering a circuit breaker that blocks all subsequent queries. This affects all pages that use the shared Layout component, not just appointment-related pages.

## Requirements

### Requirement 1: Fix Database Schema Mismatch

**User Story:** As a developer, I want database queries to match the actual database schema, so that queries execute successfully without errors.

#### Acceptance Criteria

1. WHEN the `useUnifiedAppointments` hook queries the `appointment_series` table THEN it SHALL NOT reference non-existent columns like `notes`
2. WHEN the hook processes appointment occurrences THEN it SHALL NOT attempt to access `occurrence.appointment_series?.notes` 
3. WHEN any database query is executed THEN it SHALL only reference columns that exist in the current database schema
4. IF a column reference is needed for backward compatibility THEN the system SHALL use an existing equivalent column or handle the missing data gracefully

### Requirement 2: Optimize Data Loading Strategy

**User Story:** As a user, I want pages to load quickly regardless of which page I'm visiting, so that I can efficiently navigate the application.

#### Acceptance Criteria

1. WHEN I navigate to the Services page THEN the system SHALL NOT load Dashboard-specific appointment data
2. WHEN I visit any page THEN only the data required for that specific page SHALL be fetched
3. WHEN the Dashboard component is not visible THEN appointment data SHALL NOT be automatically loaded
4. WHEN I navigate between pages THEN each page SHALL load in under 5 seconds

### Requirement 3: Improve Circuit Breaker Configuration

**User Story:** As a user, I want the application to recover quickly from temporary database issues, so that brief connectivity problems don't cause extended outages.

#### Acceptance Criteria

1. WHEN database errors occur THEN the circuit breaker SHALL allow more than 3 consecutive errors before opening
2. WHEN the circuit breaker opens THEN it SHALL reset after no more than 30 seconds instead of 60 seconds
3. WHEN errors are transient THEN the system SHALL retry operations with appropriate backoff
4. WHEN the circuit breaker is in half-open state THEN it SHALL require fewer successful operations to close

### Requirement 4: Add Query Validation and Monitoring

**User Story:** As a developer, I want to detect database schema mismatches early, so that I can fix issues before they impact users.

#### Acceptance Criteria

1. WHEN database queries are executed THEN the system SHALL log detailed information about query structure and results
2. WHEN a database error occurs THEN the system SHALL provide clear error messages indicating the specific issue
3. WHEN column references are made THEN the system SHALL validate that columns exist in the target table
4. WHEN migrations are applied THEN any affected queries SHALL be automatically identified and flagged for review

### Requirement 5: Prevent Global Data Loading Issues

**User Story:** As a user, I want each page to load independently, so that issues on one page don't affect the performance of other pages.

#### Acceptance Criteria

1. WHEN I visit a page THEN only that page's required data SHALL be loaded
2. WHEN shared components need data THEN they SHALL conditionally load data based on the current route
3. WHEN the Layout component renders THEN it SHALL NOT trigger data loading for components not currently needed
4. WHEN navigation occurs THEN previous page data loading SHALL be cancelled if still in progress

### Requirement 6: Audit and Fix All Schema References

**User Story:** As a developer, I want all database queries to be consistent with the current schema, so that no other similar issues exist in the codebase.

#### Acceptance Criteria

1. WHEN the codebase is audited THEN all references to removed columns SHALL be identified and fixed
2. WHEN `estimated_cost` column references are found THEN they SHALL be updated to use the correct current column names
3. WHEN any other non-existent column references are found THEN they SHALL be removed or updated appropriately
4. WHEN the audit is complete THEN all database queries SHALL execute successfully without schema-related errors