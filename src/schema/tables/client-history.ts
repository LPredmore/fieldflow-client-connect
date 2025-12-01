/**
 * Client History Tables Schema
 * Single Source of Truth for client intake history forms
 */

export const CLIENT_HISTORY_TABLES = {
  client_history_forms: {
    name: 'client_history_forms',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', nullable: false },
      client_id: { type: 'uuid', nullable: false },
      submitted_by_profile_id: { type: 'uuid', nullable: true },
      submission_date: { type: 'timestamptz', nullable: true },
      signature: { type: 'text', nullable: true },
      // Current Issues
      current_issues: { type: 'text', nullable: true },
      progression_of_issues: { type: 'text', nullable: true },
      relationship_problems: { type: 'text', nullable: true },
      counseling_goals: { type: 'text', nullable: true },
      // Symptoms
      symptoms_mood: { type: 'text[]', nullable: true },
      symptoms_physical: { type: 'text[]', nullable: true },
      symptoms_behavioral: { type: 'text[]', nullable: true },
      symptoms_cognitive: { type: 'text[]', nullable: true },
      symptoms_life_stressors: { type: 'text[]', nullable: true },
      // Personal Info
      personal_strengths: { type: 'text', nullable: true },
      hobbies: { type: 'text', nullable: true },
      education_level: { type: 'text', nullable: true },
      occupation_details: { type: 'text', nullable: true },
      // Family Information
      is_married: { type: 'boolean', nullable: true },
      ever_married_before: { type: 'boolean', nullable: true },
      spouse_name: { type: 'text', nullable: true },
      spouse_personality: { type: 'text', nullable: true },
      spouse_relationship: { type: 'text', nullable: true },
      same_household_as_family: { type: 'boolean', nullable: true },
      // Childhood
      childhood_experiences: { type: 'text[]', nullable: true },
      childhood_elaboration: { type: 'text', nullable: true },
      // Health
      medical_conditions: { type: 'text[]', nullable: true },
      chronic_health: { type: 'text', nullable: true },
      takes_prescription_meds: { type: 'boolean', nullable: true },
      sleep_hours: { type: 'smallint', nullable: true },
      tobacco_use_per_day: { type: 'smallint', nullable: true },
      alcohol_use_per_week: { type: 'smallint', nullable: true },
      drug_use: { type: 'text', nullable: true },
      // Mental Health History
      ever_mh_treatment: { type: 'boolean', nullable: true },
      ever_psych_hospitalized: { type: 'boolean', nullable: true },
      ever_psych_hold: { type: 'boolean', nullable: true },
      ever_suicide_attempt: { type: 'boolean', nullable: true },
      // Emergency Contact
      emergency_name: { type: 'text', nullable: true },
      emergency_phone: { type: 'text', nullable: true },
      emergency_relationship: { type: 'text', nullable: true },
      // Additional
      life_changes: { type: 'text', nullable: true },
      additional_info: { type: 'text', nullable: true },
      additional_info2: { type: 'text', nullable: true },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },

  client_history_family_members: {
    name: 'client_history_family_members',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', nullable: false },
      client_id: { type: 'uuid', nullable: false },
      history_form_id: { type: 'uuid', nullable: false },
      context: { type: 'client_history_family_context_enum', nullable: false },
      relationship_type: { type: 'text', nullable: true },
      name: { type: 'text', nullable: true },
      personality: { type: 'text', nullable: true },
      relationship_growing_up: { type: 'text', nullable: true },
      relationship_now: { type: 'text', nullable: true },
      sort_order: { type: 'integer', nullable: true },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },

  client_history_medications: {
    name: 'client_history_medications',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', nullable: false },
      client_id: { type: 'uuid', nullable: false },
      history_form_id: { type: 'uuid', nullable: false },
      med_name: { type: 'text', nullable: true },
      med_purpose: { type: 'text', nullable: true },
      med_duration: { type: 'text', nullable: true },
      sort_order: { type: 'integer', nullable: true },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },

  client_history_past_spouses: {
    name: 'client_history_past_spouses',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', nullable: false },
      client_id: { type: 'uuid', nullable: false },
      history_form_id: { type: 'uuid', nullable: false },
      name: { type: 'text', nullable: true },
      personality: { type: 'text', nullable: true },
      relationship: { type: 'text', nullable: true },
      sort_order: { type: 'integer', nullable: true },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },

  client_history_past_treatments: {
    name: 'client_history_past_treatments',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', nullable: false },
      client_id: { type: 'uuid', nullable: false },
      history_form_id: { type: 'uuid', nullable: false },
      provider_name: { type: 'text', nullable: true },
      treatment_year: { type: 'text', nullable: true },
      treatment_length: { type: 'text', nullable: true },
      treatment_reason: { type: 'text', nullable: true },
      sort_order: { type: 'integer', nullable: true },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },
} as const;

export type ClientHistoryTable = keyof typeof CLIENT_HISTORY_TABLES;
