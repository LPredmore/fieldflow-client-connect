/**
 * Role Cache Invalidation Hook
 * 
 * Centralized cache invalidation for user roles across all caching layers:
 * - SessionCacheService
 * - UnifiedRoleDetectionService
 * - React Query cache
 */

import { useQueryClient } from '@tanstack/react-query';
import { sessionCacheService } from '@/services/auth/SessionCacheService';
import { unifiedRoleDetectionService } from '@/services/auth/UnifiedRoleDetectionService';

export function useRoleCacheInvalidation() {
  const queryClient = useQueryClient();

  const invalidateUserRole = (userId: string) => {
    // 1. Invalidate session cache
    unifiedRoleDetectionService.invalidateCache(userId);

    // 2. Invalidate React Query caches
    queryClient.invalidateQueries({ queryKey: ['profiles'] });
    queryClient.invalidateQueries({ queryKey: ['user_roles'] });
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    queryClient.invalidateQueries({ queryKey: ['user_permissions'] });
  };

  const invalidateAllRoles = () => {
    // Clear all session caches
    sessionCacheService.clear();

    // Invalidate all React Query caches
    queryClient.invalidateQueries({ queryKey: ['profiles'] });
    queryClient.invalidateQueries({ queryKey: ['user_roles'] });
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    queryClient.invalidateQueries({ queryKey: ['user_permissions'] });
  };

  return {
    invalidateUserRole,
    invalidateAllRoles,
  };
}
