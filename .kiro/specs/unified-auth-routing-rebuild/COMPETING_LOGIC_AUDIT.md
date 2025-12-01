# Competing Authentication and Routing Logic Audit

## Overview
This document identifies all existing authentication flows, routing logic, and role detection code that competes with the new unified authentication system.

**Audit Date:** $(date)
**Status:** Task 6.1 - Identification Complete

---

## 1. Existing Authentication Flows

### 1.1 Old useAuth Hook (`src/hooks/useAuth.tsx`)
**Status:** COMPETING - Must be disabled
**Description:** Legacy authentication hook that:
- Fetches user data on mount and auth state changes
- Queries profiles, clinicians, and user_permissions tables directly
- Has its own caching logic via authCacheService
- Manages loading and error states independently

**Specific Issues:**
- Lines 55-59: Direct queries to profiles and clinicians tables on auth state change
- Lines 165-169: Duplicate queries on session restoration
- Uses authCacheService for caching (competes with SessionCacheService)
- Provides its own context (competes with AuthenticationProvider)

**Impact:** HIGH - This is a primary competing flow

**Files:**
- `src/hooks/useAuth.tsx` (entire file)

---

### 1.2 AuthCacheService (`src/utils/authCacheService.ts`)
**Status:** COMPETING - Must be disabled
**Description:** Legacy caching service that:
- Caches authentication data independently
- Queries profiles, clinicians, and user_permissions tables
- Has its own network health management
- Provides fallback logic for offline functionality

**Specific Issues:**
- Lines 42-46: Direct queries to profiles, clinicians, and user_permissions
- Competes with SessionCacheService
- Has its own cache invalidation logic
- Manages network health state independently

**Impact:** HIGH - Provides competing caching mechanism

**Files:**
- `src/utils/authCacheService.ts` (entire file)

---

### 1.3 AuthSupabaseClient (`src/utils/authSupabaseClient.ts`)
**Status:** KEEP - Used by new system
**Description:** Wrapper for Supabase auth that bypasses circuit breaker
- Used by both old and new authentication systems
- Provides signInWithPassword, signUp, signOut methods
- Should be kept as it's used by AuthenticationProvider

**Impact:** LOW - Already integrated with new system

**Files:**
- `src/utils/authSupabaseClient.ts` (keep)

---

## 2. Existing Routing Logic

### 2.1 RouteGuard Service (`src/services/routeGuard.ts`)
**Status:** COMPETING - Must be disabled
**Description:** Legacy route guard that:
- Determines route access based on clinician status
- Queries staffTypeDetector and clinicianStatusManager
- Provides redirect logic for clinicians
- Has its own audit logging

**Specific Issues:**
- Lines 75-150: Route access evaluation logic (competes with UnifiedRoutingGuard)
- Lines 160-200: Redirect path determination
- Uses staffTypeDetector and clinicianStatusManager (old services)
- Provides EMR domain path checking

**Impact:** HIGH - Primary competing routing logic

**Files:**
- `src/services/routeGuard.ts` (entire file)

---

### 2.2 ProtectedRoute Component (`src/components/ProtectedRoute.tsx`)
**Status:** COMPETING - Must be disabled
**Description:** Legacy route protection component that:
- Wraps routes with access control
- Uses routeGuard service for access decisions
- Provides loading and error states
- Handles redirects based on route decisions

**Specific Issues:**
- Lines 70-130: Route access evaluation using routeGuard
- Lines 110-120: Redirect execution
- Competes with UnifiedRoutingGuard
- Uses old useAuth hook

**Impact:** HIGH - Primary route protection mechanism

**Files:**
- `src/components/ProtectedRoute.tsx` (entire file)

---

### 2.3 ClientProtectedRoute Component (`src/components/ClientProtectedRoute.tsx`)
**Status:** COMPETING - Must be disabled
**Description:** Client-specific route protection that:
- Protects client portal routes
- Uses old useAuth hook
- Has its own redirect logic for client registration
- Manages redirect loop prevention

**Specific Issues:**
- Lines 40-80: Client-specific routing logic
- Uses old useAuth hook
- Has redirect loop prevention (competes with UnifiedRoutingGuard)
- Manages client registration flow

**Impact:** MEDIUM - Client portal specific

**Files:**
- `src/components/ClientProtectedRoute.tsx` (entire file)

---

### 2.4 ClinicianRedirectHandler (`src/components/ClinicianRedirectHandler.tsx`)
**Status:** COMPETING - Must be disabled
**Description:** Handles automatic redirects for clinicians based on status
- Uses staffTypeDetector and clinicianStatusManager
- Uses routeGuard for redirect path determination
- Provides redirect evaluation logic
- Has its own loading states

**Specific Issues:**
- Lines 80-150: Redirect evaluation logic
- Uses old services (staffTypeDetector, clinicianStatusManager, routeGuard)
- Competes with UnifiedRoutingGuard redirect logic
- Provides useClinicianRedirect hook

**Impact:** HIGH - Clinician-specific routing

**Files:**
- `src/components/ClinicianRedirectHandler.tsx` (entire file)

---

### 2.5 ClinicianRoutingProvider (`src/components/ClinicianRoutingProvider.tsx`)
**Status:** COMPETING - Must be disabled
**Description:** Comprehensive routing provider that integrates:
- ProtectedRoute
- NavigationInterceptor
- ClinicianRedirectHandler
- Provides routing context

**Specific Issues:**
- Lines 60-120: Integrates multiple competing components
- Provides its own routing context
- Wraps routes with old protection logic
- Uses old useEnhancedStaffRouting hook

**Impact:** HIGH - Top-level routing orchestration

**Files:**
- `src/components/ClinicianRoutingProvider.tsx` (entire file)

---

### 2.6 AuthenticationRoutingOrchestrator (`src/services/authenticationRoutingOrchestrator.ts`)
**Status:** COMPETING - Must be disabled
**Description:** Orchestrates authentication and routing flow
- Coordinates staffTypeDetector, clinicianStatusManager, routeGuard
- Provides coordinateUserFlow method
- Has retry logic and error handling
- Provides health check functionality

**Specific Issues:**
- Lines 130-250: User flow coordination (competes with AuthenticationProvider)
- Uses old services throughout
- Provides its own error handling and retry logic
- Has performance monitoring

**Impact:** HIGH - High-level orchestration

**Files:**
- `src/services/authenticationRoutingOrchestrator.ts` (entire file)

---

## 3. Role Detection Logic

### 3.1 StaffTypeDetector (`src/utils/staffTypeDetector.ts`)
**Status:** COMPETING - Must be disabled
**Description:** Detects if user is clinician staff
- Queries clinicians table directly
- Has its own caching mechanism
- Provides isClinicianStaff method

**Impact:** HIGH - Competes with RoleDetectionService

**Files:**
- `src/utils/staffTypeDetector.ts` (needs investigation)

---

### 3.2 ClinicianStatusManager (`src/services/clinicianStatusManager.ts`)
**Status:** COMPETING - Must be disabled
**Description:** Manages clinician status
- Queries clinicians table for status
- Provides status update methods
- Has its own caching

**Impact:** HIGH - Competes with RoleDetectionService

**Files:**
- `src/services/clinicianStatusManager.ts` (needs investigation)

---

## 4. Direct Database Queries for Auth Data

### 4.1 Profiles Table Queries
**Locations:**
- `src/hooks/useAuth.tsx` (lines 56, 166)
- `src/utils/authCacheService.ts` (line 44)
- `src/components/Forms/FormBuilder/FormBuilder.tsx` (line 49)

**Status:** MUST REPLACE with useAuth() hook from AuthenticationProvider

---

### 4.2 Clinicians Table Queries
**Locations:**
- `src/hooks/useAuth.tsx` (lines 58, 168)
- `src/utils/authCacheService.ts` (line 45)
- `src/utils/staffTypeDetector.ts` (needs investigation)
- `src/services/clinicianStatusManager.ts` (needs investigation)

**Status:** MUST REPLACE with useAuth() hook from AuthenticationProvider

---

### 4.3 User Permissions Table Queries
**Locations:**
- `src/utils/authCacheService.ts` (line 46)

**Status:** MUST REPLACE with useAuth() hook from AuthenticationProvider

---

## 5. Summary of Competing Components

### High Priority (Must Disable First)
1. `src/hooks/useAuth.tsx` - Old auth hook
2. `src/providers/AuthenticationProvider.tsx` - Wait, this is the NEW one! Keep it!
3. `src/utils/authCacheService.ts` - Old caching service
4. `src/services/routeGuard.ts` - Old route guard
5. `src/components/ProtectedRoute.tsx` - Old route protection
6. `src/components/ClinicianRedirectHandler.tsx` - Old redirect handler
7. `src/components/ClinicianRoutingProvider.tsx` - Old routing provider
8. `src/services/authenticationRoutingOrchestrator.ts` - Old orchestrator

### Medium Priority
1. `src/components/ClientProtectedRoute.tsx` - Client route protection
2. `src/utils/staffTypeDetector.ts` - Staff type detection
3. `src/services/clinicianStatusManager.ts` - Status management

### Low Priority (Review and Update)
1. `src/components/Forms/FormBuilder/FormBuilder.tsx` - Update to use new auth
2. Any other components querying auth tables directly

---

## 6. Integration Points to Update

### Components Using Old useAuth Hook
Need to search for all imports of `@/hooks/useAuth` and update to use new AuthenticationProvider context.

### Components Using Old Route Protection
Need to search for all uses of:
- `<ProtectedRoute>`
- `<ClientProtectedRoute>`
- `<ClinicianRoutingProvider>`

And replace with `<UnifiedRoutingGuard>`.

---

### 2.7 NavigationInterceptor (`src/components/NavigationInterceptor.tsx`)
**Status:** COMPETING - Must be disabled
**Description:** Intercepts navigation events for EMR domain pages
- Uses routeGuard service for access decisions
- Monitors location changes and intercepts navigation
- Provides useProtectedNavigation hook
- Has its own navigation protection logic

**Specific Issues:**
- Lines 60-100: Navigation interception logic (competes with UnifiedRoutingGuard)
- Uses old routeGuard service
- Provides useProtectedNavigation hook (competes with new routing)
- Has its own redirect execution

**Impact:** HIGH - Navigation interception

**Files:**
- `src/components/NavigationInterceptor.tsx` (entire file)

---

### 2.8 useEnhancedStaffRouting Hook (`src/hooks/useEnhancedStaffRouting.tsx`)
**Status:** COMPETING - Must be disabled
**Description:** Network-resilient routing hook
- Uses roleDetectionService (old service)
- Uses routingProtectionService (old service)
- Provides routing state determination
- Has its own role detection logic

**Specific Issues:**
- Lines 65-110: Role detection logic (competes with RoleDetectionService)
- Uses old roleDetectionService
- Provides routing state (competes with UnifiedRoutingGuard)
- Has network resilience logic

**Impact:** HIGH - Routing state management

**Files:**
- `src/hooks/useEnhancedStaffRouting.tsx` (entire file)

---

### 2.9 EnhancedAppRouterWithProtection (`src/components/EnhancedAppRouterWithProtection.tsx`)
**Status:** COMPETING - Must be disabled
**Description:** Enhanced router with protection and network awareness
- Uses useEnhancedStaffRouting hook
- Uses routingProtectionService
- Provides safe navigation with loop prevention
- Has its own protection UI

**Specific Issues:**
- Lines 60-160: Routing and protection logic (competes with UnifiedRoutingGuard)
- Uses old useEnhancedStaffRouting hook
- Has its own redirect logic
- Provides protection mode UI (competes with CircuitBreakerRecoveryUI)

**Impact:** HIGH - Top-level routing wrapper

**Files:**
- `src/components/EnhancedAppRouterWithProtection.tsx` (entire file)

---

### 2.10 Additional Services to Investigate
**Status:** NEEDS INVESTIGATION
**Description:** Additional services that may compete with new system:
- `src/services/roleDetectionService.ts` - Old role detection
- `src/services/routingProtectionService.ts` - Old routing protection
- `src/services/safeNavigationManager.ts` - Old navigation management
- `src/utils/staffTypeDetector.ts` - Staff type detection
- `src/services/clinicianStatusManager.ts` - Status management

**Impact:** HIGH - Core services

---

## Next Steps (Task 6.3)
1. Comment out old authentication logic
2. Add comments explaining why code is disabled
3. Ensure no old flows can execute
4. Test that only new unified flow runs

---

## Notes
- The new AuthenticationProvider in `src/providers/AuthenticationProvider.tsx` is the CORRECT one to keep
- The old useAuth hook in `src/hooks/useAuth.tsx` is the one to disable
- Need to ensure all components switch from old useAuth to new useAuth from AuthenticationProvider
- Many components use old routing services that need to be disabled
- The new system uses UnifiedRoutingGuard instead of all the old routing components
