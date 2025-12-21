/**
 * Database Enums - Single Source of Truth
 * Auto-generated from database schema
 * Last updated: 2025-12-01
 */

export const DB_ENUMS = {
  accept_assign_enum: ['Y', 'N'] as const,
  
  appointment_exception_type_enum: ['cancelled', 'rescheduled'] as const,
  
  gender_identity_enum: ['Female', 'Male', 'Non-Binary', 'Other'] as const,
  
  appointment_note_status_enum: ['draft', 'signed', 'amended'] as const,
  
  appointment_note_type_enum: ['progress', 'treatment', 'addendum'] as const,
  
  appointment_status_enum: ['scheduled', 'documented', 'cancelled', 'late_cancel/noshow'] as const,
  
  client_history_family_context_enum: ['family_of_origin', 'current_household'] as const,
  
  client_ideation_enum: ['none', 'passive', 'active'] as const,
  
  client_status_enum: ['New', 'Registered', 'Active', 'Inactive'] as const,
  
  client_substance_abuse_risk_enum: ['none', 'low', 'medium', 'high'] as const,
  
  clinician_status_enum: ['New', 'Active', 'Inactive'] as const,
  
  form_type_enum: ['signup', 'intake', 'session_notes'] as const,
  
  gad7_severity_enum: ['minimal', 'mild', 'moderate', 'severe'] as const,
  
  pat_rel_enum: ['18', '01', '19', '20', '21', '39', '40', '53', 'G8'] as const,
  
  pat_status_enum: ['New', 'Active'] as const,
  
  phq9_severity_enum: ['none_minimal', 'mild', 'moderate', 'moderately_severe', 'severe'] as const,
  
  risk_level_enum: ['none', 'low', 'moderate', 'high', 'imminent'] as const,
  
  sex_enum: ['M', 'F'] as const,
  
  state_code_enum: [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    'DC', 'PR', 'VI', 'GU'
  ] as const,
  
  time_zones: [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Phoenix',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'America/Puerto_Rico',
    'Pacific/Guam',
    'Pacific/Pago_Pago'
  ] as const,
} as const;

// Type exports for TypeScript usage
export type AcceptAssignEnum = typeof DB_ENUMS.accept_assign_enum[number];
export type AppointmentExceptionTypeEnum = typeof DB_ENUMS.appointment_exception_type_enum[number];
export type AppointmentNoteStatusEnum = typeof DB_ENUMS.appointment_note_status_enum[number];
export type AppointmentNoteTypeEnum = typeof DB_ENUMS.appointment_note_type_enum[number];
export type AppointmentStatusEnum = typeof DB_ENUMS.appointment_status_enum[number];
export type ClientHistoryFamilyContextEnum = typeof DB_ENUMS.client_history_family_context_enum[number];
export type ClientIdeationEnum = typeof DB_ENUMS.client_ideation_enum[number];
export type ClientStatusEnum = typeof DB_ENUMS.client_status_enum[number];
export type ClientSubstanceAbuseRiskEnum = typeof DB_ENUMS.client_substance_abuse_risk_enum[number];
export type ClinicianStatusEnum = typeof DB_ENUMS.clinician_status_enum[number];
export type FormTypeEnum = typeof DB_ENUMS.form_type_enum[number];
export type Gad7SeverityEnum = typeof DB_ENUMS.gad7_severity_enum[number];
export type PatRelEnum = typeof DB_ENUMS.pat_rel_enum[number];
export type PatStatusEnum = typeof DB_ENUMS.pat_status_enum[number];
export type Phq9SeverityEnum = typeof DB_ENUMS.phq9_severity_enum[number];
export type RiskLevelEnum = typeof DB_ENUMS.risk_level_enum[number];
export type SexEnum = typeof DB_ENUMS.sex_enum[number];
export type StateCodeEnum = typeof DB_ENUMS.state_code_enum[number];
export type TimeZones = typeof DB_ENUMS.time_zones[number];
export type GenderIdentityEnum = typeof DB_ENUMS.gender_identity_enum[number];
