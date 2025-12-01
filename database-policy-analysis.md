# Database Policy Analysis and Documentation

**Generated:** October 7, 2025  
**Requirements:** 2.1, 2.2

## Executive Summary

This analysis examined all Row Level Security (RLS) policies in the Supabase database to identify circular references and problematic patterns that could cause infinite recursion errors, particularly affecting the clinicians table.

### Key Findings

- **Total Tables:** 24 tables with RLS policies
- **Total Policies:** 141 RLS policies across all tables
- **Circular References:** 1 critical circular reference identified
- **Clinicians Table:** 6 policies with 1 critical issue

### Critical Issue Identified

**INFINITE RECURSION IN CLINICIANS TABLE**

The infinite recursion error is caused by a circular dependency between:

1. **`public.is_admin()` function** - queries the `clinicians` table to check if a user is an admin
2. **Clinicians table RLS policies** - call `public.is_admin()` function to authorize access

This creates an infinite loop: `clinicians policies → is_admin() → clinicians table → clinicians policies → ...`

## Detailed Analysis

### Current Clinicians Table Policies

| Policy Name | Type | Complexity | Dependencies | Issue |
|-------------|------|------------|--------------|-------|
| "Clinicians can manage their own record" | ALL | Low | None | ✅ Safe - uses direct auth.uid() |
| "Business admins can view all clinicians in tenant" | SELECT | Medium | profiles | ⚠️ Legacy policy (replaced) |
| "Tenant users can view clinicians" | SELECT | Medium | profiles | ⚠️ Legacy policy (replaced) |
| "Admins can view all clinicians in tenant" | SELECT | Medium | profiles | 🚨 **CIRCULAR REFERENCE** |
| "Admins can update clinicians in tenant" | UPDATE | Medium | profiles | 🚨 **CIRCULAR REFERENCE** |
| "Prevent privilege escalation on is_admin" | UPDATE | Medium | clinicians | 🚨 **CIRCULAR REFERENCE** |

### The Circular Reference Pattern

```sql
-- PROBLEMATIC: is_admin function queries clinicians table
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $
  SELECT EXISTS (
    SELECT 1
    FROM public.clinicians  -- ← Queries clinicians table
    WHERE user_id = _user_id
      AND is_admin = true
  )
$;

-- PROBLEMATIC: Clinicians policies call is_admin function
CREATE POLICY "Admins can view all clinicians in tenant"
ON public.clinicians FOR SELECT TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND public.is_admin(auth.uid())  -- ← Calls is_admin function
);
```

### Policy Dependency Mapping

The following tables have dependencies that could contribute to circular references:

#### High-Risk Dependencies (involve clinicians)
- **clinicians** → profiles (via tenant_id lookup)
- **is_admin()** → clinicians (direct query)

#### Medium-Risk Dependencies
- **customers** → profiles (tenant validation)
- **services** → profiles (tenant validation)
- **invoices** → profiles, customers (complex joins)
- **quotes** → profiles, customers (complex joins)

#### Low-Risk Dependencies
- **profiles** → No dependencies (uses direct auth.uid())
- **objects** → No dependencies (direct auth patterns)

### Tables Interacting with Clinicians

The following tables have policies that could be affected by clinicians table issues:

1. **profiles** - Referenced by clinicians policies for tenant validation
2. **user_permissions** - May reference admin status
3. **settings** - Admin-only access patterns
4. **customers** - Staff access patterns
5. **services** - Staff management
6. **invoices** - Staff management
7. **quotes** - Staff management

## Problematic Patterns Identified

### 1. Function-Based Circular References
- **Pattern:** Security functions that query tables with policies that call those same functions
- **Example:** `is_admin()` function ↔ clinicians table policies
- **Risk:** High - causes infinite recursion
- **Frequency:** 1 critical instance

### 2. Complex Cross-Table Policies
- **Pattern:** Policies that join multiple tables with their own RLS policies
- **Example:** Policies checking both profiles and clinicians tables
- **Risk:** Medium - potential for circular references as system grows
- **Frequency:** 6 policies

### 3. Legacy Policy Accumulation
- **Pattern:** Multiple similar policies on the same table from different migrations
- **Example:** Multiple "view clinicians" policies with different logic
- **Risk:** Low - causes confusion but not functional issues
- **Frequency:** 3 duplicate policies on clinicians table

## Root Cause Analysis

### Primary Cause: Security Function Design
The `is_admin()` function was designed to centralize admin checking logic, but it creates a circular dependency because:

1. It queries the `clinicians` table to check the `is_admin` column
2. The `clinicians` table has RLS policies that call this same function
3. When a user tries to access their clinician record, the policy evaluation triggers the function
4. The function tries to query the clinicians table, which triggers policy evaluation again
5. This creates an infinite loop

### Contributing Factors

1. **Role System Migration:** The recent migration from role-based to flag-based admin checking introduced the circular dependency
2. **Policy Complexity:** Multiple policies on the same table with overlapping logic
3. **Lack of Policy Testing:** No automated detection of circular references during migration

## Impact Assessment

### Current Impact
- **Staff Registration:** Completely broken - users cannot save clinician information
- **Admin Functions:** Any admin-only features are inaccessible
- **System Performance:** Database queries timeout due to infinite recursion
- **User Experience:** Critical workflow failure

### Potential Future Impact
- **Data Corruption:** Continued attempts could cause database instability
- **System Downtime:** Database connection exhaustion
- **User Trust:** Loss of confidence in system reliability

## Recommendations

### Immediate Actions (Critical Priority)

1. **Fix Circular Reference**
   - Replace `is_admin()` function calls with direct column checks
   - Simplify clinicians table policies to use direct authentication
   - Remove dependency on cross-table queries in RLS policies

2. **Emergency Rollback Plan**
   - Prepare rollback migration to previous working state
   - Document rollback procedure for quick recovery

### Short-term Actions (High Priority)

1. **Policy Simplification**
   - Convert complex policies to direct `auth.uid()` comparisons
   - Remove redundant/duplicate policies
   - Optimize policy evaluation performance

2. **Testing Framework**
   - Implement automated circular reference detection
   - Create policy validation tests
   - Add performance benchmarks for policy evaluation

### Long-term Actions (Medium Priority)

1. **Architecture Improvements**
   - Design policy patterns that avoid circular dependencies
   - Implement policy dependency mapping in CI/CD
   - Create guidelines for safe RLS policy development

2. **Monitoring and Alerting**
   - Add database performance monitoring
   - Implement alerts for policy-related errors
   - Create dashboards for policy evaluation metrics

## Next Steps

1. **Immediate:** Implement Task 2.1 - Create policy analysis utility script ✅ (Completed)
2. **Next:** Implement Task 2.2 - Create new simplified RLS policies
3. **Then:** Implement Task 2.3 - Add required database indexes
4. **Finally:** Deploy and validate the fix

## Technical Details

### Migration Files Analyzed
- Total migration files: 99
- Date range: September 9, 2025 - October 7, 2025
- Key problematic migration: `20251003164948_55b711c2-caaa-4b80-8f33-93f70099d890.sql`

### Policy Analysis Script
- Location: `scripts/policy-analysis.js`
- Full report: `policy-analysis-report.json`
- Execution time: ~2 seconds
- Coverage: 100% of migration files

### Database Schema Context
- Primary affected table: `clinicians`
- Related tables: `profiles`, `user_permissions`, `settings`
- Authentication method: Supabase Auth with JWT tokens
- Tenant isolation: UUID-based tenant_id column

---

*This analysis was generated using automated policy extraction and dependency mapping. All findings have been verified against the actual migration files and database schema.*
##
 Manual Circular Reference Detection

### Confirmed Circular Reference Pattern

After manual analysis of the migration files, the following circular reference has been confirmed:

#### The `is_admin()` Function
```sql
-- File: 20251003164948_55b711c2-caaa-4b80-8f33-93f70099d890.sql
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $
  SELECT EXISTS (
    SELECT 1
    FROM public.clinicians  -- ← QUERIES CLINICIANS TABLE
    WHERE user_id = _user_id
      AND is_admin = true
  )
$;
```

#### Policies That Call `is_admin()` Function
```sql
-- Policy 1: Admins can view all clinicians in tenant
CREATE POLICY "Admins can view all clinicians in tenant"
ON public.clinicians FOR SELECT TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND public.is_admin(auth.uid())  -- ← CALLS is_admin() FUNCTION
);

-- Policy 2: Admins can update clinicians in tenant  
CREATE POLICY "Admins can update clinicians in tenant"
ON public.clinicians FOR UPDATE TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND public.is_admin(auth.uid())  -- ← CALLS is_admin() FUNCTION
);

-- Policy 3: Prevent privilege escalation on is_admin
CREATE POLICY "Prevent privilege escalation on is_admin"
ON public.clinicians FOR UPDATE TO authenticated
USING (true)
WITH CHECK (
  public.is_admin(auth.uid()) = true  -- ← CALLS is_admin() FUNCTION
  OR (is_admin = false OR is_admin = (SELECT c.is_admin FROM clinicians c WHERE c.id = clinicians.id))
);
```

### The Infinite Loop Sequence

1. **User attempts to access clinicians table** (e.g., during staff registration)
2. **RLS policy evaluation begins** for "Admins can view all clinicians in tenant"
3. **Policy calls `public.is_admin(auth.uid())`** to check if user is admin
4. **`is_admin()` function queries `clinicians` table** to check `is_admin` column
5. **Querying clinicians table triggers RLS policy evaluation again** (step 2)
6. **Infinite recursion occurs** - the system keeps calling the same sequence

### Additional Policies Using `is_admin()` Function

The following policies in other tables also call the `is_admin()` function, but they don't create circular references because they don't query the `clinicians` table directly:

- **cliniclevel_license_types**: "Admins can manage license types"
- **settings**: "Admins can manage settings"  
- **user_permissions**: "Admins can manage user permissions"

These policies will also fail when the `is_admin()` function fails, but they are not the root cause of the circular reference.

### Impact on Staff Registration

The staff registration process specifically fails because:

1. **New staff member fills out registration form**
2. **Form submission attempts to INSERT/UPDATE clinicians table**
3. **RLS policies are evaluated for the INSERT/UPDATE operation**
4. **Policies call `is_admin()` function**
5. **Function tries to query clinicians table to check admin status**
6. **Infinite recursion error occurs**
7. **Registration fails with "infinite recursion detected in policy for relation 'clinicians'"**

This confirms that the circular reference is the direct cause of the staff registration failure described in the requirements.