# Requirements Document

## Introduction

This specification defines a strategic clinician registration and routing system that manages staff member onboarding and access control based on clinician status. The system ensures that clinicians are properly registered before accessing the EMR system while allowing non-clinician staff to bypass the registration process entirely.

## Glossary

- **Clinician_Registration_System**: The system component responsible for managing clinician onboarding and status tracking
- **Staff_Member**: Any employee who has access to the system, including both clinicians and non-clinician staff
- **Clinician**: A staff member who provides direct patient care and requires registration through the clinical onboarding process
- **Non_Clinician_Staff**: Staff members who do not provide direct patient care and bypass the registration system
- **Clinician_Status**: An enumerated field in the public.clinicians table with values "New", "Active", or null
- **EMR_Domain**: The emr.valorwell.org domain where the electronic medical record system is hosted
- **Registration_Page**: The /staff/registration page where new clinicians complete their onboarding
- **Dashboard_Page**: The /staff/dashboard page where active clinicians access the main system

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want staff members to be automatically categorized based on their clinician status during account creation, so that the system can route them appropriately.

#### Acceptance Criteria

1. WHEN a Staff_Member is added to the system AND they are marked as a clinician, THE Clinician_Registration_System SHALL set the public.clinicians.clinician_status value to "New"
2. WHEN a Staff_Member is added to the system AND they are not marked as a clinician, THE Clinician_Registration_System SHALL set the public.clinicians.clinician_status value to "Active"
4. THE Clinician_Registration_System SHALL ensure that every Staff_Member has a corresponding record in the public.clinicians table upon account creation

### Requirement 2

**User Story:** As a new clinician, I want to be automatically directed to the registration process when I first log in, so that I can complete my onboarding before accessing patient data.

#### Acceptance Criteria

1. WHEN a Clinician logs in AND their public.clinicians.clinician_status value is "New", THE Clinician_Registration_System SHALL redirect them to the Registration_Page
2. WHEN a Clinician with clinician_status "New" attempts to access any page within the EMR_Domain, THE Clinician_Registration_System SHALL redirect them to the Registration_Page
3. THE Clinician_Registration_System SHALL prevent access to all EMR_Domain pages except the Registration_Page for clinicians with "New" status
4. THE Clinician_Registration_System SHALL maintain the redirect behavior until the clinician_status is changed from "New"

### Requirement 3

**User Story:** As an active clinician, I want to be directed to the main dashboard when I log in, so that I can immediately access my work tools and patient information.

#### Acceptance Criteria

1. WHEN a Clinician logs in AND their public.clinicians.clinician_status value is "Active", THE Clinician_Registration_System SHALL redirect them to the Dashboard_Page
2. WHEN a Clinician with clinician_status "Active" accesses the EMR_Domain, THE Clinician_Registration_System SHALL allow unrestricted navigation within the system
3. THE Clinician_Registration_System SHALL not impose any routing restrictions on clinicians with "Active" status

### Requirement 4

**User Story:** As a non-clinician staff member, I want to bypass the registration system entirely, so that I can access my work tools without unnecessary onboarding steps.

#### Acceptance Criteria

1. WHEN a Non_Clinician_Staff member logs in, THE Clinician_Registration_System SHALL allow them to access all appropriate system areas without registration requirements
2. THE Clinician_Registration_System SHALL not redirect Non_Clinician_Staff to the Registration_Page under any circumstances
3. WHEN a Non_Clinician_Staff member accesses the EMR_Domain, THE Clinician_Registration_System SHALL apply standard role-based access controls without registration-based restrictions
4. THE Clinician_Registration_System SHALL distinguish between clinician and non-clinician staff members based on their staff record configuration

### Requirement 5

**User Story:** As a system administrator, I want the routing logic to be consistent and reliable across all entry points, so that staff members have a predictable experience regardless of how they access the system.

#### Acceptance Criteria

1. THE Clinician_Registration_System SHALL apply the same routing logic whether users access the system via direct URL, bookmark, or login redirect
2. THE Clinician_Registration_System SHALL evaluate clinician_status on every page load within the EMR_Domain
3. WHEN routing decisions are made, THE Clinician_Registration_System SHALL log the decision criteria for audit purposes
4. THE Clinician_Registration_System SHALL handle edge cases such as missing clinician records or invalid status values gracefully
5. IF a Clinician record is missing or corrupted, THEN THE Clinician_Registration_System SHALL create a new record with appropriate default values based on the staff member's clinician designation