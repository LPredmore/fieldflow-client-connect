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
  staffData?: StaffData;
  signupIncomplete?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  email_verified: boolean | null;
  created_at: string;
  updated_at: string | null;
  is_active: boolean | null;
  last_login_at: string | null;
}

export interface StaffData {
  id: string;
  profile_id: string;
  tenant_id: string;
  prov_status: string | null;
  prov_name_f: string | null;
  prov_name_l: string | null;
  prov_name_m: string | null;
  prov_title: string | null;
  prov_license_type: string | null;
  prov_license_number: string | null;
  prov_field: string | null;
}

export interface UserPermissions {
  profile_id: string;
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
   * @param userId - Profile ID to detect role for
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
   * @param userId - Profile ID
   */
  invalidateCache(userId: string): void {
    sessionCacheService.delete(SessionCacheService.roleKey(userId));
    sessionCacheService.delete(SessionCacheService.profileKey(userId));
    sessionCacheService.delete(`staff:${userId}`);
    sessionCacheService.delete(`tenantMembership:${userId}`);
    
    authLogger.logRoleDetection('Cache invalidated', {}, userId);
  }

  /**
   * Fetch user role data from database
   * Uses query deduplication to prevent duplicate queries
   */
  private async fetchUserRoleData(userId: string): Promise<UserRoleContext> {
    const startTime = Date.now();
    authLogger.logRoleDetection('Fetching role data from database', {}, userId);

    // Step 1: Fetch profile
    const profile = await queryDeduplicator.deduplicate(
      `profile:${userId}`,
      () => this.fetchProfile(userId)
    );

    if (!profile) {
      authLogger.logError(AuthLogCategory.ROLE_DETECTION, 'Profile not found - user needs to complete signup', undefined, { userId });
      
      // Return a special context that indicates signup is incomplete
      return {
        userId,
        role: 'staff',
        isStaff: false,
        isClient: false,
        isClinician: false,
        isAdmin: false,
        permissions: { profile_id: userId, tenant_id: '' },
        tenantId: '',
        profile: null as any,
        signupIncomplete: true
      };
    }

    authLogger.logRoleDetection('Profile fetched', { profileId: profile.id }, userId);

    // Step 2: Fetch tenant membership to get tenant_id
    const tenantMembership = await queryDeduplicator.deduplicate(
      `tenantMembership:${userId}`,
      () => this.fetchTenantMembership(userId)
    );

    if (!tenantMembership) {
      authLogger.logError(AuthLogCategory.ROLE_DETECTION, 'Tenant membership not found', undefined, { userId });
      throw new Error('User is not associated with any tenant');
    }

    const tenantId = tenantMembership.tenant_id;
    authLogger.logRoleDetection('Tenant membership fetched', { tenantId }, userId);

    // Step 3: Fetch user roles from user_roles table
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (rolesError) {
      authLogger.logError(AuthLogCategory.ROLE_DETECTION, 'Failed to fetch roles', rolesError, { userId });
      throw rolesError;
    }

    // Determine user attributes from roles
    const roles = userRoles?.map(r => r.role) || [];
    const isAdmin = roles.includes('admin');
    const isStaff = roles.includes('staff') || isAdmin;
    const isClient = roles.includes('client');

    authLogger.logRoleDetection('Roles fetched', {
      roles,
      isAdmin,
      isStaff,
      isClient
    }, userId);

    // Step 4: Fetch staff data if user is staff
    let staffData: StaffData | null = null;
    let isClinician = false;

    if (isStaff || isAdmin) {
      staffData = await queryDeduplicator.deduplicate(
        `staff:${userId}`,
        () => this.fetchStaffData(userId, tenantId)
      );

      if (staffData) {
        // Determine if clinical based on staff_role_assignments
        const { data: roleAssignments } = await supabase
          .from('staff_role_assignments')
          .select('staff_role_id, staff_roles!inner(is_clinical)')
          .eq('staff_id', staffData.id);

        isClinician = roleAssignments?.some((ra: any) => ra.staff_roles?.is_clinical) || false;

        authLogger.logRoleDetection('Staff data fetched', {
          staffId: staffData.id,
          provStatus: staffData.prov_status,
          isClinician
        }, userId);
      } else {
        authLogger.logRoleDetection('No staff record found', {}, userId);
      }
    }

    // Step 5: Build permissions from roles (no user_permissions table)
    const permissions: UserPermissions = {
      profile_id: userId,
      tenant_id: tenantId,
      access_appointments: isStaff || isAdmin,
      access_calendar: isStaff || isAdmin,
      access_customers: isStaff || isAdmin,
      access_forms: isStaff || isAdmin,
      access_services: isStaff || isAdmin,
      access_settings: isAdmin,
      access_user_management: isAdmin,
      supervisor: isAdmin
    };

    authLogger.logRoleDetection('Permissions derived from roles', {
      isAdmin,
      isStaff
    }, userId);

    // Build complete role context
    const roleContext: UserRoleContext = {
      userId,
      role: isStaff ? 'staff' : 'client',
      isStaff,
      isClient,
      isClinician,
      isAdmin,
      permissions,
      tenantId,
      profile,
      staffData: staffData || undefined
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
      .eq('id', userId)
      .single();

    if (error) {
      authLogger.logError(AuthLogCategory.ROLE_DETECTION, 'Failed to fetch profile', error, { userId });
      return null;
    }

    return data;
  }

  /**
   * Fetch tenant membership from database
   */
  private async fetchTenantMembership(
    userId: string
  ): Promise<{ tenant_id: string; tenant_role: string } | null> {
    const { data, error } = await supabase
      .from('tenant_memberships')
      .select('tenant_id, tenant_role')
      .eq('profile_id', userId)
      .maybeSingle();

    if (error) {
      authLogger.logError(AuthLogCategory.ROLE_DETECTION, 'Failed to fetch tenant membership', error, { userId });
      return null;
    }

    return data;
  }

  /**
   * Fetch staff data from database
   * Only called for staff users
   */
  private async fetchStaffData(
    userId: string,
    tenantId: string
  ): Promise<StaffData | null> {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('profile_id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      authLogger.logError(AuthLogCategory.ROLE_DETECTION, 'Failed to fetch staff data', error, { userId, tenantId });
      return null;
    }

    return data;
  }
}

// Export singleton instance
export const unifiedRoleDetectionService = new UnifiedRoleDetectionService();
