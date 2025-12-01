/**
 * IndexedDB Cache Manager
 * 
 * Provides persistent caching using IndexedDB for offline-first functionality.
 * Supports TTL, versioning, and intelligent cache invalidation.
 */

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  version: number;
  metadata: {
    queryKey: string;
    userId?: string;
    tenantId?: string;
    tags?: string[];
  };
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (default: 1 hour)
  staleWhileRevalidate?: boolean; // Return stale data while fetching fresh
  priority?: 'critical' | 'high' | 'medium' | 'low';
  tags?: string[]; // Tags for bulk invalidation
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  oldestEntry: number;
  newestEntry: number;
  hitRate: number;
}

const DB_NAME = 'AppCache';
const DB_VERSION = 1;
const STORES = {
  QUERIES: 'queries',
  AUTH: 'auth',
  MUTATIONS: 'mutations'
} as const;

/**
 * IndexedDB Cache Manager
 * 
 * Manages persistent cache storage with automatic cleanup and versioning
 */
export class IndexedDBCacheManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private cacheHits = 0;
  private cacheMisses = 0;
  private readonly DEFAULT_TTL = 3600000; // 1 hour
  private readonly MAX_CACHE_SIZE = 52428800; // 50MB
  private readonly CLEANUP_INTERVAL = 3600000; // 1 hour

  constructor() {
    this.initPromise = this.initialize();
    this.startPeriodicCleanup();
  }

  /**
   * Initialize IndexedDB
   */
  private async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[IndexedDBCache] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IndexedDBCache] Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create queries store
        if (!db.objectStoreNames.contains(STORES.QUERIES)) {
          const queriesStore = db.createObjectStore(STORES.QUERIES, { keyPath: 'key' });
          queriesStore.createIndex('queryKey', 'metadata.queryKey', { unique: false });
          queriesStore.createIndex('userId', 'metadata.userId', { unique: false });
          queriesStore.createIndex('timestamp', 'timestamp', { unique: false });
          queriesStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        // Create auth store
        if (!db.objectStoreNames.contains(STORES.AUTH)) {
          const authStore = db.createObjectStore(STORES.AUTH, { keyPath: 'key' });
          authStore.createIndex('userId', 'metadata.userId', { unique: false });
          authStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create mutations store
        if (!db.objectStoreNames.contains(STORES.MUTATIONS)) {
          const mutationsStore = db.createObjectStore(STORES.MUTATIONS, { keyPath: 'key', autoIncrement: true });
          mutationsStore.createIndex('userId', 'metadata.userId', { unique: false });
          mutationsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        console.log('[IndexedDBCache] Database schema created');
      };
    });
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Get cached data
   */
  async get<T>(key: string, storeName: string = STORES.QUERIES): Promise<CacheEntry<T> | null> {
    await this.ensureInitialized();

    if (!this.db) {
      console.warn('[IndexedDBCache] Database not available');
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;

        if (!entry) {
          this.cacheMisses++;
          console.log(`[IndexedDBCache] Cache MISS: ${key}`);
          resolve(null);
          return;
        }

        // Check if entry is expired
        if (Date.now() > entry.expiresAt) {
          this.cacheMisses++;
          console.log(`[IndexedDBCache] Cache EXPIRED: ${key} (age: ${Date.now() - entry.timestamp}ms)`);
          // Delete expired entry
          this.delete(key, storeName).catch(console.error);
          resolve(null);
          return;
        }

        this.cacheHits++;
        const age = Date.now() - entry.timestamp;
        console.log(`[IndexedDBCache] Cache HIT: ${key} (age: ${age}ms)`);
        resolve(entry);
      };

      request.onerror = () => {
        console.error('[IndexedDBCache] Error getting cache entry:', request.error);
        this.cacheMisses++;
        reject(request.error);
      };
    });
  }

  /**
   * Set cached data
   */
  async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {},
    storeName: string = STORES.QUERIES
  ): Promise<void> {
    await this.ensureInitialized();

    if (!this.db) {
      console.warn('[IndexedDBCache] Database not available');
      return;
    }

    const ttl = options.ttl || this.DEFAULT_TTL;
    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      version: DB_VERSION,
      metadata: {
        queryKey: key,
        tags: options.tags || []
      }
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(entry);

      request.onsuccess = () => {
        console.log(`[IndexedDBCache] Cached: ${key} (TTL: ${ttl}ms)`);
        resolve();
      };

      request.onerror = () => {
        console.error('[IndexedDBCache] Error setting cache entry:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete cached data
   */
  async delete(key: string, storeName: string = STORES.QUERIES): Promise<void> {
    await this.ensureInitialized();

    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        console.log(`[IndexedDBCache] Deleted: ${key}`);
        resolve();
      };

      request.onerror = () => {
        console.error('[IndexedDBCache] Error deleting cache entry:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Invalidate cache entries matching pattern
   */
  async invalidate(pattern: string | RegExp, storeName: string = STORES.QUERIES): Promise<number> {
    await this.ensureInitialized();

    if (!this.db) {
      return 0;
    }

    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;

        if (cursor) {
          const entry = cursor.value as CacheEntry;
          if (regex.test(entry.key)) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          console.log(`[IndexedDBCache] Invalidated ${deletedCount} entries matching pattern: ${pattern}`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        console.error('[IndexedDBCache] Error invalidating cache:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[], storeName: string = STORES.QUERIES): Promise<number> {
    await this.ensureInitialized();

    if (!this.db) {
      return 0;
    }

    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;

        if (cursor) {
          const entry = cursor.value as CacheEntry;
          const entryTags = entry.metadata.tags || [];
          
          // Check if any of the provided tags match
          if (tags.some(tag => entryTags.includes(tag))) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          console.log(`[IndexedDBCache] Invalidated ${deletedCount} entries with tags: ${tags.join(', ')}`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        console.error('[IndexedDBCache] Error invalidating cache by tags:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get stale data (even if expired)
   */
  async getStaleData<T>(key: string, maxAge: number, storeName: string = STORES.QUERIES): Promise<T | null> {
    await this.ensureInitialized();

    if (!this.db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        const age = Date.now() - entry.timestamp;
        
        if (age > maxAge) {
          console.log(`[IndexedDBCache] Data too stale: ${key} (age: ${age}ms, max: ${maxAge}ms)`);
          resolve(null);
          return;
        }

        console.log(`[IndexedDBCache] Returning stale data: ${key} (age: ${age}ms)`);
        resolve(entry.data);
      };

      request.onerror = () => {
        console.error('[IndexedDBCache] Error getting stale data:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clean up expired entries
   */
  async cleanup(storeName: string = STORES.QUERIES): Promise<number> {
    await this.ensureInitialized();

    if (!this.db) {
      return 0;
    }

    const now = Date.now();
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index('expiresAt');
      const request = index.openCursor(IDBKeyRange.upperBound(now));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;

        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          if (deletedCount > 0) {
            console.log(`[IndexedDBCache] Cleaned up ${deletedCount} expired entries`);
          }
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        console.error('[IndexedDBCache] Error during cleanup:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all cache entries
   */
  async clear(storeName: string = STORES.QUERIES): Promise<void> {
    await this.ensureInitialized();

    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        console.log(`[IndexedDBCache] Cleared all entries from ${storeName}`);
        resolve();
      };

      request.onerror = () => {
        console.error('[IndexedDBCache] Error clearing cache:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(storeName: string = STORES.QUERIES): Promise<CacheStats> {
    await this.ensureInitialized();

    if (!this.db) {
      return {
        totalEntries: 0,
        totalSize: 0,
        oldestEntry: 0,
        newestEntry: 0,
        hitRate: 0
      };
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.openCursor();

      let totalEntries = 0;
      let totalSize = 0;
      let oldestEntry = Infinity;
      let newestEntry = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;

        if (cursor) {
          const entry = cursor.value as CacheEntry;
          totalEntries++;
          totalSize += JSON.stringify(entry.data).length;
          oldestEntry = Math.min(oldestEntry, entry.timestamp);
          newestEntry = Math.max(newestEntry, entry.timestamp);
          cursor.continue();
        } else {
          const totalRequests = this.cacheHits + this.cacheMisses;
          const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

          resolve({
            totalEntries,
            totalSize,
            oldestEntry: oldestEntry === Infinity ? 0 : oldestEntry,
            newestEntry,
            hitRate
          });
        }
      };

      request.onerror = () => {
        console.error('[IndexedDBCache] Error getting stats:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanup().catch(error => {
        console.error('[IndexedDBCache] Periodic cleanup failed:', error);
      });
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[IndexedDBCache] Database connection closed');
    }
  }
}

// Export singleton instance
export const indexedDBCache = new IndexedDBCacheManager();
