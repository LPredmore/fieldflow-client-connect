import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissionsData } from '@/hooks/permissions/usePermissionsData';
import { UserPermissions, getDefaultPermissions } from '@/utils/permissionUtils';

/**
 * Legacy usePermissions hook - maintained for backward compatibility
 * For new code, prefer using usePermissionsData or PermissionProvider
 */
export function usePermissions() {
  const { user, userRole } = useAuth();
  
  // Use the new data layer hook
  const {
    data: permissions,
    loading,
    error,
    create,
    update,
    refetch,
  } = usePermissionsData();

  // Legacy fetchPermissions method for backward compatibility
  const fetchPermissions = useCallback(async (userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('access_appointments, access_services, access_invoicing, access_forms, supervisor')
        .eq('user_id', targetUserId)
        .single();

      if (error) {
        // If no permissions found, return defaults
        if (error.code === 'PGRST116') {
          return getDefaultPermissions(userRole as 'staff' | 'client' | null);
        } else {
          console.error('Error loading permissions:', error);
          return getDefaultPermissions(userRole as 'staff' | 'client' | null);
        }
      }

      return data;
    } catch (error: any) {
      console.error('Error loading permissions:', error);
      return getDefaultPermissions(userRole as 'staff' | 'client' | null);
    }
  }, [user, userRole]);

  // Legacy updatePermissions method for backward compatibility
  const updatePermissions = async (userId: string, updates: Partial<UserPermissions>) => {
    const result = await update(updates);
    
    // If updating current user's permissions, refresh local state
    if (userId === user?.id) {
      refetch();
    }
    
    return result;
  };

  // Legacy createPermissions method for backward compatibility
  const createPermissions = async (userId: string, tenantId: string, newPermissions: UserPermissions) => {
    return create(userId, newPermissions);
  };

  return {
    permissions,
    loading,
    error,
    updatePermissions,
    createPermissions,
    refetchPermissions: fetchPermissions,
  };
}