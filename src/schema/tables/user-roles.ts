/**
 * User Roles Tables Schema
 * Single Source of Truth for authentication and authorization
 */

export const USER_ROLES_TABLES = {
  user_roles: {
    name: 'user_roles',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      user_id: { type: 'uuid', nullable: false },
      role: { type: 'app_role', nullable: false },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
    constraints: {
      unique: ['user_id', 'role'],
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
    constraints: {
      unique: ['code'],
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

export type UserRolesTable = keyof typeof USER_ROLES_TABLES;
