/**
 * Billing & Claims Tables
 * Tables for managing insurance claims, billing, and related processes
 */

export const BILLING_TABLES = {
  claims: {
    description: 'Insurance claims submitted for client services',
    columns: {
      id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', required: true },
      practice_id: { type: 'uuid', required: true },
      client_id: { type: 'uuid', required: true },
      client_insurance_id: { type: 'uuid', required: true },
      rendering_staff_id: { type: 'uuid', required: true },
      referral_id: { type: 'uuid', nullable: true },
      original_claim_id: { type: 'uuid', nullable: true, description: 'For corrected/resubmitted claims' },
      claim_status: { type: 'text', required: true, default: "'draft'" },
      frequency_code: { type: 'text', nullable: true, default: "'1'", description: 'Original, corrected, etc.' },
      prior_auth: { type: 'text', nullable: true },
      accept_assignment: { type: 'boolean', required: true, default: 'true' },
      auto_accident: { type: 'boolean', required: true, default: 'false' },
      auto_accident_state: { type: 'state_code_enum', nullable: true },
      employment_related: { type: 'boolean', required: true, default: 'false' },
      claim_notes: { type: 'text', nullable: true },
      total_charge: { type: 'numeric', nullable: true },
      created_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
      updated_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
    },
  },
  
  claim_lines: {
    description: 'Individual service lines within a claim',
    columns: {
      id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', required: true },
      claim_id: { type: 'uuid', required: true },
      appointment_id: { type: 'uuid', nullable: true },
      service_date_from: { type: 'date', required: true },
      service_date_to: { type: 'date', nullable: true },
      procedure_code: { type: 'text', required: true },
      mod1: { type: 'text', nullable: true },
      mod2: { type: 'text', nullable: true },
      mod3: { type: 'text', nullable: true },
      mod4: { type: 'text', nullable: true },
      units: { type: 'integer', required: true, default: '1' },
      charge_amount: { type: 'numeric', required: true },
      place_of_service: { type: 'text', nullable: true },
      service_notes: { type: 'text', nullable: true },
      allowed_amount: { type: 'numeric', nullable: true },
      paid_amount: { type: 'numeric', nullable: true },
      patient_responsibility: { type: 'numeric', nullable: true },
      adjusted_amount: { type: 'numeric', nullable: true },
      created_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
      updated_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
    },
  },
  
  claim_diagnoses: {
    description: 'Diagnoses associated with a claim',
    columns: {
      id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', required: true },
      claim_id: { type: 'uuid', required: true },
      diagnosis_code_id: { type: 'uuid', required: true },
      diag_sequence: { type: 'smallint', required: true, description: 'Order of diagnoses (A, B, C, etc.)' },
      created_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
      updated_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
    },
  },
  
  claim_line_diagnoses: {
    description: 'Junction table linking claim lines to specific diagnoses',
    columns: {
      id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', required: true },
      claim_line_id: { type: 'uuid', required: true },
      claim_diagnosis_id: { type: 'uuid', required: true },
      created_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
      updated_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
    },
  },
  
  claim_batches: {
    description: 'Batches of claims for electronic submission',
    columns: {
      id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', required: true },
      batch_status: { type: 'text', required: true, default: "'pending'" },
      created_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
      submitted_at: { type: 'timestamp with time zone', nullable: true },
      remote_batch_id: { type: 'text', nullable: true, description: 'Batch ID from clearinghouse' },
      remote_file_id: { type: 'text', nullable: true, description: 'File ID from clearinghouse' },
    },
  },
  
  claim_batch_claims: {
    description: 'Junction table linking claims to batches',
    columns: {
      id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', required: true },
      batch_id: { type: 'uuid', required: true },
      claim_id: { type: 'uuid', required: true },
      claim_batch_status: { type: 'text', nullable: true, default: "'queued'" },
      created_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
      updated_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
    },
  },
  
  claim_appeals: {
    description: 'Appeals for denied or underpaid claims',
    columns: {
      id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', required: true },
      claim_id: { type: 'uuid', required: true },
      appeal_date: { type: 'date', required: true, default: 'CURRENT_DATE' },
      appeal_reason: { type: 'text', nullable: true },
      appeal_status: { type: 'text', required: true, default: "'pending'" },
      outcome: { type: 'text', nullable: true },
      outcome_date: { type: 'date', nullable: true },
      created_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
      updated_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
    },
  },
} as const;
