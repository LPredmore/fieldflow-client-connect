/**
 * Unified Role Detection Service
 * 
 * Single source of truth for determining user roles and attributes.
 * Integrates with SessionCacheService and QueryDeduplicator to prevent
 * duplicate queries and provide fast cached access.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */

import { supabase } from '@/integrations/supabase/client';
import { SessionCacheService, sessionCacheService } from './SessionCacheService';
import { queryDeduplicator } from './QueryDeduplicator';
import { authLogger, AuthLogCategory } from './AuthLogger';

export interface UserRoleContext {
  userId: string;
  role: 'staff' | 'client';
  isStaff: boolean;
  isClient: boolean;
  isClinician: boolean;
  isAdmin: boolean;
  permissions: UserPermissions;
  tenantId: string;
  profile: UserProfile;
  clinicianData?: ClinicianData;
  signupIncomplete?: boolean; // NEW: Flag for incomplete signup
}

export interface UserProfile {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  role: string;
  tenant_id: string;
  avatar_url: string | null;
  phone: string | null;
  archived: boolean | null;
}

export interface ClinicianData {
  id: string;
  user_id: string;
  tenant_id: string;
  is_clinician: boolean;
  is_admin: boolean;
  clinician_status: string | null;
  prov_name_f: string | null;
  prov_name_last: string | null;
}

export interface UserPermissions {
  user_id: string;
  tenant_id: string;
  access_appointments?: boolean;
  access_calendar?: boolean;
  access_customers?: boolean;
  access_forms?: boolean;
  access_invoicing?: boolean;
  access_services?: boolean;
  access_settings?: boolean;
  access_user_management?: boolean;
  supervisor?: boolean;
}

export class UnifiedRoleDetectionService {
  private readonly CACHE_TTL = 3600000; // 1 hour

  /**
   * Detect user role and attributes
   * This is the main entry point for role detection
   * 
   * @param userId - User ID to detect role for
   * @returns Complete user role context
   */
  async detectUserRole(userId: string): Promise<UserRoleContext> {
    // Check cache first
    const cached = this.getCachedRole(userId);
    if (cached) {
      authLogger.logRoleDetection('Using cached role', {
        role: cached.role,
        isClinician: cached.isClinician,
        isAdmin: cached.isAdmin
      }, userId);
      return cached;
    }

    authLogger.logRoleDetection('Starting role detection', {}, userId);

    // Fetch fresh data with deduplication
    const roleContext = await this.fetchUserRoleData(userId);

    // Cache the result
    sessionCacheService.set(
      SessionCacheService.roleKey(userId),
      roleContext,
      this.CACHE_TTL
    );

    authLogger.logRoleDetection('Role detection complete', {
      role: roleContext.role,
      isClinician: roleContext.isClinician,
      isAdmin: roleContext.isAdmin,
      cached: true
    }, userId);

    return roleContext;
  }

  /**
   * Get cached role context
   * 
   * @param userId - User ID
   * @returns Cached role context or null
   */
  getCachedRole(userId: string): UserRoleContext | null {
    return sessionCacheService.get<UserRoleContext>(
      SessionCacheService.roleKey(userId)
    );
  }

  /**
   * Invalidate cached role data
   * 
   * @param userId - User ID
   */
  invalidateCache(userId: string): void {
    sessionCacheService.delete(SessionCacheService.roleKey(userId));
    sessionCacheService.delete(SessionCacheService.profileKey(userId));
    sessionCacheService.delete(SessionCacheService.clinicianKey(userId));
    sessionCacheService.delete(SessionCacheService.permissionsKey(userId));
    
    authLogger.logRoleDetection('Cache invalidated', {}, userId);
  }

  /**
   * Fetch user role data from database
   * Uses query deduplication to prevent duplicate queries
   */
  private async fetchUserRoleData(userId: string): Promise<UserRoleContext> {
    const startTime = Date.now();
    authLogger.logRoleDetection('Fetching role data from database', {}, userId);

    // Step 1: Fetch profile (no role check - role comes from user_roles table)
    const profile = await queryDeduplicator.deduplicate(
      `profile:${userId}`,
      () => this.fetchProfile(userId)
    );

    if (!profile) {
      authLogger.logError(AuthLogCategory.ROLE_DETECTION, 'Profile not found - user needs to complete signup', undefined, { userId });
      
      // Return a special context that indicates signup is incomplete
      // This prevents blank pages and allows graceful redirect to completion flow
      return {
        userId,
        role: 'staff', // Default
        isStaff: false,
        isClient: false,
        isClinician: false,
        isAdmin: false,
        permissions: { user_id: userId, tenant_id: '' },
        tenantId: '',
        profile: null as any,
        signupIncomplete: true
      };
    }

    authLogger.logRoleDetection('Profile fetched', {
      tenantId: profile.tenant_id
    }, userId);

    // Step 2: Fetch user roles from user_roles table (deduplicated)
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (rolesError) {
      authLogger.logError(AuthLogCategory.ROLE_DETECTION, 'Failed to fetch roles', rolesError, { userId });
      throw rolesError;
    }

    // Determine user attributes from roles
    const roles = userRoles?.map(r => r.role) || [];
    const isAdmin = roles.includes('admin');
    const isClinician = roles.includes('clinician'); // FIXED: Remove || isAdmin
    const isStaff = roles.includes('staff') || isClinician;
    const isClient = roles.includes('client');

    authLogger.logRoleDetection('Roles fetched', {
      roles,
      isAdmin,
      isClinician,
      isStaff,
      isClient,
      note: 'isClinician computed from user_roles only (not from isAdmin)'
    }, userId);

    // Step 3: Fetch clinician data for all staff (backward compatibility)
    // Even if they don't have 'clinician' role, they might have a clinicians record
    let clinicianData: ClinicianData | null = null;

    if (isStaff || isAdmin) {
      clinicianData = await queryDeduplicator.deduplicate(
        `clinician:${userId}`,
        () => this.fetchClinicianData(userId, profile.tenant_id)
      );

      if (clinicianData) {
        authLogger.logRoleDetection('Clinician data fetched', {
          clinicianStatus: clinicianData.clinician_status,
          hasClinicianRole: isClinician
        }, userId);
      } else {
        authLogger.logRoleDetection('No clinician record found (OK for non-clinical staff)', {}, userId);
      }
    }

    // Step 4: If staff, fetch permissions (deduplicated)
    let permissions: UserPermissions = {
      user_id: userId,
      tenant_id: profile.tenant_id
    };

    if (isStaff) {
      const fetchedPermissions = await queryDeduplicator.deduplicate(
        `permissions:${userId}`,
        () => this.fetchPermissions(userId, profile.tenant_id)
      );

      if (fetchedPermissions) {
        permissions = fetchedPermissions;
        authLogger.logRoleDetection('Permissions fetched', {
          permissionCount: Object.keys(fetchedPermissions).length
        }, userId);
      } else {
        authLogger.logRoleDetection('No permissions record found', {}, userId);
      }
    }

    // Build complete role context
    const roleContext: UserRoleContext = {
      userId,
      role: isStaff ? 'staff' : 'client',
      isStaff,
      isClient,
      isClinician,
      isAdmin,
      permissions,
      tenantId: profile.tenant_id,
      profile,
      clinicianData: clinicianData || undefined
    };

    const duration = Date.now() - startTime;
    authLogger.logRoleDetection('Role detection complete', {
      role: roleContext.role,
      isClinician,
      isAdmin,
      duration
    }, userId);

    return roleContext;
  }

  /**
   * Fetch user profile from database
   */
  private async fetchProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      authLogger.logError(AuthLogCategory.ROLE_DETECTION, 'Failed to fetch profile', error, { userId });
      throw error;
    }

    return data;
  }

  /**
   * Fetch clinician data from database
   * Only called for staff users
   */
  private async fetchClinicianData(
    userId: string,
    tenantId: string
  ): Promise<ClinicianData | null> {
    const { data, error } = await supabase
      .from('clinicians')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      authLogger.logError(AuthLogCategory.ROLE_DETECTION, 'Failed to fetch clinician data', error, { userId, tenantId });
      // Don't throw - clinician record might not exist
      return null;
    }

    return data;
  }

  /**
   * Fetch user permissions from database
   * Only called for staff users
   */
  private async fetchPermissions(
    userId: string,
    tenantId: string
  ): Promise<UserPermissions | null> {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      authLogger.logError(AuthLogCategory.ROLE_DETECTION, 'Failed to fetch permissions', error, { userId, tenantId });
      // Don't throw - permissions record might not exist
      return null;
    }

    return data;
  }
}

// Export singleton instance
export const unifiedRoleDetectionService = new UnifiedRoleDetectionService();
