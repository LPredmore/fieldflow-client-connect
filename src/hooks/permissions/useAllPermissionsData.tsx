import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from '@/hooks/data/useSupabaseMutation';
import { useAuth } from '@/hooks/useAuth';
import { UserPermissions } from '@/utils/permissionUtils';

interface PermissionsRecord extends UserPermissions {
  id: string;
  user_id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

interface UseAllPermissionsDataOptions {
  enabled?: boolean;
}

export function useAllPermissionsData(options: UseAllPermissionsDataOptions = {}) {
  const { tenantId } = useAuth();
  
  // Query all permissions for the current tenant
  const {
    data: permissionsRecords,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<PermissionsRecord>({
    table: 'user_permissions',
    select: '*',
    filters: {
      tenant_id: tenantId,
    },
    enabled: options.enabled !== false && !!tenantId,
  });

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

  // Helper to update permissions by user ID
  const updateByUserId = async (userId: string, updates: Partial<UserPermissions>) => {
    const userRecord = permissionsRecords?.find(record => record.user_id === userId);
    if (!userRecord) {
      throw new Error(`No permissions record found for user ${userId}`);
    }
    
    return updatePermissions({
      id: userRecord.id,
      ...updates,
    });
  };

  // Helper to remove permissions by user ID
  const removeByUserId = async (userId: string) => {
    const userRecord = permissionsRecords?.find(record => record.user_id === userId);
    if (!userRecord) {
      throw new Error(`No permissions record found for user ${userId}`);
    }
    
    return deletePermissions(userRecord.id);
  };

  // Helper to get permissions for a specific user
  const getPermissionsForUser = (userId: string): UserPermissions | null => {
    const userRecord = permissionsRecords?.find(record => record.user_id === userId);
    if (!userRecord) return null;
    
    return {
      access_appointments: userRecord.access_appointments,
      access_services: userRecord.access_services,
      access_invoicing: userRecord.access_invoicing,
      access_forms: userRecord.access_forms,
      supervisor: userRecord.supervisor,
    };
  };

  return {
    data: permissionsRecords || [],
    loading: loading || createLoading || updateLoading || deleteLoading,
    error: error || createError || updateError || deleteError,
    create,
    updateByUserId,
    removeByUserId,
    getPermissionsForUser,
    refetch,
  };
}