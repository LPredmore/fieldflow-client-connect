/**
 * Reference Data Tables Schema
 * Single Source of Truth for reference/lookup tables
 */

export const REFERENCE_TABLES = {
  diagnosis_codes: {
    name: 'diagnosis_codes',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      code: { type: 'text', nullable: false },
      description: { type: 'text', nullable: false },
      system: { type: 'text', nullable: false, default: "'ICD10'" },
      is_billable: { type: 'boolean', nullable: false, default: 'true' },
      is_active: { type: 'boolean', nullable: false, default: 'true' },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },

  place_of_service: {
    name: 'place_of_service',
    columns: {
      pos_code: { type: 'varchar', nullable: false },
      description: { type: 'varchar', nullable: false },
    },
  },

  pat_rel: {
    name: 'pat_rel',
    columns: {
      id: { type: 'bigint', nullable: false },
      pat_rel: { type: 'text', nullable: true },
      description: { type: 'text', nullable: true },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },

  cliniclevel_license_types: {
    name: 'cliniclevel_license_types',
    columns: {
      id: { type: 'bigint', nullable: false },
      tenant_id: { type: 'uuid', nullable: true },
      created_by_user_id: { type: 'uuid', nullable: true },
      license: { type: 'text', nullable: true },
      specialty: { type: 'text', nullable: true },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },
} as const;

export type ReferenceTable = keyof typeof REFERENCE_TABLES;
