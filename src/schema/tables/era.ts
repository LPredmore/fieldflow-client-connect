/**
 * ERA (Electronic Remittance Advice) Tables
 * Tables for managing 835 remittance files and payment reconciliation
 */

export const ERA_TABLES = {
  eras: {
    description: 'Electronic Remittance Advice (835) files from payers',
    columns: {
      id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', required: true },
      practice_id: { type: 'uuid', required: true },
      payer_name: { type: 'text', nullable: true },
      payer_id: { type: 'text', nullable: true },
      payment_reference: { type: 'text', nullable: true, description: 'Check/EFT number' },
      payment_date: { type: 'date', nullable: true },
      total_payment_amount: { type: 'numeric', nullable: true },
      created_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
      updated_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
    },
  },
  
  era_claims: {
    description: 'Individual claims within an ERA file',
    columns: {
      id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', required: true },
      era_id: { type: 'uuid', required: true },
      claim_id: { type: 'uuid', nullable: true, description: 'Link to our claim if matched' },
      payer_claim_control_no: { type: 'text', nullable: true },
      claim_status_code: { type: 'text', nullable: true },
      claim_amount: { type: 'numeric', nullable: true },
      allowed_amount: { type: 'numeric', nullable: true },
      paid_amount: { type: 'numeric', nullable: true },
      patient_responsibility_amt: { type: 'numeric', nullable: true },
      created_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
      updated_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
    },
  },
  
  era_service_lines: {
    description: 'Individual service lines within an ERA claim',
    columns: {
      id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', required: true },
      era_claim_id: { type: 'uuid', required: true },
      claim_line_id: { type: 'uuid', nullable: true, description: 'Link to our claim line if matched' },
      service_date_from: { type: 'date', nullable: true },
      service_date_to: { type: 'date', nullable: true },
      procedure_code: { type: 'text', nullable: true },
      mod1: { type: 'text', nullable: true },
      mod2: { type: 'text', nullable: true },
      mod3: { type: 'text', nullable: true },
      mod4: { type: 'text', nullable: true },
      units: { type: 'integer', nullable: true },
      billed_amount: { type: 'numeric', nullable: true },
      allowed_amount: { type: 'numeric', nullable: true },
      paid_amount: { type: 'numeric', nullable: true },
      patient_responsibility_amt: { type: 'numeric', nullable: true },
      created_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
      updated_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
    },
  },
  
  era_adjustments: {
    description: 'Adjustment codes and amounts from ERA service lines',
    columns: {
      id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', required: true },
      era_service_line_id: { type: 'uuid', required: true },
      adjustment_group: { type: 'text', nullable: true, description: 'CO, PR, OA, etc.' },
      reason_code: { type: 'text', nullable: true, description: 'CARC code' },
      amount: { type: 'numeric', required: true },
      remark_code: { type: 'text', nullable: true, description: 'RARC code' },
      created_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
      updated_at: { type: 'timestamp with time zone', required: true, default: 'now()' },
    },
  },
} as const;
