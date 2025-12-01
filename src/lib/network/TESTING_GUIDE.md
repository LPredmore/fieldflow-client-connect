# Network Resilience System Testing Guide

## Overview

This guide provides comprehensive testing scenarios for the Network Resilience System to ensure it handles various network conditions gracefully.

## Manual Testing Scenarios

### 1. HTTP/2 Protocol Error Testing

```typescript
// Test HTTP/2 fallback mechanism
import { enhancedResilientClient } from '@/integrations/supabase/client';

// Force HTTP/2 error simulation
const testHttp2Fallback = async () => {
  console.log('Testing HTTP/2 fallback...');
  
  // Get initial diagnostics (shows GoTrueClient instance count)
  enhancedResilientClient.logDiagnostics();
  
  // Force fallback for testing
  await enhancedResilientClient.forceFallback();
  
  // Check diagnostics after fallback
  enhancedResilientClient.logDiagnostics();
  
  // Test operation with fallback client
  const result = await enhancedResilientClient.executeWithResilience(
    (client) => client.auth.getSession()
  );
  
  console.log('Operation result:', result);
};
```

### 2. Network Status Monitoring

```typescript
import { networkStatusMonitor } from '@/lib/network';

// Test network status detection
const testNetworkMonitoring = () => {
  console.log('Current status:', networkStatusMonitor.getStatus());
  console.log('Metrics:', networkStatusMonitor.getMetrics());
  
  // Listen for status changes
  const unsubscribe = networkStatusMonitor.addStatusListener((status) => {
    console.log('Status changed to:', status);
  });
  
  // Force health check
  networkStatusMonitor.forceHealthCheck();
  
  // Simulate offline
  Object.defineProperty(navigator, 'onLine', { value: false });
  window.dispatchEvent(new Event('offline'));
  
  // Simulate online
  setTimeout(() => {
    Object.defineProperty(navigator, 'onLine', { value: true });
    window.dispatchEvent(new Event('online'));
  }, 5000);
  
  // Cleanup
  setTimeout(() => unsubscribe(), 10000);
};
```

### 3. Cache System Testing

```typescript
import { cacheManager } from '@/lib/network';

// Test cache operations
const testCacheSystem = () => {
  console.log('Testing cache system...');
  
  // Test basic cache operations
  cacheManager.set('test_key', { message: 'Hello World' });
  console.log('Cached data:', cacheManager.get('test_key'));
  
  // Test user session caching
  cacheManager.cacheUserSession({
    userId: 'test-user',
    role: 'admin',
    permissions: ['read', 'write'],
    tenantId: 'test-tenant',
    isAdmin: true,
    isClinician: false,
    lastUpdated: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000
  });
  
  console.log('Cached session:', cacheManager.getCachedUserSession());
  
  // Test cache stats
  console.log('Cache stats:', cacheManager.getStats());
  
  // Test cleanup
  cacheManager.cleanup();
};
```

### 4. Retry Engine Testing

```typescript
import { retryEngine } from '@/lib/network';

// Test retry logic
const testRetryEngine = async () => {
  console.log('Testing retry engine...');
  
  let attemptCount = 0;
  
  try {
    const result = await retryEngine.executeWithRetry(async () => {
      attemptCount++;
      console.log(`Attempt ${attemptCount}`);
      
      if (attemptCount < 3) {
        throw new Error('ERR_CONNECTION_RESET');
      }
      
      return { success: true, attempt: attemptCount };
    });
    
    console.log('Success after retries:', result);
  } catch (error) {
    console.log('Failed after all retries:', error);
  }
};
```

### 5. Routing Protection Testing

```typescript
import { routingProtection } from '@/lib/network';

// Test redirect loop prevention
const testRoutingProtection = () => {
  console.log('Testing routing protection...');
  
  // Simulate rapid redirects
  for (let i = 0; i < 5; i++) {
    const allowed = routingProtection.canRedirect(`/page-${i}`, 'test_redirect');
    console.log(`Redirect ${i + 1} allowed:`, allowed);
  }
  
  console.log('Routing status:', routingProtection.getStatus());
  
  // Test force unblock
  routingProtection.forceUnblock();
  console.log('After force unblock:', routingProtection.getStatus());
};
```

### 6. Full System Integration Testing

```typescript
import { networkResilienceManager, getSystemHealth } from '@/lib/network';

// Test complete system
const testFullSystem = async () => {
  console.log('Testing full system integration...');
  
  // Get initial system health
  console.log('Initial health:', getSystemHealth());
  
  // Test query execution with caching
  const result = await networkResilienceManager.executeQuery(
    async (client) => {
      // Simulate a query that might fail
      if (Math.random() < 0.5) {
        throw new Error('ERR_NETWORK');
      }
      return { data: { message: 'Success!' }, error: null };
    },
    'test_query'
  );
  
  console.log('Query result:', result);
  
  // Force fallback mode
  networkResilienceManager.forceFallbackMode();
  
  // Test query in fallback mode
  const fallbackResult = await networkResilienceManager.executeQuery(
    async (client) => {
      throw new Error('Network unavailable');
    },
    'test_query'
  );
  
  console.log('Fallback result:', fallbackResult);
  
  // Get final system health
  console.log('Final health:', getSystemHealth());
};
```

## Automated Testing with Jest

### Unit Tests

```typescript
// __tests__/networkResilience.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CacheManager } from '../cacheManager';
import { RetryEngine } from '../retryEngine';
import { NetworkStatusMonitor } from '../networkStatusMonitor';

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
    localStorage.clear();
  });

  it('should store and retrieve data', () => {
    const testData = { message: 'test' };
    cacheManager.set('test_key', testData);
    
    const retrieved = cacheManager.get('test_key');
    expect(retrieved).toEqual(testData);
  });

  it('should handle expired data', () => {
    const testData = { message: 'test' };
    cacheManager.set('test_key', testData, 100); // 100ms expiration
    
    setTimeout(() => {
      const retrieved = cacheManager.get('test_key');
      expect(retrieved).toBeNull();
    }, 150);
  });
});

describe('RetryEngine', () => {
  let retryEngine: RetryEngine;

  beforeEach(() => {
    retryEngine = new RetryEngine();
  });

  it('should retry on retryable errors', async () => {
    let attempts = 0;
    
    const result = await retryEngine.executeWithRetry(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('ERR_CONNECTION_RESET');
      }
      return 'success';
    });

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should not retry on non-retryable errors', async () => {
    let attempts = 0;
    
    try {
      await retryEngine.executeWithRetry(async () => {
        attempts++;
        throw new Error('PERMISSION_DENIED');
      });
    } catch (error) {
      expect(attempts).toBe(1);
    }
  });
});
```

### Integration Tests

```typescript
// __tests__/integration.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NetworkResilienceManager } from '../networkResilienceManager';

describe('Network Resilience Integration', () => {
  let manager: NetworkResilienceManager;

  beforeEach(() => {
    manager = new NetworkResilienceManager();
  });

  it('should handle network failures gracefully', async () => {
    const result = await manager.executeQuery(
      async () => {
        throw new Error('ERR_NETWORK');
      },
      'test_cache_key'
    );

    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
    expect(result.source).toBe('network');
  });

  it('should return cached data on network failure', async () => {
    // First, cache some data
    await manager.executeQuery(
      async () => ({ data: { message: 'cached' }, error: null }),
      'test_cache_key'
    );

    // Then simulate network failure
    const result = await manager.executeQuery(
      async () => {
        throw new Error('ERR_NETWORK');
      },
      'test_cache_key'
    );

    expect(result.data).toEqual({ message: 'cached' });
    expect(result.source).toBe('fallback');
  });
});
```

## Browser DevTools Testing

### Console Commands

Add these to your browser console for manual testing:

```javascript
// Test network resilience system
window.testNetworkResilience = {
  // Force offline mode
  goOffline: () => {
    Object.defineProperty(navigator, 'onLine', { value: false });
    window.dispatchEvent(new Event('offline'));
  },
  
  // Force online mode
  goOnline: () => {
    Object.defineProperty(navigator, 'onLine', { value: true });
    window.dispatchEvent(new Event('online'));
  },
  
  // Get system status
  getStatus: () => {
    return window.networkResilienceManager?.getSystemStatus();
  },
  
  // Force fallback mode
  forceFallback: () => {
    window.networkResilienceManager?.forceFallbackMode();
  },
  
  // Test redirect protection
  testRedirects: () => {
    for (let i = 0; i < 5; i++) {
      console.log(`Redirect ${i}:`, window.routingProtection?.canRedirect(`/test-${i}`));
    }
  }
};
```

### Network Throttling

1. Open Chrome DevTools
2. Go to Network tab
3. Set throttling to "Slow 3G" or "Offline"
4. Test application behavior

### Application Tab Testing

1. Open Chrome DevTools
2. Go to Application tab
3. Check Local Storage for cached data
4. Clear storage and test offline functionality

## Performance Testing

### Load Testing

```typescript
// Test system under load
const performanceTest = async () => {
  const startTime = Date.now();
  const promises = [];
  
  // Create 100 concurrent requests
  for (let i = 0; i < 100; i++) {
    promises.push(
      networkResilienceManager.executeQuery(
        async (client) => ({ data: { id: i }, error: null }),
        `test_${i}`
      )
    );
  }
  
  const results = await Promise.all(promises);
  const endTime = Date.now();
  
  console.log(`Processed ${results.length} requests in ${endTime - startTime}ms`);
  console.log('Cache stats:', cacheManager.getStats());
};
```

### Memory Usage Testing

```typescript
// Monitor memory usage
const memoryTest = () => {
  const initialMemory = performance.memory?.usedJSHeapSize || 0;
  
  // Generate lots of cache entries
  for (let i = 0; i < 1000; i++) {
    cacheManager.set(`test_${i}`, { data: new Array(1000).fill(i) });
  }
  
  const afterCacheMemory = performance.memory?.usedJSHeapSize || 0;
  
  // Cleanup
  cacheManager.clear();
  
  const afterCleanupMemory = performance.memory?.usedJSHeapSize || 0;
  
  console.log('Memory usage:', {
    initial: initialMemory,
    afterCache: afterCacheMemory,
    afterCleanup: afterCleanupMemory,
    cacheImpact: afterCacheMemory - initialMemory,
    cleanupEffectiveness: afterCacheMemory - afterCleanupMemory
  });
};
```

## Error Simulation

### Network Error Simulation

```typescript
// Simulate various network errors
const simulateNetworkErrors = async () => {
  const errors = [
    'ERR_HTTP2_PROTOCOL_ERROR',
    'ERR_CONNECTION_RESET',
    'ERR_NETWORK',
    'TIMEOUT',
    'ECONNREFUSED'
  ];
  
  for (const errorType of errors) {
    console.log(`Testing error: ${errorType}`);
    
    try {
      await networkResilienceManager.executeQuery(
        async () => {
          throw new Error(errorType);
        },
        `error_test_${errorType}`
      );
    } catch (error) {
      console.log(`Error handled:`, error);
    }
  }
};
```

## Continuous Integration Testing

### GitHub Actions Example

```yaml
# .github/workflows/network-resilience-test.yml
name: Network Resilience Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm install
      
    - name: Run network resilience tests
      run: npm run test:network-resilience
      
    - name: Run integration tests
      run: npm run test:integration
      
    - name: Test offline scenarios
      run: npm run test:offline
```

This comprehensive testing guide ensures the Network Resilience System works correctly under various conditions and provides confidence in its reliability.