/**
 * Auth Cache Service - Stub Implementation
 */
export const authCacheService = {
  getUserPermissions: async (_userId: string) => null,
  cacheAuthData: async (_userId: string) => {},
  setNetworkHealth: (_healthy: boolean) => {},
  getCacheStatus: () => ({ isHealthy: true, lastSync: Date.now() })
};
