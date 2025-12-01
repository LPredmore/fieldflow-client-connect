// Generic data fetching hooks
export { useSupabaseQuery } from './useSupabaseQuery';
export type { QueryOptions, QueryResult } from './useSupabaseQuery';

export { useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from './useSupabaseMutation';
export type { MutationOptions, MutationResult } from './useSupabaseMutation';

export { useSupabaseTable } from './useSupabaseTable';
export type { TableOptions, TableResult } from './useSupabaseTable';

// Re-export for convenience
export * from './useSupabaseQuery';
export * from './useSupabaseMutation';
export * from './useSupabaseTable';