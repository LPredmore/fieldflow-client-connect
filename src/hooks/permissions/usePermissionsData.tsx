import { useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from '@/hooks/data/useSupabaseMutation';
import { useAuth } from '@/hooks/useAuth';
import { UserPermissions, getDefaultPermissions } from '@/utils/permissionUtils';

interface PermissionsRecord extends UserPermissions {
  id: string;
  user_id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

interface UsePermissionsDataOptions {
  userId?: string;
  enabled?: boolean;
}

export function usePermissionsData(options: UsePermissionsDataOptions = {}) {
  const { user, userRole, tenantId } = useAuth();
  const targetUserId = options.userId || user?.id;
  
  // Query permissions with automatic tenant filtering and caching
  const {
    data: permissionsArray,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<PermissionsRecord>({
    table: 'user_permissions',
    select: '*',
    filters: {
      user_id: targetUserId,
    },
    enabled: options.enabled !== false && !!targetUserId,
    staleTime: 300000, // Cache permissions for 5 minutes
  });

  // Extract permissions or use defaults
  const permissions = useMemo(() => {
    console.log('[usePermissionsData] Computing permissions:', {
      loading,
      hasPermissionsArray: !!permissionsArray,
      arrayLength: permissionsArray?.length,
      userRole
    });
    
    // While loading, return null to prevent premature permission checks
    if (loading) {
      console.log('[usePermissionsData] Still loading, returning null');
      return null;
    }
    
    if (permissionsArray && permissionsArray.length > 0) {
      const record = permissionsArray[0];
      const extracted = {
        access_appointments: record.access_appointments,
        access_services: record.access_services,
        access_invoicing: record.access_invoicing,
        access_forms: record.access_forms,
        supervisor: record.supervisor,
      };
      console.log('[usePermissionsData] Extracted permissions from DB:', extracted);
      return extracted;
    }
    
    // Return defaults based on role if no permissions found and not loading
    const defaults = getDefaultPermissions(userRole as 'staff' | 'client' | null);
    console.log('[usePermissionsData] Using default permissions for role:', { userRole, defaults });
    return defaults;
  }, [permissionsArray, userRole, loading]);

  // Create permissions mutation
  const {
    mutate: createPermissions,
    loading: createLoading,
    error: createError,
  } = useSupabaseInsert<Omit<PermissionsRecord, 'id' | 'created_at' | 'updated_at'>>({
    table: 'user_permissions',
    onSuccess: () => {
      refetch();
    },
    successMessage: 'Permissions created successfully',
  });

  // Update permissions mutation
  const {
    mutate: updatePermissions,
    loading: updateLoading,
    error: updateError,
  } = useSupabaseUpdate<Partial<UserPermissions> & { id: string }>({
    table: 'user_permissions',
    idField: 'id',
    onSuccess: () => {
      refetch();
    },
    successMessage: 'Permissions updated successfully',
  });

  // Delete permissions mutation
  const {
    mutate: deletePermissions,
    loading: deleteLoading,
    error: deleteError,
  } = useSupabaseDelete({
    table: 'user_permissions',
    onSuccess: () => {
      refetch();
    },
    successMessage: 'Permissions deleted successfully',
  });

  // Helper to create permissions for a user
  const create = async (userId: string, newPermissions: UserPermissions) => {
    if (!tenantId) throw new Error('No tenant ID available');
    
    return createPermissions({
      user_id: userId,
      tenant_id: tenantId,
      ...newPermissions,
    });
  };

  // Helper to update permissions
  const update = async (updates: Partial<UserPermissions>) => {
    if (!permissionsArray || permissionsArray.length === 0) {
      throw new Error('No permissions record found to update');
    }
    
    const record = permissionsArray[0];
    return updatePermissions({
      id: record.id,
      ...updates,
    });
  };

  // Helper to remove permissions (reset to defaults)
  const remove = async () => {
    if (!permissionsArray || permissionsArray.length === 0) {
      throw new Error('No permissions record found to delete');
    }
    
    const record = permissionsArray[0];
    return deletePermissions(record.id);
  };

  return {
    data: permissions,
    loading, // Only query loading - mutations don't affect read state
    error: error || createError || updateError || deleteError,
    mutating: createLoading || updateLoading || deleteLoading,
    create,
    update,
    remove,
    refetch,
    hasCustomPermissions: permissionsArray && permissionsArray.length > 0,
  };
}