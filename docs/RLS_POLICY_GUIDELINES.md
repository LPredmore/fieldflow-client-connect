# RLS Policy Guidelines: Avoiding Circular Dependencies

## Overview

This document provides guidelines for writing Row Level Security (RLS) policies in Supabase that avoid circular dependencies and infinite recursion errors. These guidelines were developed after resolving the "infinite recursion detected in policy for relation 'clinicians'" error.

## Core Principles

### 1. Direct Authentication Pattern
Always prefer direct `auth.uid()` comparisons over cross-table references in RLS policies.

**✅ GOOD - Direct Authentication:**
```sql
CREATE POLICY "clinicians_select_policy" ON clinicians
FOR SELECT USING (user_id = auth.uid());
```

**❌ BAD - Cross-table Reference:**
```sql
CREATE POLICY "clinicians_select_policy" ON clinicians
FOR SELECT USING (
  user_id IN (
    SELECT user_id FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
);
```

### 2. Avoid Policy Chains
Never create policies that reference tables which themselves have policies that reference back to the original table.

**❌ PROBLEMATIC PATTERN:**
```
Table A policy → references Table B
Table B policy → references Table A
= INFINITE RECURSION
```

**✅ SAFE PATTERN:**
```
Table A policy → uses auth.uid() directly
Table B policy → uses auth.uid() directly
= NO CIRCULAR REFERENCES
```

## New Policy Structure

### User-Level Policies
For tables that store user-specific data, use direct user ID comparison:

```sql
-- Standard user access pattern
CREATE POLICY "table_user_access" ON table_name
FOR ALL USING (user_id = auth.uid());

-- Read-only user access
CREATE POLICY "table_user_select" ON table_name
FOR SELECT USING (user_id = auth.uid());

-- User can only modify their own records
CREATE POLICY "table_user_update" ON table_name
FOR UPDATE USING (user_id = auth.uid());
```

### Service-Level Policies
For system operations that need broader access:

```sql
-- Service role bypass for admin operations
CREATE POLICY "table_service_access" ON table_name
FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read public data
CREATE POLICY "table_public_read" ON table_name
FOR SELECT USING (auth.role() = 'authenticated');
```

### Tenant-Level Security
When tenant isolation is needed, implement it at the application level rather than in RLS policies:

```sql
-- Simple RLS policy
CREATE POLICY "table_user_access" ON table_name
FOR ALL USING (user_id = auth.uid());
```

```typescript
// Application-level tenant filtering
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('tenant_id', userTenantId); // Filter at application level
```

## Security Model

### Authentication Flow
1. **User Authentication**: JWT token contains `auth.uid()`
2. **Policy Evaluation**: RLS policies use `auth.uid()` directly
3. **Data Access**: Only user's own records are accessible
4. **Tenant Isolation**: Enforced at application layer when needed

### Access Control Hierarchy
1. **Service Role**: Full access (for system operations)
2. **Authenticated User**: Access to own records only
3. **Anonymous**: No access (unless explicitly granted)

## Performance Considerations

### Indexing Strategy
Always create indexes to support your RLS policies:

```sql
-- Index for user-based policies
CREATE INDEX IF NOT EXISTS idx_table_user_id ON table_name(user_id);

-- Composite index for complex queries
CREATE INDEX IF NOT EXISTS idx_table_user_status ON table_name(user_id, status);
```

### Query Optimization
- Keep policy conditions simple
- Avoid complex subqueries in policies
- Use application-level filtering for complex business logic

## Common Patterns

### 1. User Data Tables
```sql
-- clinicians, profiles, user_preferences, etc.
CREATE POLICY "user_data_access" ON user_data_table
FOR ALL USING (user_id = auth.uid());
```

### 2. Lookup Tables
```sql
-- specialties, treatment_types, etc.
CREATE POLICY "lookup_read_access" ON lookup_table
FOR SELECT USING (auth.role() = 'authenticated');
```

### 3. Audit Tables
```sql
-- activity_logs, audit_trail, etc.
CREATE POLICY "audit_user_read" ON audit_table
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "audit_service_write" ON audit_table
FOR INSERT USING (auth.role() = 'service_role');
```

## Migration Strategy

When updating existing policies:

1. **Analyze Dependencies**: Use policy analysis tools to identify circular references
2. **Create New Policies**: Write simplified policies using direct authentication
3. **Test Thoroughly**: Validate security and performance in development
4. **Deploy Safely**: Use migration scripts with rollback capability
5. **Monitor Performance**: Track policy evaluation times post-deployment

## Validation Checklist

Before deploying RLS policies, ensure:

- [ ] No cross-table references in policy conditions
- [ ] All policies use direct `auth.uid()` comparisons where possible
- [ ] Required indexes exist for policy conditions
- [ ] Policies have been tested with actual user scenarios
- [ ] Performance benchmarks meet requirements
- [ ] Security requirements are maintained
- [ ] Rollback plan exists for policy changes

## Tools and Scripts

Use these tools to validate your policies:

- `scripts/policy-analysis.js` - Analyze existing policies for circular dependencies
- `scripts/policy-dependency-mapper.js` - Map policy relationships
- `src/test/rlsPolicyTests.test.ts` - Test policy behavior
- `src/utils/automatedPolicyValidator.ts` - Automated policy validation

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- Project-specific policy analysis: `database-policy-analysis.md`