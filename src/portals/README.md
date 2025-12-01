# Portal Applications

This directory contains the separate portal applications for the EHR system:

## ClientPortalApp.tsx
- Handles all client-facing functionality
- Routes: `/client/*`
- Features: Patient portal, form completion, registration

## StaffPortalApp.tsx  
- Handles staff and business admin functionality
- Routes: `/staff/*` (all staff routes)
- Features: Appointments, customers, services, invoices, forms, settings

## Architecture Benefits
- Clear separation of concerns
- Independent routing for each portal
- Easier maintenance and testing
- Better code organization
- Scalable for future features