# Requirements Document

## Introduction

The application is experiencing a critical startup failure due to environment variable mismatches in Supabase client configuration. The root cause is that the `.env` file defines `VITE_SUPABASE_PUBLISHABLE_KEY` but multiple application files are attempting to access `VITE_SUPABASE_ANON_KEY`, which doesn't exist. This causes the Supabase client initialization to fail with "supabaseKey is required" error, preventing the application from loading entirely.

This issue affects both the main application and the testing infrastructure, requiring a comprehensive fix to standardize environment variable naming across all files.

## Requirements

### Requirement 1

**User Story:** As a developer, I want the application to start successfully without environment variable errors, so that I can access and use the application features.

#### Acceptance Criteria

1. WHEN the application starts THEN the Supabase clients SHALL initialize successfully without "supabaseKey is required" errors
2. WHEN environment variables are referenced THEN they SHALL use consistent naming conventions across all files
3. WHEN the monitoredSupabaseClient module is imported THEN it SHALL not throw initialization errors

### Requirement 2

**User Story:** As a developer, I want all Supabase client configurations to use standardized environment variable names, so that there are no mismatches between defined and referenced variables.

#### Acceptance Criteria

1. WHEN files reference the Supabase publishable key THEN they SHALL use `VITE_SUPABASE_PUBLISHABLE_KEY` consistently
2. WHEN files reference the Supabase service role key THEN they SHALL use `VITE_SUPABASE_SERVICE_ROLE_KEY` consistently
3. WHEN the application builds THEN there SHALL be no undefined environment variable references

### Requirement 3

**User Story:** As a developer, I want the test environment to use consistent environment variable naming, so that tests can run successfully without configuration errors.

#### Acceptance Criteria

1. WHEN tests are executed THEN they SHALL use the same environment variable names as the main application
2. WHEN test configuration is set up THEN it SHALL reference existing environment variables correctly
3. WHEN test documentation is followed THEN it SHALL provide accurate environment variable names

### Requirement 4

**User Story:** As a developer, I want proper error handling for missing environment variables, so that I get clear feedback when configuration is incomplete.

#### Acceptance Criteria

1. WHEN required environment variables are missing THEN the application SHALL provide clear error messages indicating which variables are needed
2. WHEN Supabase clients are initialized THEN they SHALL validate that required environment variables are present
3. WHEN environment validation fails THEN the error message SHALL specify the exact variable names expected

### Requirement 5

**User Story:** As a developer, I want deployment and migration scripts to work with the correct environment variables, so that production deployments succeed.

#### Acceptance Criteria

1. WHEN deployment scripts run THEN they SHALL reference environment variables that exist in the configuration
2. WHEN migration scripts execute THEN they SHALL use consistent environment variable naming
3. WHEN service role operations are needed THEN the scripts SHALL properly access the service role key