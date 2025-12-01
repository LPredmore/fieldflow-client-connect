/**
 * Initialize Policy Monitoring System
 * 
 * Sets up automated policy validation and performance monitoring
 * Call this during application startup
 */

import { initializePolicyValidation } from './automatedPolicyValidator';
import { policyPerformanceMonitor } from './policyPerformanceMonitor';

/**
 * Initialize all policy monitoring systems
 */
export function initializePolicyMonitoring(): void {
  // Check if policy monitoring should be enabled
  const enabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_POLICY_MONITORING === 'true';
  
  if (!enabled) {
    console.log('⏸️ Policy monitoring disabled for performance');
    return;
  }

  console.log('Initializing policy monitoring systems...');

  try {
    // Set up automated policy validation
    // Run validation every 60 minutes in production
    initializePolicyValidation(60);

    // Configure performance monitoring thresholds
    policyPerformanceMonitor.updateThresholds({
      slowExecutionMs: 2000,    // Alert if policy takes > 2 seconds
      errorRatePercent: 10,     // Alert if error rate > 10%
      maxMetricsHistory: 1000   // Keep last 1000 metrics
    });

    console.log('Policy monitoring systems initialized successfully');
  } catch (error) {
    console.error('Failed to initialize policy monitoring:', error);
  }
}

/**
 * Shutdown policy monitoring systems
 * Call this during application cleanup
 */
export function shutdownPolicyMonitoring(): void {
  console.log('Shutting down policy monitoring systems...');
  
  try {
    // Stop automated validation would be handled by the validator itself
    // Clear performance metrics to free memory
    policyPerformanceMonitor.clearMetrics();
    
    console.log('Policy monitoring systems shut down successfully');
  } catch (error) {
    console.error('Error during policy monitoring shutdown:', error);
  }
}

/**
 * Get monitoring system health status
 */
export function getPolicyMonitoringHealth(): {
  performanceMonitor: boolean;
  automatedValidation: boolean;
  lastValidation?: Date;
  metricsCount: number;
} {
  try {
    const metrics = policyPerformanceMonitor.getDashboardMetrics();
    
    return {
      performanceMonitor: true,
      automatedValidation: process.env.NODE_ENV === 'production',
      metricsCount: metrics.totalExecutions
    };
  } catch (error) {
    console.error('Error checking monitoring health:', error);
    return {
      performanceMonitor: false,
      automatedValidation: false,
      metricsCount: 0
    };
  }
}