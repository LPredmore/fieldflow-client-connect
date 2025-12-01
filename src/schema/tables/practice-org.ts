/**
 * Practice/Organization Tables Schema
 * Single Source of Truth for practice and organizational data
 */

export const PRACTICE_ORG_TABLES = {
  tenants: {
    name: 'tenants',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      name: { type: 'text', nullable: false },
      slug: { type: 'text', nullable: false },
      display_name: { type: 'text', nullable: true },
      is_active: { type: 'boolean', nullable: false, default: 'true' },
      trial_end_date: { type: 'date', nullable: true },
      // Branding
      logo_url: { type: 'text', nullable: true },
      brand_primary_color: { type: 'text', nullable: true },
      brand_secondary_color: { type: 'text', nullable: true },
      brand_accent_color: { type: 'text', nullable: true },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },

  profiles: {
    name: 'profiles',
    columns: {
      id: { type: 'uuid', nullable: false },
      email: { type: 'text', nullable: false },
      password: { type: 'text', nullable: false },
      email_verified: { type: 'boolean', nullable: false, default: 'false' },
      is_active: { type: 'boolean', nullable: false, default: 'true' },
      failed_login_attempts: { type: 'integer', nullable: false, default: '0' },
      locked_until: { type: 'timestamptz', nullable: true },
      last_login_at: { type: 'timestamptz', nullable: true },
      last_login_ip: { type: 'text', nullable: true },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },

  tenant_memberships: {
    name: 'tenant_memberships',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', nullable: false },
      profile_id: { type: 'uuid', nullable: false },
      tenant_role: { type: 'text', nullable: false, default: "'member'" },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },

  practice_info: {
    name: 'practice_info',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', nullable: false },
      is_default: { type: 'boolean', nullable: false, default: 'false' },
      // Billing Information
      bill_name: { type: 'text', nullable: false },
      bill_taxid: { type: 'text', nullable: false },
      bill_taxid_type: { type: 'text', nullable: true },
      bill_npi: { type: 'text', nullable: true },
      bill_taxonomy: { type: 'text', nullable: true },
      // Billing Address
      bill_addr_1: { type: 'text', nullable: true },
      bill_addr_2: { type: 'text', nullable: true },
      bill_city: { type: 'text', nullable: true },
      bill_state: { type: 'state_code_enum', nullable: true },
      bill_zip: { type: 'text', nullable: true },
      bill_phone: { type: 'text', nullable: true },
      // Pay-To Address
      pay_addr_1: { type: 'text', nullable: true },
      pay_addr_2: { type: 'text', nullable: true },
      pay_city: { type: 'text', nullable: true },
      pay_state: { type: 'state_code_enum', nullable: true },
      pay_zip: { type: 'text', nullable: true },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },

  practice_locations: {
    name: 'practice_locations',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', nullable: false },
      name: { type: 'text', nullable: false },
      is_default: { type: 'boolean', nullable: false, default: 'false' },
      is_telehealth_only: { type: 'boolean', nullable: false, default: 'false' },
      // Address
      addr_1: { type: 'text', nullable: true },
      addr_2: { type: 'text', nullable: true },
      city: { type: 'text', nullable: true },
      state: { type: 'state_code_enum', nullable: true },
      zip: { type: 'text', nullable: true },
      phone: { type: 'text', nullable: true },
      fax: { type: 'text', nullable: true },
      // Service Location Info
      svc_npi: { type: 'text', nullable: true },
      svc_taxonomy: { type: 'text', nullable: true },
      svc_taxid: { type: 'text', nullable: true },
      svc_taxid_type: { type: 'text', nullable: true },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },

  services: {
    name: 'services',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', nullable: false },
      created_by_profile_id: { type: 'uuid', nullable: false },
      name: { type: 'text', nullable: false },
      description: { type: 'text', nullable: true },
      category: { type: 'text', nullable: true },
      cpt_code: { type: 'text', nullable: true },
      duration_minutes: { type: 'integer', nullable: true },
      price_per_unit: { type: 'numeric', nullable: true },
      is_active: { type: 'boolean', nullable: false, default: 'true' },
      schedulable: { type: 'boolean', nullable: false, default: 'true' },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },
} as const;

export type PracticeOrgTable = keyof typeof PRACTICE_ORG_TABLES;
