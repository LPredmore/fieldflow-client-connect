/**
 * Legacy Tables Schema
 * Tables that may be deprecated or for backwards compatibility
 */

export const LEGACY_TABLES = {
  insurance_info: {
    name: 'insurance_info',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      profile_id: { type: 'uuid', nullable: false },
      // Primary Insurance
      payer_order: { type: 'text', nullable: true },
      ins_name_f: { type: 'text', nullable: true },
      ins_name_m: { type: 'text', nullable: true },
      ins_name_l: { type: 'text', nullable: true },
      ins_dob: { type: 'text', nullable: true },
      ins_sex: { type: 'sex_enum', nullable: true },
      ins_addr_1: { type: 'text', nullable: true },
      ins_addr_2: { type: 'text', nullable: true },
      ins_city: { type: 'text', nullable: true },
      ins_state: { type: 'text', nullable: true },
      ins_zip: { type: 'text', nullable: true },
      ins_phone: { type: 'text', nullable: true },
      ins_employer: { type: 'text', nullable: true },
      ins_group: { type: 'text', nullable: true },
      ins_plan: { type: 'text', nullable: true },
      ins_number: { type: 'text', nullable: true },
      pat_rel: { type: 'pat_rel_enum', nullable: true },
      // Primary Payer
      payer_name: { type: 'text', nullable: true },
      payerid: { type: 'text', nullable: true },
      payer_addr_1: { type: 'text', nullable: true },
      payer_addr_2: { type: 'text', nullable: true },
      payer_city: { type: 'text', nullable: true },
      payer_state: { type: 'text', nullable: true },
      payer_zip: { type: 'text', nullable: true },
      pcn: { type: 'text', nullable: true },
      prior_auth: { type: 'text', nullable: true },
      // Secondary/Other Insurance
      other_ins_name_f: { type: 'text', nullable: true },
      other_ins_name_m: { type: 'text', nullable: true },
      other_ins_name_l: { type: 'text', nullable: true },
      other_ins_dob: { type: 'text', nullable: true },
      other_ins_sex: { type: 'sex_enum', nullable: true },
      other_ins_group: { type: 'text', nullable: true },
      other_ins_plan: { type: 'text', nullable: true },
      other_ins_number: { type: 'text', nullable: true },
      other_ins_payment_date: { type: 'text', nullable: true },
      other_ins_medicare_code: { type: 'text', nullable: true },
      other_pat_rel: { type: 'pat_rel_enum', nullable: true },
      // Other Payer
      other_payer_name: { type: 'text', nullable: true },
      other_payerid: { type: 'text', nullable: true },
      other_payer_addr_1: { type: 'text', nullable: true },
      other_payer_addr_2: { type: 'text', nullable: true },
      other_payer_city: { type: 'text', nullable: true },
      other_payer_state: { type: 'text', nullable: true },
      other_payer_zip: { type: 'text', nullable: true },
      other_payer_phone: { type: 'text', nullable: true },
      other_payer_typecode: { type: 'text', nullable: true },
      // Pay To
      pay_addr_1: { type: 'text', nullable: true },
      pay_addr_2: { type: 'text', nullable: true },
      pay_city: { type: 'text', nullable: true },
      pay_state: { type: 'text', nullable: true },
      pay_zip: { type: 'text', nullable: true },
    },
  },

  treatment_approaches: {
    name: 'treatment_approaches',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', nullable: false },
      name: { type: 'text', nullable: false },
      description: { type: 'text', nullable: true },
      is_active: { type: 'boolean', nullable: false, default: 'true' },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },
} as const;

export type LegacyTable = keyof typeof LEGACY_TABLES;
