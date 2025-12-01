import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface MutationOptions {
  table: string;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  successMessage?: string;
  errorMessage?: string;
  userIdColumn?: string; // Column name for user ID (defaults to 'created_by_user_id')
  skipTenantId?: boolean; // Skip auto-adding tenant_id (defaults to false)
}

export interface MutationResult<T> {
  mutate: (data: T) => Promise<{ data?: any; error?: any }>;
  loading: boolean;
  error: string | null;
}

export function useSupabaseInsert<T = any>(options: MutationOptions): MutationResult<T> {
  const { 
    table, 
    onSuccess, 
    onError, 
    successMessage, 
    errorMessage, 
    userIdColumn = 'created_by_user_id', 
    skipTenantId = false
  } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, tenantId } = useAuth();
  const { toast } = useToast();

  const mutate = useCallback(async (data: T) => {
    if (!user) {
      const authError = 'User not authenticated';
      setError(authError);
      return { error: authError };
    }

    try {
      setLoading(true);
      setError(null);

      // Auto-add tenant_id and user_id column if not present
      const insertData = {
        ...data,
        ...(!skipTenantId && tenantId && !('tenant_id' in (data as any)) && { tenant_id: tenantId }),
        ...(!(userIdColumn in (data as any)) && { [userIdColumn]: user.id }),
      };

      const { data: result, error: insertError } = await supabase
        .from(table)
        .insert([insertData])
        .select()
        .single();

      if (insertError) {
        const errorMsg = errorMessage || insertError.message;
        setError(errorMsg);
        
        if (onError) {
          onError(insertError);
        } else {
          toast({
            variant: "destructive",
            title: `Error creating ${table.slice(0, -1)}`,
            description: errorMsg,
          });
        }
        return { error: insertError };
      }

      if (onSuccess) {
        onSuccess(result);
      } else if (successMessage) {
        toast({
          title: "Success",
          description: successMessage,
        });
      }

      return { data: result };
    } catch (err: any) {
      const errorMsg = errorMessage || err.message || 'An unexpected error occurred';
      setError(errorMsg);
      
      if (onError) {
        onError(err);
      } else {
        toast({
          variant: "destructive",
          title: `Error creating ${table.slice(0, -1)}`,
          description: errorMsg,
        });
      }
      return { error: err };
    } finally {
      setLoading(false);
    }
  }, [table, user, tenantId, onSuccess, onError, successMessage, errorMessage, toast, userIdColumn, skipTenantId]);

  return { mutate, loading, error };
}

export function useSupabaseUpdate<T = any>(options: MutationOptions & { idField?: string }): MutationResult<T & { id: string }> {
  const { 
    table, 
    idField = 'id', 
    onSuccess, 
    onError, 
    successMessage, 
    errorMessage
  } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const mutate = useCallback(async (data: T & { id: string }) => {
    if (!user) {
      const authError = 'User not authenticated';
      setError(authError);
      return { error: authError };
    }

    try {
      setLoading(true);
      setError(null);

      const { id, ...updateData } = data;
      
      // Auto-add updated_at if not present
      const finalUpdateData = {
        ...updateData,
        ...(!('updated_at' in updateData) && { updated_at: new Date().toISOString() }),
      };

      const { data: result, error: updateError } = await supabase
        .from(table)
        .update(finalUpdateData)
        .eq(idField, id)
        .select()
        .single();

      if (updateError) {
        const errorMsg = errorMessage || updateError.message;
        setError(errorMsg);
        
        if (onError) {
          onError(updateError);
        } else {
          toast({
            variant: "destructive",
            title: `Error updating ${table.slice(0, -1)}`,
            description: errorMsg,
          });
        }
        return { error: updateError };
      }

      if (onSuccess) {
        onSuccess(result);
      } else if (successMessage) {
        toast({
          title: "Success",
          description: successMessage,
        });
      }

      return { data: result };
    } catch (err: any) {
      const errorMsg = errorMessage || err.message || 'An unexpected error occurred';
      setError(errorMsg);
      
      if (onError) {
        onError(err);
      } else {
        toast({
          variant: "destructive",
          title: `Error updating ${table.slice(0, -1)}`,
          description: errorMsg,
        });
      }
      return { error: err };
    } finally {
      setLoading(false);
    }
  }, [table, idField, user, onSuccess, onError, successMessage, errorMessage, toast]);

  return { mutate, loading, error };
}

export function useSupabaseDelete(options: MutationOptions & { idField?: string }): MutationResult<string> {
  const { 
    table, 
    idField = 'id', 
    onSuccess, 
    onError, 
    successMessage, 
    errorMessage
  } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const mutate = useCallback(async (id: string) => {
    if (!user) {
      const authError = 'User not authenticated';
      setError(authError);
      return { error: authError };
    }

    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq(idField, id);

      if (deleteError) {
        const errorMsg = errorMessage || deleteError.message;
        setError(errorMsg);
        
        if (onError) {
          onError(deleteError);
        } else {
          toast({
            variant: "destructive",
            title: `Error deleting ${table.slice(0, -1)}`,
            description: errorMsg,
          });
        }
        return { error: deleteError };
      }

      if (onSuccess) {
        onSuccess(id);
      } else if (successMessage) {
        toast({
          title: "Success",
          description: successMessage,
        });
      }

      return { data: id };
    } catch (err: any) {
      const errorMsg = errorMessage || err.message || 'An unexpected error occurred';
      setError(errorMsg);
      
      if (onError) {
        onError(err);
      } else {
        toast({
          variant: "destructive",
          title: `Error deleting ${table.slice(0, -1)}`,
          description: errorMsg,
        });
      }
      return { error: err };
    } finally {
      setLoading(false);
    }
  }, [table, idField, user, onSuccess, onError, successMessage, errorMessage, toast]);

  return { mutate, loading, error };
}