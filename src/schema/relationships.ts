/**
 * Database Relationships (Foreign Keys)
 * Single Source of Truth for all table relationships
 * 
 * NOTE: Current database has NO foreign key constraints defined.
 * This file documents the LOGICAL relationships based on column names.
 */

export const DB_RELATIONSHIPS = {
  // Core Patient Relationships
  clients: {
    tenant_id: { references: 'tenants.id' },
    profile_id: { references: 'profiles.id' },
    primary_staff_id: { references: 'staff.id' },
  },
  
  client_diagnoses: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
    diagnosis_code_id: { references: 'diagnosis_codes.id' },
  },
  
  client_emergency_contacts: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
  },
  
  client_insurance: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
  },
  
  client_safety_plans: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
    created_by_profile_id: { references: 'profiles.id' },
  },
  
  client_telehealth_consents: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
    signed_by_profile_id: { references: 'profiles.id' },
  },
  
  client_treatment_plans: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
    staff_id: { references: 'staff.id' },
    created_by_profile_id: { references: 'profiles.id' },
    supersedes_plan_id: { references: 'client_treatment_plans.id' },
  },
  
  // Appointment Relationships
  appointments: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
    staff_id: { references: 'staff.id' },
    service_id: { references: 'services.id' },
    series_id: { references: 'appointment_series.id' },
    location_id: { references: 'practice_locations.id' },
    created_by_profile_id: { references: 'profiles.id' },
  },
  
  appointment_series: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
    staff_id: { references: 'staff.id' },
    service_id: { references: 'services.id' },
    created_by_profile_id: { references: 'profiles.id' },
  },
  
  appointment_exceptions: {
    tenant_id: { references: 'tenants.id' },
    series_id: { references: 'appointment_series.id' },
    replacement_appointment_id: { references: 'appointments.id' },
  },
  
  appointment_session_context: {
    tenant_id: { references: 'tenants.id' },
    appointment_id: { references: 'appointments.id' },
    emergency_contact_id: { references: 'client_emergency_contacts.id' },
  },
  
  appointment_clinical_notes: {
    tenant_id: { references: 'tenants.id' },
    appointment_id: { references: 'appointments.id' },
    client_id: { references: 'clients.id' },
    staff_id: { references: 'staff.id' },
  },
  
  // Assessment Relationships
  client_phq9_assessments: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
    staff_id: { references: 'staff.id' },
    appointment_id: { references: 'appointments.id' },
  },
  
  client_gad7_assessments: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
    staff_id: { references: 'staff.id' },
    appointment_id: { references: 'appointments.id' },
  },
  
  client_pcl5_assessments: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
    staff_id: { references: 'staff.id' },
    appointment_id: { references: 'appointments.id' },
  },
  
  // Client History Relationships
  client_history_forms: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
    submitted_by_profile_id: { references: 'profiles.id' },
  },
  
  client_history_family_members: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
    history_form_id: { references: 'client_history_forms.id' },
  },
  
  client_history_medications: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
    history_form_id: { references: 'client_history_forms.id' },
  },
  
  client_history_past_spouses: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
    history_form_id: { references: 'client_history_forms.id' },
  },
  
  client_history_past_treatments: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
    history_form_id: { references: 'client_history_forms.id' },
  },
  
  // Staff/Provider Relationships
  staff: {
    tenant_id: { references: 'tenants.id' },
    profile_id: { references: 'profiles.id' },
  },
  
  staff_licenses: {
    tenant_id: { references: 'tenants.id' },
    staff_id: { references: 'staff.id' },
  },
  
  staff_role_assignments: {
    tenant_id: { references: 'tenants.id' },
    staff_id: { references: 'staff.id' },
    staff_role_id: { references: 'staff_roles.id' },
  },
  
  // Practice/Org Relationships
  tenant_memberships: {
    tenant_id: { references: 'tenants.id' },
    profile_id: { references: 'profiles.id' },
  },
  
  practice_info: {
    tenant_id: { references: 'tenants.id' },
  },
  
  practice_locations: {
    tenant_id: { references: 'tenants.id' },
  },
  
  services: {
    tenant_id: { references: 'tenants.id' },
    created_by_profile_id: { references: 'profiles.id' },
  },
  
  // Billing Relationships
  claims: {
    tenant_id: { references: 'tenants.id' },
    practice_id: { references: 'practice_info.id' },
    client_id: { references: 'clients.id' },
    client_insurance_id: { references: 'client_insurance.id' },
    rendering_staff_id: { references: 'staff.id' },
    referral_id: { references: 'referrals.id' },
    original_claim_id: { references: 'claims.id' },
  },
  
  claim_lines: {
    tenant_id: { references: 'tenants.id' },
    claim_id: { references: 'claims.id' },
    appointment_id: { references: 'appointments.id' },
  },
  
  claim_diagnoses: {
    tenant_id: { references: 'tenants.id' },
    claim_id: { references: 'claims.id' },
    diagnosis_code_id: { references: 'diagnosis_codes.id' },
  },
  
  claim_line_diagnoses: {
    tenant_id: { references: 'tenants.id' },
    claim_line_id: { references: 'claim_lines.id' },
    claim_diagnosis_id: { references: 'claim_diagnoses.id' },
  },
  
  claim_batches: {
    tenant_id: { references: 'tenants.id' },
  },
  
  claim_batch_claims: {
    tenant_id: { references: 'tenants.id' },
    batch_id: { references: 'claim_batches.id' },
    claim_id: { references: 'claims.id' },
  },
  
  claim_appeals: {
    tenant_id: { references: 'tenants.id' },
    claim_id: { references: 'claims.id' },
  },
  
  // ERA Relationships
  eras: {
    tenant_id: { references: 'tenants.id' },
    practice_id: { references: 'practice_info.id' },
  },
  
  era_claims: {
    tenant_id: { references: 'tenants.id' },
    era_id: { references: 'eras.id' },
    claim_id: { references: 'claims.id' },
  },
  
  era_service_lines: {
    tenant_id: { references: 'tenants.id' },
    era_claim_id: { references: 'era_claims.id' },
    claim_line_id: { references: 'claim_lines.id' },
  },
  
  era_adjustments: {
    tenant_id: { references: 'tenants.id' },
    era_service_line_id: { references: 'era_service_lines.id' },
  },
  
  // Payment Relationships
  client_payments: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
    claim_id: { references: 'claims.id' },
  },
  
  eligibility_checks: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
    client_insurance_id: { references: 'client_insurance.id' },
  },
  
  referrals: {
    tenant_id: { references: 'tenants.id' },
    client_id: { references: 'clients.id' },
  },
  
  // Legacy
  insurance_info: {
    profile_id: { references: 'profiles.id' },
  },
  
  // NOTE: treatment_approaches has NO tenant_id - it's global reference data
  // Filtered by specialty column (specialty_enum)
  treatment_approaches: {
    // No foreign keys - standalone reference table
  },
  
  cliniclevel_license_types: {
    // No tenant_id - global reference data
    // Filtered by specialty column
  },
} as const;

export type TableWithRelationships = keyof typeof DB_RELATIONSHIPS;
