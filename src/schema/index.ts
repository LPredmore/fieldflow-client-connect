/**
 * Database Schema - Single Source of Truth
 * 
 * This is the central reference for all database structure in the application.
 * Generated from actual database schema on: 2025-12-01
 * 
 * Usage:
 * ```typescript
 * import { DB_ENUMS, APPOINTMENT_TABLES, CORE_PATIENT_TABLES } from '@/schema';
 * 
 * // Access enum values
 * const statuses = DB_ENUMS.appointment_status_enum;
 * 
 * // Access table structure
 * const appointmentColumns = APPOINTMENT_TABLES.appointments.columns;
 * 
 * // Access relationships
 * const clientRefs = DB_RELATIONSHIPS.clients;
 * ```
 */

// Enums
export * from './enums';

// Tables by domain
export * from './tables/core-patient';
export * from './tables/appointments';
export * from './tables/assessments';
export * from './tables/client-history';
export * from './tables/staff-provider';
export * from './tables/practice-org';
export * from './tables/reference';
export * from './tables/billing';
export * from './tables/era';
export * from './tables/payments';
export * from './tables/legacy';

// Relationships
export * from './relationships';

// Consolidated exports
import { DB_ENUMS } from './enums';
import { CORE_PATIENT_TABLES } from './tables/core-patient';
import { APPOINTMENT_TABLES } from './tables/appointments';
import { ASSESSMENT_TABLES } from './tables/assessments';
import { CLIENT_HISTORY_TABLES } from './tables/client-history';
import { STAFF_PROVIDER_TABLES } from './tables/staff-provider';
import { PRACTICE_ORG_TABLES } from './tables/practice-org';
import { REFERENCE_TABLES } from './tables/reference';
import { BILLING_TABLES } from './tables/billing';
import { ERA_TABLES } from './tables/era';
import { PAYMENTS_TABLES } from './tables/payments';
import { LEGACY_TABLES } from './tables/legacy';
import { DB_RELATIONSHIPS } from './relationships';

/**
 * Complete database schema consolidated
 */
export const DB_SCHEMA = {
  enums: DB_ENUMS,
  tables: {
    ...CORE_PATIENT_TABLES,
    ...APPOINTMENT_TABLES,
    ...ASSESSMENT_TABLES,
    ...CLIENT_HISTORY_TABLES,
    ...STAFF_PROVIDER_TABLES,
    ...PRACTICE_ORG_TABLES,
    ...REFERENCE_TABLES,
    ...BILLING_TABLES,
    ...ERA_TABLES,
    ...PAYMENTS_TABLES,
    ...LEGACY_TABLES,
  },
  relationships: DB_RELATIONSHIPS,
} as const;

/**
 * Database statistics
 */
export const DB_STATS = {
  totalTables: 50,
  totalEnums: 20,
  tablesWithRelationships: Object.keys(DB_RELATIONSHIPS).length,
  categories: {
    corePatient: Object.keys(CORE_PATIENT_TABLES).length,
    appointments: Object.keys(APPOINTMENT_TABLES).length,
    assessments: Object.keys(ASSESSMENT_TABLES).length,
    clientHistory: Object.keys(CLIENT_HISTORY_TABLES).length,
    staffProvider: Object.keys(STAFF_PROVIDER_TABLES).length,
    practiceOrg: Object.keys(PRACTICE_ORG_TABLES).length,
    reference: Object.keys(REFERENCE_TABLES).length,
    billing: Object.keys(BILLING_TABLES).length,
    era: Object.keys(ERA_TABLES).length,
    payments: Object.keys(PAYMENTS_TABLES).length,
    legacy: Object.keys(LEGACY_TABLES).length,
  },
} as const;
