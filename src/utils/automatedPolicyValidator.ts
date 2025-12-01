/**
 * Automated Policy Validation System
 * 
 * Provides scheduled checks for policy circular dependencies,
 * automated performance testing, and production error alerting
 */

import React from 'react';
import { createClient } from '@supabase/supabase-js';
import { policyPerformanceMonitor } from './policyPerformanceMonitor';

interface PolicyValidationResult {
  policyName: string;
  tableName: string;
  isValid: boolean;
  hasCircularDependency: boolean;
  performanceScore: 'GOOD' | 'WARNING' | 'CRITICAL';
  executionTime: number;
  errorMessage?: string;
  recommendations: string[];
}

interface ValidationReport {
  timestamp: Date;
  totalPolicies: number;
  validPolicies: number;
  circularDependencies: number;
  performanceIssues: number;
  criticalIssues: string[];
  results: PolicyValidationResult[];
}

class AutomatedPolicyValidator {
  private supabase: any = null;
  private config: { url: string; key: string } | null = null;
  private validationInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    // Hardcoded Supabase configuration - required for Lovable production builds
    const url = "https://tizshsmrqqaharwpqocj.supabase.co";
    const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpenNoc21ycXFhaGFyd3Bxb2NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwOTQwNDQsImV4cCI6MjA3NDY3MDA0NH0.HFecGZAPLi6-RmPJrG0M0G9bAV7AsabybTapjKw-ddU";
    
    if (!url || !key) {
      console.warn('AutomatedPolicyValidator: Missing Supabase configuration, validator will be disabled');
      this.config = null;
      return;
    }
    
    // Store config for lazy initialization - don't create client yet
    this.config = { url, key };
  }

  /**
   * Lazily initialize Supabase client only when needed
   */
  private ensureClient(): any | null {
    if (this.supabase) {
      return this.supabase;
    }
    
    if (!this.config) {
      return null;
    }
    
    console.log('[AutomatedPolicyValidator] Initializing Supabase client (lazy)');
    this.supabase = createClient(this.config.url, this.config.key);
    return this.supabase;
  }

  /**
   * Create empty validation report when validator is disabled
   */
  private createEmptyReport(): ValidationReport {
    return {
      timestamp: new Date(),
      totalPolicies: 0,
      validPolicies: 0,
      circularDependencies: 0,
      performanceIssues: 0,
      criticalIssues: ['Validator not configured - missing Supabase credentials'],
      results: []
    };
  }

  /**
   * Start automated policy validation with specified interval
   */
  startAutomatedValidation(intervalMinutes: number = 60): void {
    if (this.isRunning) {
      console.warn('Automated policy validation is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting automated policy validation every ${intervalMinutes} minutes`);

    // Run initial validation
    this.runValidation().catch(console.error);

    // Schedule recurring validation
    this.validationInterval = setInterval(() => {
      this.runValidation().catch(console.error);
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop automated policy validation
   */
  stopAutomatedValidation(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
    this.isRunning = false;
    console.log('Stopped automated policy validation');
  }

  /**
   * Run a complete policy validation check
   */
  async runValidation(): Promise<ValidationReport> {
    const client = this.ensureClient();
    if (!client) {
      console.warn('[AutomatedPolicyValidator] Validation skipped - client not configured');
      return this.createEmptyReport();
    }

    console.log('Starting automated policy validation...');
    
    try {
      const policies = await this.getAllPolicies();
      const results: PolicyValidationResult[] = [];
      const criticalIssues: string[] = [];

      for (const policy of policies) {
        try {
          const result = await this.validatePolicy(policy);
          results.push(result);

          // Track critical issues
          if (!result.isValid || result.hasCircularDependency || result.performanceScore === 'CRITICAL') {
            criticalIssues.push(`${policy.policyname} on ${policy.tablename}: ${result.errorMessage || 'Performance issue'}`);
          }
        } catch (error) {
          const errorResult: PolicyValidationResult = {
            policyName: policy.policyname,
            tableName: policy.tablename,
            isValid: false,
            hasCircularDependency: false,
            performanceScore: 'CRITICAL',
            executionTime: 0,
            errorMessage: error instanceof Error ? error.message : 'Unknown validation error',
            recommendations: ['Review policy syntax and dependencies']
          };
          results.push(errorResult);
          criticalIssues.push(`${policy.policyname}: Validation failed - ${errorResult.errorMessage}`);
        }
      }

      const report: ValidationReport = {
        timestamp: new Date(),
        totalPolicies: policies.length,
        validPolicies: results.filter(r => r.isValid).length,
        circularDependencies: results.filter(r => r.hasCircularDependency).length,
        performanceIssues: results.filter(r => r.performanceScore !== 'GOOD').length,
        criticalIssues,
        results
      };

      // Send alerts for critical issues
      if (criticalIssues.length > 0) {
        await this.sendCriticalAlert(report);
      }

      console.log('Policy validation completed:', {
        total: report.totalPolicies,
        valid: report.validPolicies,
        issues: report.criticalIssues.length
      });

      return report;
    } catch (error) {
      console.error('Failed to run policy validation:', error);
      throw error;
    }
  }

  /**
   * Get all RLS policies from the database
   */
  private async getAllPolicies(): Promise<any[]> {
    const client = this.ensureClient();
    if (!client) {
      return [];
    }

    const { data, error } = await client.rpc('get_all_policies');
    
    if (error) {
      // Fallback to direct query if RPC doesn't exist
      const { data: fallbackData, error: fallbackError } = await client
        .from('pg_policies')
        .select('*');
      
      if (fallbackError) {
        throw new Error(`Failed to fetch policies: ${fallbackError.message}`);
      }
      
      return fallbackData || [];
    }
    
    return data || [];
  }

  /**
   * Validate a specific policy for circular dependencies and performance
   */
  private async validatePolicy(policy: any): Promise<PolicyValidationResult> {
    const startTime = Date.now();
    let isValid = true;
    let hasCircularDependency = false;
    let errorMessage: string | undefined;
    const recommendations: string[] = [];

    try {
      // Check for circular dependencies in policy definition
      hasCircularDependency = this.detectCircularDependency(policy);
      
      if (hasCircularDependency) {
        isValid = false;
        errorMessage = 'Circular dependency detected in policy';
        recommendations.push('Simplify policy to use direct auth.uid() comparison');
        recommendations.push('Remove cross-table references that create cycles');
      }

      // Test policy performance with a sample query
      const performanceResult = await this.testPolicyPerformance(policy);
      
      const executionTime = Date.now() - startTime;
      const performanceScore = this.getPerformanceScore(performanceResult.executionTime);

      if (performanceScore === 'CRITICAL') {
        recommendations.push('Optimize policy query or add database indexes');
      } else if (performanceScore === 'WARNING') {
        recommendations.push('Consider optimizing policy for better performance');
      }

      return {
        policyName: policy.policyname,
        tableName: policy.tablename,
        isValid: isValid && performanceResult.success,
        hasCircularDependency,
        performanceScore,
        executionTime: performanceResult.executionTime,
        errorMessage: errorMessage || performanceResult.errorMessage,
        recommendations
      };
    } catch (error) {
      return {
        policyName: policy.policyname,
        tableName: policy.tablename,
        isValid: false,
        hasCircularDependency: false,
        performanceScore: 'CRITICAL',
        executionTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        recommendations: ['Review policy configuration and database connectivity']
      };
    }
  }

  /**
   * Detect circular dependencies in policy definition
   */
  private detectCircularDependency(policy: any): boolean {
    const policyDefinition = policy.definition || '';
    const tableName = policy.tablename;

    // Simple heuristic: check if policy references other tables that might reference back
    const commonCircularPatterns = [
      // Policy references profiles table while being on clinicians table
      new RegExp(`SELECT.*FROM\\s+(profiles|user_permissions).*WHERE.*${tableName}`, 'i'),
      // Policy has nested subqueries that might create cycles
      new RegExp(`SELECT.*\\(\\s*SELECT.*FROM\\s+${tableName}`, 'i'),
      // Policy references the same table it's defined on in a subquery
      new RegExp(`FROM\\s+${tableName}.*WHERE.*IN\\s*\\(.*SELECT.*FROM\\s+${tableName}`, 'i')
    ];

    return commonCircularPatterns.some(pattern => pattern.test(policyDefinition));
  }

  /**
   * Test policy performance with a sample query
   */
  private async testPolicyPerformance(policy: any): Promise<{
    success: boolean;
    executionTime: number;
    errorMessage?: string;
  }> {
    const client = this.ensureClient();
    if (!client) {
      return {
        success: false,
        executionTime: 0,
        errorMessage: 'Supabase client not configured'
      };
    }

    const startTime = Date.now();
    
    try {
      // Perform a simple SELECT query to test the policy
      const { data, error } = await client
        .from(policy.tablename)
        .select('*')
        .limit(1);

      const executionTime = Date.now() - startTime;

      if (error) {
        return {
          success: false,
          executionTime,
          errorMessage: error.message
        };
      }

      return {
        success: true,
        executionTime
      };
    } catch (error) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get performance score based on execution time
   */
  private getPerformanceScore(executionTime: number): 'GOOD' | 'WARNING' | 'CRITICAL' {
    if (executionTime > 2000) return 'CRITICAL';
    if (executionTime > 1000) return 'WARNING';
    return 'GOOD';
  }

  /**
   * Send critical alert for policy issues
   */
  private async sendCriticalAlert(report: ValidationReport): Promise<void> {
    const alertMessage = {
      type: 'POLICY_VALIDATION_ALERT',
      timestamp: report.timestamp,
      severity: 'CRITICAL',
      summary: `Found ${report.criticalIssues.length} critical policy issues`,
      details: {
        totalPolicies: report.totalPolicies,
        validPolicies: report.validPolicies,
        circularDependencies: report.circularDependencies,
        performanceIssues: report.performanceIssues,
        criticalIssues: report.criticalIssues.slice(0, 5) // Limit to first 5 issues
      }
    };

    console.error('[CRITICAL POLICY ALERT]', alertMessage);

    // In production, integrate with alerting services
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to Sentry, Slack, email, etc.
      await this.sendToAlertingService(alertMessage);
    }
  }

  /**
   * Send alert to external service
   */
  private async sendToAlertingService(alert: any): Promise<void> {
    // Placeholder for external alerting integration
    // This could integrate with Sentry, Slack, email services, etc.
    console.log('Sending alert to external service:', alert);
  }

  /**
   * Get validation status
   */
  isValidationRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Run on-demand validation (for manual testing)
   */
  async validateNow(): Promise<ValidationReport> {
    return this.runValidation();
  }
}

// Singleton instance
export const automatedPolicyValidator = new AutomatedPolicyValidator();

/**
 * Initialize automated policy validation
 * Call this in your app initialization
 */
export function initializePolicyValidation(intervalMinutes: number = 60): void {
  if (process.env.NODE_ENV === 'production') {
    automatedPolicyValidator.startAutomatedValidation(intervalMinutes);
  } else {
    console.log('Policy validation not started in development mode');
  }
}

/**
 * React hook for accessing validation status
 */
export function usePolicyValidationStatus() {
  const [isRunning, setIsRunning] = React.useState(
    automatedPolicyValidator.isValidationRunning()
  );
  const [lastReport, setLastReport] = React.useState<ValidationReport | null>(null);

  React.useEffect(() => {
    const checkStatus = () => {
      setIsRunning(automatedPolicyValidator.isValidationRunning());
    };

    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const runValidationNow = async () => {
    try {
      const report = await automatedPolicyValidator.validateNow();
      setLastReport(report);
      return report;
    } catch (error) {
      console.error('Failed to run validation:', error);
      throw error;
    }
  };

  return {
    isRunning,
    lastReport,
    runValidationNow
  };
}

export type { PolicyValidationResult, ValidationReport };