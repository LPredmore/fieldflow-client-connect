import { useSupabaseQuery, QueryOptions } from './useSupabaseQuery';
import { useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete, MutationOptions } from './useSupabaseMutation';

export interface TableOptions<T> extends Omit<QueryOptions<T>, 'table'> {
  table: string;
  insertOptions?: Omit<MutationOptions, 'table'>;
  updateOptions?: Omit<MutationOptions, 'table'>;
  deleteOptions?: Omit<MutationOptions, 'table'>;
}

export interface TableResult<T, CreateT = Omit<T, 'id' | 'created_at' | 'updated_at'>, UpdateT = Partial<T>> {
  // Query
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  
  // Mutations
  create: (data: CreateT) => Promise<{ data?: T; error?: any }>;
  update: (data: UpdateT & { id: string }) => Promise<{ data?: T; error?: any }>;
  remove: (id: string) => Promise<{ data?: string; error?: any }>;
  
  // Mutation states
  createLoading: boolean;
  updateLoading: boolean;
  deleteLoading: boolean;
  
  // Mutation errors
  createError: string | null;
  updateError: string | null;
  deleteError: string | null;
}

export function useSupabaseTable<T = any, CreateT = Omit<T, 'id' | 'created_at' | 'updated_at'>, UpdateT = Partial<T>>(
  options: TableOptions<T>
): TableResult<T, CreateT, UpdateT> {
  const { table, insertOptions, updateOptions, deleteOptions, ...queryOptions } = options;

  // Query hook
  const query = useSupabaseQuery<T>({ table, ...queryOptions });

  // Mutation hooks
  const insert = useSupabaseInsert<CreateT>({
    table,
    onSuccess: (data) => {
      query.refetch(); // Refresh data after successful insert
      insertOptions?.onSuccess?.(data);
    },
    ...insertOptions,
  });

  const update = useSupabaseUpdate<UpdateT & { id: string }>({
    table,
    onSuccess: (data) => {
      query.refetch(); // Refresh data after successful update
      updateOptions?.onSuccess?.(data);
    },
    ...updateOptions,
  });

  const remove = useSupabaseDelete({
    table,
    onSuccess: (id) => {
      query.refetch(); // Refresh data after successful delete
      deleteOptions?.onSuccess?.(id);
    },
    ...deleteOptions,
  });

  // Note: No need to memoize here since useSupabaseQuery already memoizes its return value
  return {
    // Query results
    data: query.data || [],
    loading: query.loading,
    error: query.error,
    refetch: query.refetch,
    
    // Mutation functions
    create: insert.mutate,
    update: update.mutate,
    remove: remove.mutate,
    
    // Mutation loading states
    createLoading: insert.loading,
    updateLoading: update.loading,
    deleteLoading: remove.loading,
    
    // Mutation errors
    createError: insert.error,
    updateError: update.error,
    deleteError: remove.error,
  };
}