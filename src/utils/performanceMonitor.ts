/**
 * Development-only performance monitoring utility
 * Tracks component lifecycle, query performance, and cache efficiency
 */

interface ComponentMetrics {
  mountCount: number;
  unmountCount: number;
  renderCount: number;
  firstMount: number;
  lastMount: number;
  lastUnmount: number;
}

interface QueryMetrics {
  executionCount: number;
  cacheHits: number;
  cacheMisses: number;
  totalDuration: number;
  avgDuration: number;
  lastExecution: number;
  firstExecution: number;
}

class PerformanceMonitor {
  private components = new Map<string, ComponentMetrics>();
  private queries = new Map<string, QueryMetrics>();
  private queryStartTimes = new Map<string, number>();
  private enabled = import.meta.env.DEV;

  // Component lifecycle tracking
  trackComponentMount(componentName: string): void {
    if (!this.enabled) return;

    const now = Date.now();
    const metrics = this.components.get(componentName) || {
      mountCount: 0,
      unmountCount: 0,
      renderCount: 0,
      firstMount: now,
      lastMount: now,
      lastUnmount: 0,
    };

    metrics.mountCount++;
    metrics.lastMount = now;

    this.components.set(componentName, metrics);

    // Check for excessive re-mounting
    const timeSinceFirst = now - metrics.firstMount;
    if (metrics.mountCount > 3 && timeSinceFirst < 5000) {
      console.warn(
        `⚠️ [Performance] ${componentName} has mounted ${metrics.mountCount} times in ${timeSinceFirst}ms. This may indicate an issue with component stability.`
      );
    }
  }

  trackComponentUnmount(componentName: string): void {
    if (!this.enabled) return;

    const now = Date.now();
    const metrics = this.components.get(componentName);
    if (!metrics) return;

    metrics.unmountCount++;
    metrics.lastUnmount = now;

    this.components.set(componentName, metrics);
  }

  trackRender(componentName: string): void {
    if (!this.enabled) return;

    const now = Date.now();
    const metrics = this.components.get(componentName);
    if (!metrics) return;

    metrics.renderCount++;
    this.components.set(componentName, metrics);

    // Check for excessive re-renders
    const timeSinceMount = now - metrics.lastMount;
    if (metrics.renderCount > 10 && timeSinceMount < 5000) {
      console.warn(
        `⚠️ [Performance] ${componentName} has rendered ${metrics.renderCount} times in ${timeSinceMount}ms since last mount. Consider memoization.`
      );
    }
  }

  // Query performance tracking
  trackQueryStart(queryKey: string): string {
    if (!this.enabled) return queryKey;

    const now = Date.now();
    const executionId = `${queryKey}-${now}`;
    this.queryStartTimes.set(executionId, now);

    const metrics = this.queries.get(queryKey) || {
      executionCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalDuration: 0,
      avgDuration: 0,
      lastExecution: now,
      firstExecution: now,
    };

    metrics.executionCount++;
    metrics.lastExecution = now;

    this.queries.set(queryKey, metrics);

    // Check for excessive query frequency
    const timeSinceFirst = now - metrics.firstExecution;
    if (metrics.executionCount > 5 && timeSinceFirst < 10000) {
      console.warn(
        `⚠️ [Performance] Query "${queryKey}" has executed ${metrics.executionCount} times in ${timeSinceFirst}ms. Consider increasing staleTime or throttleMs.`
      );
    }

    return executionId;
  }

  trackQueryEnd(executionId: string, queryKey: string, fromCache: boolean): void {
    if (!this.enabled) return;

    const startTime = this.queryStartTimes.get(executionId);
    if (!startTime) return;

    const duration = Date.now() - startTime;
    this.queryStartTimes.delete(executionId);

    const metrics = this.queries.get(queryKey);
    if (!metrics) return;

    if (fromCache) {
      metrics.cacheHits++;
    } else {
      metrics.cacheMisses++;
      metrics.totalDuration += duration;
      metrics.avgDuration = metrics.totalDuration / metrics.cacheMisses;

      // Warn about slow queries
      if (duration > 1000) {
        console.warn(
          `⚠️ [Performance] Query "${queryKey}" took ${duration}ms. Consider optimizing the query or adding indexes.`
        );
      }
    }

    this.queries.set(queryKey, metrics);
  }

  // Cache efficiency metrics
  getCacheHitRate(queryKey?: string): number {
    if (!this.enabled) return 0;

    if (queryKey) {
      const metrics = this.queries.get(queryKey);
      if (!metrics) return 0;
      const total = metrics.cacheHits + metrics.cacheMisses;
      return total > 0 ? (metrics.cacheHits / total) * 100 : 0;
    }

    // Overall cache hit rate
    let totalHits = 0;
    let totalMisses = 0;
    this.queries.forEach((metrics) => {
      totalHits += metrics.cacheHits;
      totalMisses += metrics.cacheMisses;
    });
    const total = totalHits + totalMisses;
    return total > 0 ? (totalHits / total) * 100 : 0;
  }

  // Get all metrics
  getMetrics() {
    if (!this.enabled) return null;

    return {
      components: Object.fromEntries(this.components),
      queries: Object.fromEntries(this.queries),
      cacheHitRate: this.getCacheHitRate(),
    };
  }

  // Check for performance issues
  checkForIssues(): void {
    if (!this.enabled) return;

    const overallCacheHitRate = this.getCacheHitRate();
    if (overallCacheHitRate < 50 && this.queries.size > 0) {
      console.warn(
        `⚠️ [Performance] Overall cache hit rate is ${overallCacheHitRate.toFixed(1)}%. Consider increasing staleTime values.`
      );
    }

    // Log summary in development
    console.log('📊 [Performance Summary]', this.getMetrics());
  }

  // Reset all metrics (useful for testing)
  reset(): void {
    if (!this.enabled) return;
    this.components.clear();
    this.queries.clear();
    this.queryStartTimes.clear();
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for component tracking
export function usePerformanceTracking(componentName: string) {
  if (!import.meta.env.DEV) return;

  // Track mount/unmount
  performanceMonitor.trackComponentMount(componentName);
  
  return () => {
    performanceMonitor.trackComponentUnmount(componentName);
  };
}
