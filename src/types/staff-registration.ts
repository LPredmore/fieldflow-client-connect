/**
 * Core TypeScript interfaces and types for the Staff Registration and Routing System
 * 
 * This file defines all the interfaces, types, and error definitions needed for:
 * - Staff type detection
 * - Staff status management  
 * - Route guarding
 * - Registration flow control
 */

// ============================================================================
// Core Data Types
// ============================================================================

/**
 * Staff status enumeration
 * - "New": Staff member who needs to complete registration
 * - "Active": Staff member with full system access (completed registration or non-clinical staff)
 */
export type StaffStatus = "New" | "Active";

/**
 * Staff record from the public.staff table
 */
export interface StaffRecord {
  id: string;
  tenant_id: string;
  profile_id: string;
  prov_name_f: string | null;
  prov_name_m: string | null;
  prov_name_l: string | null;
  prov_status: string | null;
  prov_field: string | null;
  prov_license_type: string | null;
  prov_license_number: string | null;
  prov_npi: string | null;
  prov_taxonomy: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Route decision result from route guard evaluation
 */
export interface RouteDecision {
  allowed: boolean;
  redirectTo?: string;
  reason: string;
}

/**
 * Registration data for completing staff onboarding
 */
export interface RegistrationData {
  // Professional Information
  licenseNumber: string;
  licenseType: string;
  specialty: string;
  certifications?: string[];
  npiNumber?: string;
  taxonomyCode?: string;
  
  // Clinical Profile
  bio: string;
  minClientAge?: number;
  providerFirstName: string;
  providerLastName: string;
  acceptingNewClients?: 'Yes' | 'No';
}

/**
 * Validation result for registration data
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// ============================================================================
// Service Interfaces
// ============================================================================

/**
 * Staff Type Detector Interface
 * Responsible for determining if a user is clinical staff or administrative staff
 */
export interface StaffTypeDetector {
  /**
   * Determines if a user is clinical staff
   * @param userId - The user ID to check
   * @returns Promise resolving to true if user is clinical staff
   */
  isClinicalStaff(userId: string): Promise<boolean>;

  /**
   * Retrieves staff record for a user
   * @param userId - The user ID to look up
   * @returns Promise resolving to staff record or null if not found
   */
  getStaffRecord(userId: string): Promise<StaffRecord | null>;
}

/**
 * Staff Status Manager Interface
 * Manages staff status values and ensures data consistency
 */
export interface StaffStatusManager {
  /**
   * Gets the current staff status for a user
   * @param userId - The user ID to check
   * @returns Promise resolving to staff status or null
   */
  getStaffStatus(userId: string): Promise<StaffStatus | null>;

  /**
   * Sets the staff status for a user
   * @param userId - The user ID to update
   * @param status - The new status to set
   * @returns Promise that resolves when update is complete
   */
  setStaffStatus(userId: string, status: StaffStatus): Promise<void>;

  /**
   * Initializes a staff record for a new staff member
   * @param userId - The user ID to initialize
   * @param isClinicalStaff - Whether the user is clinical staff
   * @returns Promise that resolves when initialization is complete
   */
  initializeStaffRecord(userId: string, isClinicalStaff: boolean): Promise<void>;

  /**
   * Gets the full staff record for a user
   * @param userId - The user ID to look up
   * @returns Promise resolving to staff record or null
   */
  getStaffRecord(userId: string): Promise<StaffRecord | null>;
}

/**
 * Route Guard Interface
 * Intercepts navigation and applies routing rules based on user type and status
 */
export interface RouteGuard {
  /**
   * Determines if a user can access a specific path
   * @param path - The path being accessed
   * @param userId - The user ID attempting access
   * @returns Promise resolving to route decision
   */
  canAccess(path: string, userId: string): Promise<RouteDecision>;

  /**
   * Gets the appropriate redirect path for a user
   * @param userId - The user ID to get redirect for
   * @returns Promise resolving to redirect path or null if no redirect needed
   */
  getRedirectPath(userId: string): Promise<string | null>;

  /**
   * Checks if a path is within the EMR domain
   * @param path - The path to check
   * @returns True if path is within EMR domain
   */
  isEMRDomainPath(path: string): boolean;
}

/**
 * Registration Flow Controller Interface
 * Manages the registration process and status transitions
 */
export interface RegistrationFlowController {
  /**
   * Completes the registration process for a staff member
   * @param userId - The user ID completing registration
   * @param registrationData - The registration data to save
   * @returns Promise that resolves when registration is complete
   */
  completeRegistration(userId: string, registrationData: RegistrationData): Promise<void>;

  /**
   * Validates registration data
   * @param data - The registration data to validate
   * @returns Validation result with errors and warnings
   */
  validateRegistrationData(data: RegistrationData): ValidationResult;

  /**
   * Gets the current registration status for a user
   * @param userId - The user ID to check
   * @returns Promise resolving to registration status information
   */
  getRegistrationStatus(userId: string): Promise<{
    isRegistered: boolean;
    staffStatus: string | null;
    missingFields: string[];
  }>;
}

// ============================================================================
// Error Types and Handling
// ============================================================================

/**
 * Base error class for staff registration system
 */
export abstract class StaffRegistrationError extends Error {
  abstract readonly errorType: string;
  abstract readonly errorCode: string;
  
  constructor(message: string, public readonly userId?: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Authentication-related errors
 */
export class AuthenticationError extends StaffRegistrationError {
  readonly errorType = 'authentication';
  readonly errorCode = 'AUTH_ERROR';
}

/**
 * Data consistency errors (missing records, invalid states)
 */
export class DataConsistencyError extends StaffRegistrationError {
  readonly errorType = 'data_consistency';
  readonly errorCode = 'DATA_ERROR';
  
  constructor(message: string, userId?: string, public readonly tableName?: string) {
    super(message, userId);
  }
}

/**
 * Permission/authorization errors
 */
export class PermissionError extends StaffRegistrationError {
  readonly errorType = 'permission';
  readonly errorCode = 'PERMISSION_ERROR';
  
  constructor(message: string, userId?: string, public readonly attemptedPath?: string) {
    super(message, userId);
  }
}

/**
 * System errors (database connectivity, unexpected failures)
 */
export class SystemError extends StaffRegistrationError {
  readonly errorType = 'system';
  readonly errorCode = 'SYSTEM_ERROR';
  
  constructor(message: string, userId?: string, public readonly originalError?: Error) {
    super(message, userId);
  }
}

/**
 * Validation errors for registration data
 */
export class ValidationError extends StaffRegistrationError {
  readonly errorType = 'validation';
  readonly errorCode = 'VALIDATION_ERROR';
  
  constructor(message: string, public readonly fieldErrors: Record<string, string[]>) {
    super(message);
  }
}

/**
 * Error handler interface for managing different error types
 */
export interface ErrorHandler {
  /**
   * Handles authentication errors
   * @param error - The authentication error
   */
  handleAuthenticationError(error: AuthenticationError): void;

  /**
   * Handles data consistency errors
   * @param error - The data consistency error
   */
  handleDataConsistencyError(error: DataConsistencyError): void;

  /**
   * Handles permission errors
   * @param error - The permission error
   */
  handlePermissionError(error: PermissionError): void;

  /**
   * Handles system errors
   * @param error - The system error
   */
  handleSystemError(error: SystemError): void;

  /**
   * Handles validation errors
   * @param error - The validation error
   */
  handleValidationError(error: ValidationError): void;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Configuration options for the staff registration system
 */
export interface StaffRegistrationConfig {
  /** Base URL for EMR domain */
  emrDomainUrl: string;
  /** Path to registration page */
  registrationPath: string;
  /** Path to dashboard page */
  dashboardPath: string;
  /** Cache TTL for staff type detection (in milliseconds) */
  staffTypeCacheTTL: number;
  /** Enable audit logging */
  enableAuditLogging: boolean;
  /** Database retry configuration */
  retryConfig: {
    maxRetries: number;
    retryDelayMs: number;
  };
}

/**
 * Audit log entry for tracking routing decisions and status changes
 */
export interface AuditLogEntry {
  id: string;
  userId: string;
  action: 'route_decision' | 'status_change' | 'registration_complete' | 'access_denied' | 'registration_attempt' | 'system_error' | 'security_event' | 'authentication_failure' | 'configuration_change' | 'data_access';
  details: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Cache entry for staff type detection
 */
export interface StaffTypeCacheEntry {
  userId: string;
  isClinicalStaff: boolean;
  staffRecord: StaffRecord | null;
  cachedAt: number;
  expiresAt: number;
}
