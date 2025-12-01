# Requirements Document

## Introduction

The Treatment Approaches section on the /staff/registration page is not auto-populating properly. Currently, users see "No treatment approaches available" even when there is valid data in the database. The system should display treatment approaches that match the user's specialty field from their clinician profile, but there's a timing/initialization issue preventing the data from loading correctly.

The core issue is that the `useTreatmentApproaches` hook uses an `enabled: !!specialty` flag that prevents the query from running when the specialty is initially empty (during form initialization), and the hook doesn't properly re-trigger when the specialty becomes available after the form resets with clinician data.

## Requirements

### Requirement 1

**User Story:** As a clinician completing staff registration, I want to see treatment approaches automatically populated based on my specialty, so that I can select the approaches I use without having to wait or refresh the page.

#### Acceptance Criteria

1. WHEN the staff registration form loads THEN the system SHALL fetch treatment approaches data immediately
2. WHEN the clinician's specialty becomes available THEN the system SHALL filter and display only the treatment approaches that match the specialty
3. WHEN the specialty field is "Mental Health" THEN the system SHALL display approaches like "CBT" and "CPT" from the treatment_approaches table
4. WHEN no specialty is selected THEN the system SHALL still fetch all treatment approaches data but not display any options until a specialty is available

### Requirement 2

**User Story:** As a clinician with an existing specialty in my profile, I want the treatment approaches to load immediately when I reach step 3 of registration, so that I don't see "No treatment approaches available" messages.

#### Acceptance Criteria

1. WHEN the form initializes with clinician data THEN the treatment approaches query SHALL execute regardless of initial specialty value
2. WHEN the specialty field gets populated from clinician data THEN the treatment approaches SHALL be filtered and displayed without requiring a manual refetch
3. WHEN the useTreatmentApproaches hook receives a specialty parameter THEN it SHALL immediately filter the cached data and return matching approaches
4. IF the query is still loading THEN the system SHALL show "Loading treatment approaches..." message instead of "No treatment approaches available"

### Requirement 3

**User Story:** As a system administrator, I want the treatment approaches data to be efficiently cached and filtered client-side, so that the system performs well and doesn't make unnecessary database queries.

#### Acceptance Criteria

1. WHEN the treatment approaches hook is initialized THEN it SHALL fetch all treatment approaches data once and cache it
2. WHEN the specialty parameter changes THEN the system SHALL filter the cached data client-side without making additional database queries
3. WHEN multiple components use the treatment approaches hook THEN they SHALL share the same cached data
4. WHEN the data is successfully loaded THEN subsequent specialty changes SHALL provide immediate filtering results

### Requirement 4

**User Story:** As a developer debugging the system, I want clear logging and error handling for treatment approaches loading, so that I can quickly identify and resolve any issues.

#### Acceptance Criteria

1. WHEN the treatment approaches hook executes THEN it SHALL log the specialty parameter and filtering results
2. WHEN there are no matching approaches for a specialty THEN the system SHALL log this condition and display an appropriate message
3. WHEN the database query fails THEN the system SHALL display a clear error message and provide retry functionality
4. WHEN the hook receives invalid or unexpected data THEN it SHALL handle the error gracefully and log the issue