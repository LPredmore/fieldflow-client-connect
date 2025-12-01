// Generic data fetching hooks
export { useSupabaseQuery } from './useSupabaseQuery';
export type { QueryOptions, QueryResult } from './useSupabaseQuery';

export { useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from './useSupabaseMutation';
export type { MutationOptions, MutationResult } from './useSupabaseMutation';

export { useSupabaseTable } from './useSupabaseTable';
export type { TableOptions, TableResult } from './useSupabaseTable';

// Optimized query hooks
export { useOptimizedStaffQuery, useOptimizedUserStaff, useOptimizedAvailableStaff, useOptimizedStaffProfiles, staffPreloadManager } from './useOptimizedStaffQuery';
export type { StaffQueryOptions, OptimizedStaffResult } from './useOptimizedStaffQuery';

export { useOptimizedCustomerQuery } from './useOptimizedCustomerQuery';