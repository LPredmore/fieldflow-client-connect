/**
 * Payments & Eligibility Tables
 * Tables for managing client payments, eligibility checks, and referrals
 */

export const PAYMENTS_TABLES = {
  client_payments: {
    description: 'Direct payments from clients',
    columns: {
      id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', required: true },
      client_id: { type: 'uuid', required: true },
      claim_id: { type: 'uuid', nullable: true, description: 'Optional link to claim being paid' },
      payment_date: { type: 'timestamp with time zone', required: true, default: 'now()' },
      amount: { type: 'numeric', required: true },
      payment_method: { type: 'text', required: true, default: "'stripe'" },
      external_txn_id: { type: 'text', nullable: true, description: 'Transaction ID from payment processor' },
      created_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
      updated_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
    },
  },
  
  eligibility_checks: {
    description: 'Insurance eligibility verification requests and responses',
    columns: {
      id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', required: true },
      client_id: { type: 'uuid', required: true },
      client_insurance_id: { type: 'uuid', required: true },
      requested_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
      eligibility_status: { type: 'text', nullable: true, description: 'Active, inactive, etc.' },
      response_message: { type: 'text', nullable: true },
      coverage_start: { type: 'date', nullable: true },
      coverage_end: { type: 'date', nullable: true },
      created_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
      updated_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
    },
  },
  
  referrals: {
    description: 'Medical referrals for clients',
    columns: {
      id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', required: true },
      client_id: { type: 'uuid', required: true },
      ref_name_f: { type: 'text', nullable: true },
      ref_name_m: { type: 'text', nullable: true },
      ref_name_l: { type: 'text', nullable: true },
      ref_npi: { type: 'text', nullable: true },
      referral_reason: { type: 'text', nullable: true },
      referral_date: { type: 'date', nullable: true },
      expiration_date: { type: 'date', nullable: true },
      visit_limit: { type: 'integer', nullable: true },
      created_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
      updated_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
    },
  },
} as const;
