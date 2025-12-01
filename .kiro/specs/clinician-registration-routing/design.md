# Design Document

## Overview

The Clinician Registration and Routing System is a comprehensive authentication and authorization layer that manages staff member onboarding and access control. The system uses a status-based approach to determine user routing, ensuring clinicians complete registration before accessing patient data while allowing non-clinician staff seamless access to their work tools.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    A[User Login] --> B[Authentication Layer]
    B --> C[Staff Type Detection]
    C --> D{Is Clinician?}
    D -->|Yes| E[Clinician Status Check]
    D -->|No| F[Non-Clinician Route]
    E --> G{Status = "New"?}
    E --> H{Status = "Active"?}
    G -->|Yes| I[Registration Page]
    H -->|Yes| J[Dashboard Page]
    F --> K[Standard Role-Based Access]
    I --> L[Registration Complete]
    L --> M[Update Status to Active]
    M --> J
```

### Component Architecture

The system consists of four main components:

1. **Staff Type Detector**: Determines if a user is a clinician or non-clinician staff
2. **Clinician Status Manager**: Manages clinician_status values in the database
3. **Route Guard**: Intercepts navigation and applies routing rules
4. **Registration Flow Controller**: Manages the registration process and status updates

## Components and Interfaces

### 1. Staff Type Detector

**Purpose**: Identify whether a logged-in user is a clinician or non-clinician staff member.

**Interface**:
```typescript
interface StaffTypeDetector {
  isClinicianStaff(userId: string): Promise<boolean>;
  getStaffRecord(userId: string): Promise<StaffRecord | null>;
}

interface StaffRecord {
  id: string;
  user_id: string;
  is_clinician: boolean;
  role: string;
  department?: string;
}
```

**Implementation Strategy**:
- Query the staff table to determine clinician status
- Cache results for performance
- Handle missing or invalid records gracefully

### 2. Clinician Status Manager

**Purpose**: Manage clinician_status values and ensure data consistency.

**Interface**:
```typescript
interface ClinicianStatusManager {
  getClinicianStatus(userId: string): Promise<ClinicianStatus | null>;
  setClinicianStatus(userId: string, status: ClinicianStatus): Promise<void>;
  initializeClinicianRecord(userId: string, isClinicianStaff: boolean): Promise<void>;
}

type ClinicianStatus = "New" | "Active";

interface ClinicianRecord {
  id: string;
  user_id: string;
  clinician_status: ClinicianStatus | null;
  created_at: string;
  updated_at: string;
}
```

**Implementation Strategy**:
- Automatically create clinician records during staff creation
- Set initial status based on staff type (clinician vs non-clinician)
- Provide atomic status updates with proper error handling

### 3. Route Guard

**Purpose**: Intercept navigation and apply routing rules based on user type and status.

**Interface**:
```typescript
interface RouteGuard {
  canAccess(path: string, userId: string): Promise<RouteDecision>;
  getRedirectPath(userId: string): Promise<string | null>;
}

interface RouteDecision {
  allowed: boolean;
  redirectTo?: string;
  reason: string;
}
```

**Implementation Strategy**:
- Integrate with React Router or similar routing library
- Evaluate permissions on every route change
- Provide clear feedback for denied access attempts

### 4. Registration Flow Controller

**Purpose**: Manage the registration process and status transitions.

**Interface**:
```typescript
interface RegistrationFlowController {
  completeRegistration(userId: string, registrationData: RegistrationData): Promise<void>;
  validateRegistrationData(data: RegistrationData): ValidationResult;
}

interface RegistrationData {
  licenseNumber?: string;
  specialties: string[];
  certifications: string[];
  // Additional registration fields
}
```

## Data Models

### Enhanced Clinicians Table

```sql
-- Existing table structure with clarified status usage
CREATE TABLE public.clinicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  clinician_status TEXT CHECK (clinician_status IN ('New', 'Active')) DEFAULT NULL,
  license_number TEXT,
  specialties TEXT[],
  certifications TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Status Logic**:
- `"New"`: Clinician who needs to complete registration
- `"Active"`: Staff member with full system access (completed clinicians or non-clinician staff)

### Staff Table Integration

```sql
-- Assumed existing staff table structure
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_clinician BOOLEAN NOT NULL DEFAULT FALSE,
  role TEXT NOT NULL,
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Error Handling

### Error Categories

1. **Authentication Errors**: User not logged in or session expired
2. **Data Consistency Errors**: Missing staff or clinician records
3. **Permission Errors**: Unauthorized access attempts
4. **System Errors**: Database connectivity or unexpected failures

### Error Handling Strategy

```typescript
interface ErrorHandler {
  handleAuthenticationError(error: AuthError): void;
  handleDataConsistencyError(error: DataError): void;
  handlePermissionError(error: PermissionError): void;
  handleSystemError(error: SystemError): void;
}
```

**Implementation Approach**:
- Graceful degradation for non-critical errors
- Automatic retry for transient failures
- Clear user messaging for actionable errors
- Comprehensive logging for debugging

## Testing Strategy

### Unit Testing

**Components to Test**:
- Staff Type Detector logic
- Clinician Status Manager operations
- Route Guard decision making
- Registration Flow Controller validation

**Test Scenarios**:
- Valid clinician and non-clinician staff detection
- Status transitions (New → Active)
- Route access permissions for different user types
- Error handling for edge cases

### Integration Testing

**Test Scenarios**:
- End-to-end user flows for new clinicians
- End-to-end user flows for active clinicians
- End-to-end user flows for non-clinician staff
- Database consistency during status changes
- Route protection across different entry points

### Performance Testing

**Metrics to Monitor**:
- Route guard evaluation time
- Database query performance for status checks
- Cache hit rates for staff type detection
- Overall page load impact

## Security Considerations

### Access Control

- All routing decisions must be server-side validated
- Client-side route guards are for UX only, not security
- Sensitive operations require re-authentication
- Audit logging for all access control decisions

### Data Protection

- Clinician status information is considered sensitive
- All database operations use parameterized queries
- Role-based access controls for administrative functions
- Regular security audits of routing logic

## Implementation Phases

### Phase 1: Core Infrastructure
- Implement Staff Type Detector
- Create Clinician Status Manager
- Set up basic route guard framework

### Phase 2: Registration Flow
- Build registration page and form validation
- Implement Registration Flow Controller
- Add status transition logic

### Phase 3: Route Protection
- Complete route guard implementation
- Add comprehensive error handling
- Implement audit logging

### Phase 4: Testing and Optimization
- Comprehensive testing suite
- Performance optimization
- Security audit and hardening