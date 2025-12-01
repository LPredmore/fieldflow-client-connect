/**
 * Performance-related type definitions
 */

export type ErrorType = 'network_error' | 'timeout_error' | 'auth_error' | 'validation_error' | 'query_error';

export interface QueryContext {
  queryKey: string;
  cache?: any;
  options?: any;
  table: string;
}

export interface RequestCancellationOptions {
  pattern?: string;
  reason?: string;
}

export interface CacheResult<T> {
  hit: boolean;
  data: T[];
  isStale: boolean;
  age: number;
}