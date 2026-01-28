/**
 * Staff/Provider Tables Schema
 * Single Source of Truth for all staff and provider-related tables
 */

export const STAFF_PROVIDER_TABLES = {
  staff: {
    name: 'staff',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', nullable: false },
      profile_id: { type: 'uuid', nullable: false },
      // Provider Information
      prov_name_f: { type: 'text', nullable: true },
      prov_name_m: { type: 'text', nullable: true },
      prov_name_l: { type: 'text', nullable: true },
      prov_name_for_clients: { type: 'text', nullable: true },
      prov_status: { type: 'text', nullable: true },
      prov_field: { type: 'text', nullable: true },
      prov_license_type: { type: 'text', nullable: true },
      prov_license_number: { type: 'text', nullable: true },
      // Contact & Location
      prov_phone: { type: 'text', nullable: true },
      prov_addr_1: { type: 'text', nullable: true },
      prov_addr_2: { type: 'text', nullable: true },
      prov_city: { type: 'text', nullable: true },
      prov_state: { type: 'state_code_enum', nullable: true },
      prov_zip: { type: 'text', nullable: true },
      // Professional Details
      prov_npi: { type: 'text', nullable: true },
      prov_taxid: { type: 'text', nullable: true },
      prov_taxid_type: { type: 'text', nullable: true },
      prov_taxonomy: { type: 'text', nullable: true },
      prov_qualifier: { type: 'text', nullable: true, default: "'ZZ'" },
      // Practice Information
      prov_bio: { type: 'text', nullable: true },
      prov_image_url: { type: 'text', nullable: true },
      prov_treatment_approaches: { type: 'text[]', nullable: true },
      prov_accepting_new_clients: { type: 'boolean', nullable: false, default: 'false' },
      prov_min_client_age: { type: 'integer', nullable: false, default: '18' },
      prov_dob: { type: 'date', nullable: true },
      prov_degree: { type: 'text', nullable: true },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },

  staff_licenses: {
    name: 'staff_licenses',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', nullable: false },
      staff_id: { type: 'uuid', nullable: false },
      license_type: { type: 'text', nullable: false },
      license_number: { type: 'text', nullable: false },
      license_state: { type: 'state_code_enum', nullable: false },
      issue_date: { type: 'date', nullable: true },
      expiration_date: { type: 'date', nullable: true },
      is_active: { type: 'boolean', nullable: false, default: 'true' },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },

  staff_roles: {
    name: 'staff_roles',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      code: { type: 'text', nullable: false },
      name: { type: 'text', nullable: false },
      description: { type: 'text', nullable: true },
      is_clinical: { type: 'boolean', nullable: false, default: 'false' },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },

  staff_role_assignments: {
    name: 'staff_role_assignments',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', nullable: false },
      staff_id: { type: 'uuid', nullable: false },
      staff_role_id: { type: 'uuid', nullable: false },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },
} as const;

export type StaffProviderTable = keyof typeof STAFF_PROVIDER_TABLES;
