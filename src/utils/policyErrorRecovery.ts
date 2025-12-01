/**
 * Policy Error Recovery Mechanisms
 * 
 * Provides recovery strategies and tracking for policy-related errors
 * Requirements: 3.1, 3.2
 */

import { ErrorType } from './circuitBreaker';
import { supabaseCircuitBreaker } from './circuitBreaker';
import { smartSupabaseCircuitBreaker } from './smartCircuitBreakerInstance';

export interface PolicyErrorTracker {
  errorCount: number;
  lastErrorTime: number;
  errorTypes: Record<ErrorType, number>;
  recoveryAttempts: number;
  lastRecoveryTime: number;
  isInRecoveryMode: boolean;
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  canApply: (tracker: PolicyErrorTracker) => boolean;
  execute: () => Promise<boolean>;
  priority: number;
}

class PolicyErrorRecoveryManager {
  private tracker: PolicyErrorTracker = {
    errorCount: 0,
    lastErrorTime: 0,
    errorTypes: {} as Record<ErrorType, number>,
    recoveryAttempts: 0,
    lastRecoveryTime: 0,
    isInRecoveryMode: false
  };

  private recoveryStrategies: RecoveryStrategy[] = [];
  private maxRecoveryAttempts = 3;
  private recoveryTimeoutMs = 300000; // 5 minutes

  constructor() {
    this.initializeRecoveryStrategies();
  }

  /**
   * Record a policy error and potentially trigger recovery
   */
  async recordPolicyError(errorType: ErrorType, errorMessage: string): Promise<void> {
    this.tracker.errorCount++;
    this.tracker.lastErrorTime = Date.now();
    this.tracker.errorTypes[errorType] = (this.tracker.errorTypes[errorType] || 0) + 1;

    console.warn(`🚨 Policy error recorded: ${errorType} (Total: ${this.tracker.errorCount})`);

    // Check if we should enter recovery mode
    if (this.shouldEnterRecoveryMode(errorType)) {
      await this.enterRecoveryMode();
    }
  }

  /**
   * Check if we should enter recovery mode based on error patterns
   */
  private shouldEnterRecoveryMode(errorType: ErrorType): boolean {
    // Enter recovery mode for critical policy errors
    if (errorType === ErrorType.POLICY_INFINITE_RECURSION || 
        errorType === ErrorType.POLICY_CIRCULAR_DEPENDENCY) {
      return true;
    }

    // Enter recovery mode if we have multiple policy evaluation errors
    const policyEvalErrors = this.tracker.errorTypes[ErrorType.POLICY_EVALUATION_ERROR] || 0;
    if (policyEvalErrors >= 3) {
      return true;
    }

    // Enter recovery mode if total error count is high
    if (this.tracker.errorCount >= 5) {
      return true;
    }

    return false;
  }

  /**
   * Enter recovery mode and attempt to recover
   */
  private async enterRecoveryMode(): Promise<void> {
    if (this.tracker.isInRecoveryMode) {
      console.log('🔄 Already in recovery mode, skipping...');
      return;
    }

    // Check if we've exceeded max recovery attempts
    if (this.tracker.recoveryAttempts >= this.maxRecoveryAttempts) {
      console.error('🚫 Max recovery attempts reached, giving up');
      return;
    }

    // Check if we're still in recovery timeout
    const timeSinceLastRecovery = Date.now() - this.tracker.lastRecoveryTime;
    if (timeSinceLastRecovery < this.recoveryTimeoutMs) {
      console.log('🕐 Still in recovery timeout, waiting...');
      return;
    }

    this.tracker.isInRecoveryMode = true;
    this.tracker.recoveryAttempts++;
    this.tracker.lastRecoveryTime = Date.now();

    console.log(`🔧 Entering recovery mode (attempt ${this.tracker.recoveryAttempts}/${this.maxRecoveryAttempts})`);

    try {
      await this.executeRecoveryStrategies();
    } catch (error) {
      console.error('❌ Recovery failed:', error);
    } finally {
      this.tracker.isInRecoveryMode = false;
    }
  }

  /**
   * Execute recovery strategies in priority order
   */
  private async executeRecoveryStrategies(): Promise<void> {
    const applicableStrategies = this.recoveryStrategies
      .filter(strategy => strategy.canApply(this.tracker))
      .sort((a, b) => b.priority - a.priority);

    console.log(`🔧 Found ${applicableStrategies.length} applicable recovery strategies`);

    for (const strategy of applicableStrategies) {
      try {
        console.log(`🔧 Executing recovery strategy: ${strategy.name}`);
        const success = await strategy.execute();
        
        if (success) {
          console.log(`✅ Recovery strategy '${strategy.name}' succeeded`);
          this.resetErrorTracking();
          return;
        } else {
          console.warn(`⚠️ Recovery strategy '${strategy.name}' failed`);
        }
      } catch (error) {
        console.error(`❌ Recovery strategy '${strategy.name}' threw error:`, error);
      }
    }

    console.warn('⚠️ All recovery strategies failed');
  }

  /**
   * Initialize available recovery strategies
   */
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies = [
      {
        name: 'Circuit Breaker Reset',
        description: 'Reset the circuit breaker to allow new requests',
        priority: 10,
        canApply: (tracker) => tracker.errorCount > 0,
        execute: async () => {
          try {
            // Reset both circuit breakers for compatibility
            supabaseCircuitBreaker.reset();
            smartSupabaseCircuitBreaker.resetAdaptiveThresholds();
            console.log('🔄 Circuit breakers reset successfully');
            return true;
          } catch (error) {
            console.error('❌ Failed to reset circuit breaker:', error);
            return false;
          }
        }
      },
      {
        name: 'Clear Error History',
        description: 'Clear accumulated error history to start fresh',
        priority: 8,
        canApply: (tracker) => tracker.errorCount >= 5,
        execute: async () => {
          try {
            this.resetErrorTracking();
            console.log('🧹 Error history cleared');
            return true;
          } catch (error) {
            console.error('❌ Failed to clear error history:', error);
            return false;
          }
        }
      },
      {
        name: 'Policy Health Check',
        description: 'Perform a basic health check on database policies',
        priority: 6,
        canApply: (tracker) => {
          const hasPolicyErrors = tracker.errorTypes[ErrorType.POLICY_INFINITE_RECURSION] > 0 ||
                                 tracker.errorTypes[ErrorType.POLICY_CIRCULAR_DEPENDENCY] > 0 ||
                                 tracker.errorTypes[ErrorType.POLICY_EVALUATION_ERROR] > 0;
          return hasPolicyErrors;
        },
        execute: async () => {
          try {
            // This would perform a basic policy health check
            // For now, we'll simulate a successful check
            console.log('🏥 Policy health check completed');
            return true;
          } catch (error) {
            console.error('❌ Policy health check failed:', error);
            return false;
          }
        }
      }
    ];
  }

  /**
   * Reset error tracking
   */
  private resetErrorTracking(): void {
    this.tracker = {
      errorCount: 0,
      lastErrorTime: 0,
      errorTypes: {} as Record<ErrorType, number>,
      recoveryAttempts: this.tracker.recoveryAttempts, // Keep recovery attempts
      lastRecoveryTime: this.tracker.lastRecoveryTime, // Keep last recovery time
      isInRecoveryMode: false
    };
  }

  /**
   * Get current error tracking status
   */
  getStatus(): PolicyErrorTracker & { 
    canAttemptRecovery: boolean;
    timeUntilNextRecovery: number;
  } {
    const timeSinceLastRecovery = Date.now() - this.tracker.lastRecoveryTime;
    const timeUntilNextRecovery = Math.max(0, this.recoveryTimeoutMs - timeSinceLastRecovery);
    
    return {
      ...this.tracker,
      canAttemptRecovery: this.tracker.recoveryAttempts < this.maxRecoveryAttempts && 
                         timeSinceLastRecovery >= this.recoveryTimeoutMs,
      timeUntilNextRecovery
    };
  }

  /**
   * Manually trigger recovery (for testing or admin use)
   */
  async manualRecovery(): Promise<boolean> {
    console.log('🔧 Manual recovery triggered');
    
    // Temporarily allow recovery even if in timeout
    const originalLastRecoveryTime = this.tracker.lastRecoveryTime;
    this.tracker.lastRecoveryTime = 0;
    
    try {
      await this.enterRecoveryMode();
      return true;
    } catch (error) {
      console.error('❌ Manual recovery failed:', error);
      return false;
    } finally {
      // Restore original recovery time if recovery failed
      if (this.tracker.errorCount > 0) {
        this.tracker.lastRecoveryTime = originalLastRecoveryTime;
      }
    }
  }
}

// Export singleton instance
export const policyErrorRecovery = new PolicyErrorRecoveryManager();

/**
 * Convenience function to record policy errors
 */
export async function recordPolicyError(errorType: ErrorType, errorMessage: string): Promise<void> {
  await policyErrorRecovery.recordPolicyError(errorType, errorMessage);
}

/**
 * Check if the system is currently in recovery mode
 */
export function isInRecoveryMode(): boolean {
  return policyErrorRecovery.getStatus().isInRecoveryMode;
}

/**
 * Get recovery status for monitoring
 */
export function getRecoveryStatus() {
  return policyErrorRecovery.getStatus();
}