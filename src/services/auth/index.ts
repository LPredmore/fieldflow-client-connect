/**
 * Authentication Services Index
 * 
 * Central export point for all authentication-related services and utilities.
 */

// Core services
export { UnifiedRoleDetectionService, unifiedRoleDetectionService } from './UnifiedRoleDetectionService';
export { SessionCacheService, sessionCacheService } from './SessionCacheService';
export { QueryDeduplicator, queryDeduplicator } from './QueryDeduplicator';

// Error handling
export { AuthError, AuthErrorType } from './AuthError';
export { retryWithBackoff, withRetry } from './retryWithBackoff';

// Types
export type {
  UserRoleContext,
  UserProfile,
  ClinicianData,
  UserPermissions
} from './UnifiedRoleDetectionService';


export type {
  RetryOptions
} from './retryWithBackoff';
