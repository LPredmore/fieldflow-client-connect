/**
 * SessionCacheService
 * 
 * Manages cached user data for the session duration.
 * Uses in-memory Map for fast access and sessionStorage for persistence.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7
 */

import { authLogger, AuthLogCategory } from './AuthLogger';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class SessionCacheService {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private readonly STORAGE_PREFIX = 'auth_cache_';
  private readonly DEFAULT_TTL = 3600000; // 1 hour

  /**
   * Set a value in the cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds (optional)
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttl ?? this.DEFAULT_TTL
    };

    // Store in memory
    this.memoryCache.set(key, entry);

    authLogger.logCache('Cache set', {
      key,
      ttl: entry.ttl,
      memoryCacheSize: this.memoryCache.size
    });

    // Sync to sessionStorage
    try {
      sessionStorage.setItem(
        this.getStorageKey(key),
        JSON.stringify(entry)
      );
    } catch (error) {
      authLogger.logError(AuthLogCategory.CACHE, 'Failed to sync to sessionStorage', error as Error, { key });
    }
  }

  /**
   * Get a value from the cache
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): T | null {
    // Try memory cache first
    let entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    let source = 'memory';

    // If not in memory, try sessionStorage
    if (!entry) {
      entry = this.loadFromStorage<T>(key);
      if (entry) {
        // Restore to memory cache
        this.memoryCache.set(key, entry);
        source = 'sessionStorage';
      }
    }

    if (!entry) {
      authLogger.logCache('Cache miss', { key });
      return null;
    }

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      authLogger.logCache('Cache expired', { key, age, ttl: entry.ttl });
      this.delete(key);
      return null;
    }

    authLogger.logCache('Cache hit', { key, source, age });
    return entry.value;
  }

  /**
   * Check if a key exists in the cache (and is not expired)
   * @param key - Cache key
   * @returns true if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a value from the cache
   * @param key - Cache key
   */
  delete(key: string): void {
    this.memoryCache.delete(key);
    authLogger.logCache('Cache delete', { key });
    
    try {
      sessionStorage.removeItem(this.getStorageKey(key));
    } catch (error) {
      authLogger.logError(AuthLogCategory.CACHE, 'Failed to remove from sessionStorage', error as Error, { key });
    }
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    const cacheSize = this.memoryCache.size;
    this.memoryCache.clear();
    authLogger.logCache('Cache cleared', { clearedItems: cacheSize });

    // Clear all auth cache items from sessionStorage
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(this.STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      authLogger.logError(AuthLogCategory.CACHE, 'Failed to clear sessionStorage', error as Error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memoryCacheSize: number;
    keys: string[];
  } {
    return {
      memoryCacheSize: this.memoryCache.size,
      keys: Array.from(this.memoryCache.keys())
    };
  }

  /**
   * Load entry from sessionStorage
   */
  private loadFromStorage<T>(key: string): CacheEntry<T> | null {
    try {
      const stored = sessionStorage.getItem(this.getStorageKey(key));
      if (!stored) {
        return null;
      }

      const entry = JSON.parse(stored) as CacheEntry<T>;
      
      // Validate entry structure
      if (!entry || typeof entry.timestamp !== 'number' || typeof entry.ttl !== 'number') {
        authLogger.logError(AuthLogCategory.CACHE, 'Invalid cache entry structure', undefined, { key });
        return null;
      }

      return entry;
    } catch (error) {
      authLogger.logError(AuthLogCategory.CACHE, 'Failed to load from sessionStorage', error as Error, { key });
      return null;
    }
  }

  /**
   * Get storage key with prefix
   */
  private getStorageKey(key: string): string {
    return `${this.STORAGE_PREFIX}${key}`;
  }

  /**
   * Generate cache key for user data
   */
  static userKey(userId: string): string {
    return `user:${userId}`;
  }

  /**
   * Generate cache key for role context
   */
  static roleKey(userId: string): string {
    return `role:${userId}`;
  }

  /**
   * Generate cache key for permissions
   */
  static permissionsKey(userId: string): string {
    return `permissions:${userId}`;
  }

  /**
   * Generate cache key for profile
   */
  static profileKey(userId: string): string {
    return `profile:${userId}`;
  }

  /**
   * Generate cache key for clinician data
   */
  static clinicianKey(userId: string): string {
    return `clinician:${userId}`;
  }
}

// Export singleton instance
export const sessionCacheService = new SessionCacheService();
