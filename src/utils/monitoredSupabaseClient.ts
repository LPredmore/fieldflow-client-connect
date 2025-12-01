import { SupabaseClient } from '@supabase/supabase-js';
import { supabase as baseSupabase } from '@/integrations/supabase/client';
import { policyPerformanceMonitor } from './policyPerformanceMonitor';

/**
 * Enhanced Supabase client that automatically monitors policy performance
 * Wraps the existing Supabase client instead of creating a new one
 * This prevents multiple GoTrueClient instances
 */
class MonitoredSupabaseClient {
  private client: SupabaseClient;

  constructor(existingClient: SupabaseClient) {
    this.client = existingClient; // ⚡ PERFORMANCE: Reuse existing client instead of creating new one
  }

  /**
   * Monitored SELECT operation
   */
  async select(
    tableName: string,
    policyName: string,
    query: any,
    userId?: string
  ) {
    const startTime = Date.now();
    let success = true;
    let errorMessage: string | undefined;

    try {
      const result = await query;
      return result;
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      const executionTime = Date.now() - startTime;
      policyPerformanceMonitor.logPolicyExecution(
        policyName,
        tableName,
        'SELECT',
        executionTime,
        success,
        userId,
        errorMessage
      );
    }
  }

  /**
   * Monitored INSERT operation
   */
  async insert(
    tableName: string,
    policyName: string,
    query: any,
    userId?: string
  ) {
    const startTime = Date.now();
    let success = true;
    let errorMessage: string | undefined;

    try {
      const result = await query;
      return result;
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      const executionTime = Date.now() - startTime;
      policyPerformanceMonitor.logPolicyExecution(
        policyName,
        tableName,
        'INSERT',
        executionTime,
        success,
        userId,
        errorMessage
      );
    }
  }

  /**
   * Monitored UPDATE operation
   */
  async update(
    tableName: string,
    policyName: string,
    query: any,
    userId?: string
  ) {
    const startTime = Date.now();
    let success = true;
    let errorMessage: string | undefined;

    try {
      const result = await query;
      return result;
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      const executionTime = Date.now() - startTime;
      policyPerformanceMonitor.logPolicyExecution(
        policyName,
        tableName,
        'UPDATE',
        executionTime,
        success,
        userId,
        errorMessage
      );
    }
  }

  /**
   * Monitored DELETE operation
   */
  async delete(
    tableName: string,
    policyName: string,
    query: any,
    userId?: string
  ) {
    const startTime = Date.now();
    let success = true;
    let errorMessage: string | undefined;

    try {
      const result = await query;
      return result;
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      const executionTime = Date.now() - startTime;
      policyPerformanceMonitor.logPolicyExecution(
        policyName,
        tableName,
        'DELETE',
        executionTime,
        success,
        userId,
        errorMessage
      );
    }
  }

  /**
   * Get the underlying Supabase client for operations that don't need monitoring
   */
  getClient(): SupabaseClient {
    return this.client;
  }
}

// ⚡ PERFORMANCE: Use existing Supabase client instance to prevent multiple GoTrueClient instances
export const monitoredSupabase = new MonitoredSupabaseClient(baseSupabase);

/**
 * Helper function to monitor any Supabase query
 */
export async function monitorQuery<T>(
  tableName: string,
  policyName: string,
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
  queryFn: () => Promise<T>,
  userId?: string
): Promise<T> {
  const startTime = Date.now();
  let success = true;
  let errorMessage: string | undefined;

  try {
    const result = await queryFn();
    return result;
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  } finally {
    const executionTime = Date.now() - startTime;
    policyPerformanceMonitor.logPolicyExecution(
      policyName,
      tableName,
      operation,
      executionTime,
      success,
      userId,
      errorMessage
    );
  }
}