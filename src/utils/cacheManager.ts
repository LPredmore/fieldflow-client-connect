/**
 * CacheManager - Handles persistent storage for offline functionality
 * Implements encrypted local storage for sensitive user data with expiration and versioning
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: string;
}

interface CacheKeys {
  USER_AUTH: 'user_auth_v1';
  USER_PERMISSIONS: 'user_permissions_v1';
  USER_ROLE: 'user_role_v1';
  CLINICIAN_DATA: 'clinician_data_v1';
  TENANT_ID: 'tenant_id_v1';
}

interface CachedUserSession {
  userId: string;
  role: 'staff' | 'client' | null;
  permissions: {
    access_jobs?: boolean;
    access_customers?: boolean;
    access_services?: boolean;
    access_quotes?: boolean;
    access_invoicing?: boolean;
    access_calendar?: boolean;
    access_settings?: boolean;
    access_user_management?: boolean;
    send_quotes?: boolean;
    supervisor?: boolean;
  };
  tenantId: string | null;
  isAdmin: boolean;
  isClinician: boolean;
  lastUpdated: number;
  expiresAt: number;
}

interface ClinicianData {
  is_admin: boolean;
  is_clinician: boolean;
}

class CacheManager {
  private static instance: CacheManager;
  private readonly CACHE_VERSION = 'v1';
  // Removed unused ENCRYPTION_KEY

  // Cache expiration times (in milliseconds)
  private readonly CACHE_EXPIRATION = {
    USER_AUTH: 24 * 60 * 60 * 1000, // 24 hours
    USER_PERMISSIONS: 12 * 60 * 60 * 1000, // 12 hours
    USER_ROLE: 24 * 60 * 60 * 1000, // 24 hours
    CLINICIAN_DATA: 24 * 60 * 60 * 1000, // 24 hours
    TENANT_ID: 24 * 60 * 60 * 1000, // 24 hours
  };

  private readonly CACHE_KEYS: CacheKeys = {
    USER_AUTH: 'user_auth_v1',
    USER_PERMISSIONS: 'user_permissions_v1',
    USER_ROLE: 'user_role_v1',
    CLINICIAN_DATA: 'clinician_data_v1',
    TENANT_ID: 'tenant_id_v1',
  };

  private constructor() {
    this.cleanupExpiredEntries();
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Simple encryption for sensitive data (basic obfuscation)
   * In production, consider using a more robust encryption library
   */
  private encrypt(data: string): string {
    try {
      return btoa(data);
    } catch (error) {
      console.error('[CacheManager] Encryption failed:', error);
      return data;
    }
  }

  /**
   * Simple decryption for sensitive data
   */
  private decrypt(encryptedData: string): string {
    try {
      return atob(encryptedData);
    } catch (error) {
      console.error('[CacheManager] Decryption failed:', error);
      return encryptedData;
    }
  }

  /**
   * Store data in cache with expiration and versioning
   */
  public set<T>(key: keyof CacheKeys, data: T, customExpiration?: number): void {
    try {
      const now = Date.now();
      const expiration = customExpiration || this.CACHE_EXPIRATION[key];
      
      const cacheEntry: CacheEntry<T> = {
        data,
        timestamp: now,
        expiresAt: now + expiration,
        version: this.CACHE_VERSION,
      };

      const serialized = JSON.stringify(cacheEntry);
      const encrypted = this.encrypt(serialized);
      
      localStorage.setItem(this.CACHE_KEYS[key], encrypted);
      
      console.log(`[CacheManager] Cached ${key} with expiration:`, new Date(cacheEntry.expiresAt));
    } catch (error) {
      console.error(`[CacheManager] Failed to cache ${key}:`, error);
    }
  }

  /**
   * Retrieve data from cache if valid and not expired
   */
  public get<T>(key: keyof CacheKeys): T | null {
    try {
      const encrypted = localStorage.getItem(this.CACHE_KEYS[key]);
      if (!encrypted) {
        return null;
      }

      const decrypted = this.decrypt(encrypted);
      const cacheEntry: CacheEntry<T> = JSON.parse(decrypted);

      // Check version compatibility
      if (cacheEntry.version !== this.CACHE_VERSION) {
        console.log(`[CacheManager] Version mismatch for ${key}, clearing cache`);
        this.remove(key);
        return null;
      }

      // Check expiration
      if (Date.now() > cacheEntry.expiresAt) {
        console.log(`[CacheManager] Cache expired for ${key}`);
        this.remove(key);
        return null;
      }

      console.log(`[CacheManager] Retrieved valid cache for ${key}`);
      return cacheEntry.data;
    } catch (error) {
      console.error(`[CacheManager] Failed to retrieve ${key}:`, error);
      this.remove(key);
      return null;
    }
  }

  /**
   * Remove specific cache entry
   */
  public remove(key: keyof CacheKeys): void {
    try {
      localStorage.removeItem(this.CACHE_KEYS[key]);
      console.log(`[CacheManager] Removed cache for ${key}`);
    } catch (error) {
      console.error(`[CacheManager] Failed to remove ${key}:`, error);
    }
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    try {
      Object.values(this.CACHE_KEYS).forEach(cacheKey => {
        localStorage.removeItem(cacheKey);
      });
      console.log('[CacheManager] Cleared all cache entries');
    } catch (error) {
      console.error('[CacheManager] Failed to clear cache:', error);
    }
  }

  /**
   * Check if cache entry exists and is valid
   */
  public has(key: keyof CacheKeys): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get cache entry metadata without retrieving data
   */
  public getMetadata(key: keyof CacheKeys): { timestamp: number; expiresAt: number; version: string } | null {
    try {
      const encrypted = localStorage.getItem(this.CACHE_KEYS[key]);
      if (!encrypted) {
        return null;
      }

      const decrypted = this.decrypt(encrypted);
      const cacheEntry: CacheEntry<any> = JSON.parse(decrypted);

      return {
        timestamp: cacheEntry.timestamp,
        expiresAt: cacheEntry.expiresAt,
        version: cacheEntry.version,
      };
    } catch (error) {
      console.error(`[CacheManager] Failed to get metadata for ${key}:`, error);
      return null;
    }
  }

  /**
   * Clean up expired cache entries
   */
  public cleanupExpiredEntries(): void {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      Object.keys(this.CACHE_KEYS).forEach(key => {
        const cacheKey = key as keyof CacheKeys;
        const metadata = this.getMetadata(cacheKey);
        
        if (metadata && now > metadata.expiresAt) {
          this.remove(cacheKey);
          cleanedCount++;
        }
      });

      if (cleanedCount > 0) {
        console.log(`[CacheManager] Cleaned up ${cleanedCount} expired cache entries`);
      }
    } catch (error) {
      console.error('[CacheManager] Failed to cleanup expired entries:', error);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  public getStats(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
    totalSize: number;
  } {
    let totalEntries = 0;
    let validEntries = 0;
    let expiredEntries = 0;
    let totalSize = 0;

    try {
      const now = Date.now();

      Object.keys(this.CACHE_KEYS).forEach(key => {
        const cacheKey = key as keyof CacheKeys;
        const encrypted = localStorage.getItem(this.CACHE_KEYS[cacheKey]);
        
        if (encrypted) {
          totalEntries++;
          totalSize += encrypted.length;

          const metadata = this.getMetadata(cacheKey);
          if (metadata) {
            if (now > metadata.expiresAt) {
              expiredEntries++;
            } else {
              validEntries++;
            }
          }
        }
      });
    } catch (error) {
      console.error('[CacheManager] Failed to get stats:', error);
    }

    return {
      totalEntries,
      validEntries,
      expiredEntries,
      totalSize,
    };
  }

  /**
   * Cache complete user session data
   */
  public cacheUserSession(sessionData: CachedUserSession): void {
    this.set('USER_AUTH', {
      userId: sessionData.userId,
      role: sessionData.role,
      tenantId: sessionData.tenantId,
      lastUpdated: sessionData.lastUpdated,
      expiresAt: sessionData.expiresAt,
    });

    this.set('USER_PERMISSIONS', sessionData.permissions);
    this.set('USER_ROLE', sessionData.role);
    this.set('TENANT_ID', sessionData.tenantId);
    
    if (sessionData.isAdmin || sessionData.isClinician) {
      this.set('CLINICIAN_DATA', {
        is_admin: sessionData.isAdmin,
        is_clinician: sessionData.isClinician,
      });
    }
  }

  /**
   * Retrieve complete cached user session
   */
  public getCachedUserSession(): CachedUserSession | null {
    try {
      const authData = this.get<{
        userId: string;
        role: 'staff' | 'client' | null;
        tenantId: string | null;
        lastUpdated: number;
        expiresAt: number;
      }>('USER_AUTH');

      if (!authData) {
        return null;
      }

      const permissions = this.get<CachedUserSession['permissions']>('USER_PERMISSIONS') || {};
      const clinicianData = this.get<ClinicianData>('CLINICIAN_DATA');

      return {
        userId: authData.userId,
        role: authData.role,
        permissions,
        tenantId: authData.tenantId,
        isAdmin: clinicianData?.is_admin || false,
        isClinician: clinicianData?.is_clinician || false,
        lastUpdated: authData.lastUpdated,
        expiresAt: authData.expiresAt,
      };
    } catch (error) {
      console.error('[CacheManager] Failed to get cached user session:', error);
      return null;
    }
  }

  /**
   * Invalidate user session cache
   */
  public invalidateUserSession(): void {
    this.remove('USER_AUTH');
    this.remove('USER_PERMISSIONS');
    this.remove('USER_ROLE');
    this.remove('CLINICIAN_DATA');
    this.remove('TENANT_ID');
    console.log('[CacheManager] Invalidated user session cache');
  }
}

export const cacheManager = CacheManager.getInstance();
export type { CachedUserSession, ClinicianData };