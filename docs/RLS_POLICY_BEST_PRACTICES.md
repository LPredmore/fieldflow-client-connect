# RLS Policy Development Best Practices

## Introduction

This guide provides best practices for developing Row Level Security (RLS) policies in Supabase. Following these practices will help you avoid common pitfalls like infinite recursion, performance issues, and security vulnerabilities.

## Core Best Practices

### 1. Keep It Simple
**Principle:** Simple policies are easier to understand, debug, and maintain.

**✅ DO:**
```sql
CREATE POLICY "user_access" ON clinicians
FOR ALL USING (user_id = auth.uid());
```

**❌ DON'T:**
```sql
CREATE POLICY "complex_access" ON clinicians
FOR ALL USING (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.status = 'active'
    AND p.role IN (
      SELECT role FROM permissions 
      WHERE table_name = 'clinicians'
    )
  )
);
```

### 2. Use Direct Authentication
**Principle:** Always prefer `auth.uid()` over complex subqueries.

**✅ DO:**
```sql
-- Direct user comparison
CREATE POLICY "direct_auth" ON user_data
FOR ALL USING (user_id = auth.uid());

-- Role-based access
CREATE POLICY "role_access" ON public_data
FOR SELECT USING (auth.role() = 'authenticated');
```

**❌ DON'T:**
```sql
-- Avoid complex subqueries
CREATE POLICY "complex_auth" ON user_data
FOR ALL USING (
  user_id IN (
    SELECT id FROM auth.users 
    WHERE id = auth.uid()
  )
);
```

### 3. Avoid Cross-Table References
**Principle:** Policies should not reference other tables with their own RLS policies.

**✅ DO:**
```sql
-- Each table has independent policies
CREATE POLICY "clinicians_access" ON clinicians
FOR ALL USING (user_id = auth.uid());

CREATE POLICY "profiles_access" ON profiles
FOR ALL USING (user_id = auth.uid());
```

**❌ DON'T:**
```sql
-- Avoid circular references
CREATE POLICY "clinicians_via_profiles" ON clinicians
FOR ALL USING (
  user_id IN (SELECT user_id FROM profiles WHERE user_id = auth.uid())
);
```

### 4. Index Your Policy Conditions
**Principle:** Every policy condition should be supported by an appropriate index.

**✅ DO:**
```sql
-- Create policy
CREATE POLICY "user_access" ON table_name
FOR ALL USING (user_id = auth.uid());

-- Support with index
CREATE INDEX IF NOT EXISTS idx_table_user_id ON table_name(user_id);
```

**Performance Impact:**
- Without index: O(n) table scan
- With index: O(log n) index lookup

### 5. Separate Concerns
**Principle:** Use different policies for different operations and roles.

**✅ DO:**
```sql
-- Separate policies for different operations
CREATE POLICY "user_select" ON table_name
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_insert" ON table_name
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "admin_all" ON table_name
FOR ALL USING (auth.role() = 'service_role');
```

**❌ DON'T:**
```sql
-- Overly complex single policy
CREATE POLICY "everything" ON table_name
FOR ALL USING (
  (user_id = auth.uid() AND operation = 'select') OR
  (user_id = auth.uid() AND operation = 'insert' AND status = 'draft') OR
  (auth.role() = 'service_role')
);
```

## Policy Patterns

### 1. User Data Pattern
For tables storing user-specific data:

```sql
-- Standard user access
CREATE POLICY "user_data_access" ON user_table
FOR ALL USING (user_id = auth.uid());

-- Required index
CREATE INDEX IF NOT EXISTS idx_user_table_user_id ON user_table(user_id);
```

**Use Cases:**
- User profiles
- User preferences
- User-generated content
- Personal data

### 2. Public Data Pattern
For tables with data accessible to all authenticated users:

```sql
-- Read access for authenticated users
CREATE POLICY "public_read" ON lookup_table
FOR SELECT USING (auth.role() = 'authenticated');

-- Admin write access
CREATE POLICY "admin_write" ON lookup_table
FOR INSERT, UPDATE, DELETE USING (auth.role() = 'service_role');
```

**Use Cases:**
- Lookup tables
- Reference data
- Public configurations
- Shared resources

### 3. Hierarchical Access Pattern
For tables with role-based access:

```sql
-- User can access their own records
CREATE POLICY "user_access" ON hierarchical_table
FOR ALL USING (user_id = auth.uid());

-- Managers can access team records (application-level filtering)
-- Note: Complex hierarchy should be handled in application code
```

**Implementation:**
```typescript
// Application-level role filtering
const getUserAccessibleRecords = async (userId: string, userRole: string) => {
  let query = supabase.from('hierarchical_table').select('*');
  
  if (userRole === 'manager') {
    // Get team member IDs from application logic
    const teamMemberIds = await getTeamMemberIds(userId);
    query = query.in('user_id', [userId, ...teamMemberIds]);
  } else {
    query = query.eq('user_id', userId);
  }
  
  return query;
};
```

### 4. Audit Trail Pattern
For tables that log user activities:

```sql
-- Users can read their own audit logs
CREATE POLICY "audit_user_read" ON audit_logs
FOR SELECT USING (user_id = auth.uid());

-- System can write audit logs
CREATE POLICY "audit_system_write" ON audit_logs
FOR INSERT USING (auth.role() = 'service_role');

-- No updates or deletes allowed
-- (Audit logs should be immutable)
```

### 5. Tenant Isolation Pattern
For multi-tenant applications:

```sql
-- Simple RLS policy
CREATE POLICY "tenant_user_access" ON tenant_data
FOR ALL USING (user_id = auth.uid());

-- Required indexes
CREATE INDEX IF NOT EXISTS idx_tenant_data_user_id ON tenant_data(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_data_tenant_id ON tenant_data(tenant_id);
```

```typescript
// Application-level tenant filtering
const getTenantData = async (userId: string) => {
  // Get user's tenant from application logic
  const userTenant = await getUserTenant(userId);
  
  return supabase
    .from('tenant_data')
    .select('*')
    .eq('tenant_id', userTenant.id); // Filter by tenant at application level
};
```

## Common Pitfalls and How to Avoid Them

### 1. Circular Dependencies
**Problem:** Policies that reference each other create infinite loops.

**Example of Problem:**
```sql
-- Table A references Table B
CREATE POLICY "a_policy" ON table_a
FOR SELECT USING (id IN (SELECT ref_id FROM table_b WHERE user_id = auth.uid()));

-- Table B references Table A (CIRCULAR!)
CREATE POLICY "b_policy" ON table_b
FOR SELECT USING (ref_id IN (SELECT id FROM table_a WHERE user_id = auth.uid()));
```

**Solution:**
```sql
-- Use direct authentication instead
CREATE POLICY "a_policy" ON table_a
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "b_policy" ON table_b
FOR SELECT USING (user_id = auth.uid());
```

### 2. Performance Issues
**Problem:** Complex policies without proper indexing cause slow queries.

**Example of Problem:**
```sql
-- Slow policy without index
CREATE POLICY "slow_policy" ON large_table
FOR SELECT USING (
  user_id = auth.uid() AND
  status IN ('active', 'pending') AND
  created_at > NOW() - INTERVAL '30 days'
);
```

**Solution:**
```sql
-- Same policy with proper indexing
CREATE POLICY "fast_policy" ON large_table
FOR SELECT USING (
  user_id = auth.uid() AND
  status IN ('active', 'pending') AND
  created_at > NOW() - INTERVAL '30 days'
);

-- Supporting indexes
CREATE INDEX IF NOT EXISTS idx_large_table_user_status_date 
ON large_table(user_id, status, created_at);
```

### 3. Security Gaps
**Problem:** Policies that don't cover all operations or edge cases.

**Example of Problem:**
```sql
-- Only covers SELECT, missing INSERT/UPDATE/DELETE
CREATE POLICY "incomplete_policy" ON user_data
FOR SELECT USING (user_id = auth.uid());
```

**Solution:**
```sql
-- Complete policy coverage
CREATE POLICY "user_select" ON user_data
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_insert" ON user_data
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_update" ON user_data
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_delete" ON user_data
FOR DELETE USING (user_id = auth.uid());
```

### 4. Over-Engineering
**Problem:** Making policies more complex than necessary.

**Example of Problem:**
```sql
-- Overly complex policy
CREATE POLICY "over_engineered" ON simple_table
FOR ALL USING (
  CASE 
    WHEN auth.role() = 'service_role' THEN true
    WHEN auth.role() = 'authenticated' AND user_id = auth.uid() THEN true
    WHEN auth.role() = 'authenticated' AND shared = true THEN true
    ELSE false
  END
);
```

**Solution:**
```sql
-- Separate, simple policies
CREATE POLICY "service_access" ON simple_table
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "user_access" ON simple_table
FOR ALL USING (user_id = auth.uid());

CREATE POLICY "shared_read" ON simple_table
FOR SELECT USING (shared = true AND auth.role() = 'authenticated');
```

## Development Workflow

### 1. Planning Phase
- [ ] Identify data access patterns
- [ ] Define user roles and permissions
- [ ] Map out table relationships
- [ ] Plan policy structure

### 2. Implementation Phase
- [ ] Write simple, focused policies
- [ ] Create supporting indexes
- [ ] Test with realistic data
- [ ] Validate security requirements

### 3. Testing Phase
- [ ] Unit test individual policies
- [ ] Integration test policy interactions
- [ ] Performance test with load
- [ ] Security test edge cases

### 4. Deployment Phase
- [ ] Use migration scripts
- [ ] Deploy with rollback capability
- [ ] Monitor performance post-deployment
- [ ] Validate functionality in production

## Testing Your Policies

### 1. Unit Testing
```typescript
// Test individual policy behavior
describe('Clinicians RLS Policy', () => {
  it('should allow users to access their own records', async () => {
    const { data, error } = await supabase
      .from('clinicians')
      .select('*')
      .eq('user_id', testUserId);
    
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].user_id).toBe(testUserId);
  });
  
  it('should deny access to other users records', async () => {
    const { data, error } = await supabase
      .from('clinicians')
      .select('*')
      .eq('user_id', otherUserId);
    
    expect(data).toHaveLength(0); // RLS should filter out other user's data
  });
});
```

### 2. Performance Testing
```typescript
// Test policy performance
describe('Policy Performance', () => {
  it('should execute queries within acceptable time limits', async () => {
    const startTime = Date.now();
    
    const { data, error } = await supabase
      .from('large_table')
      .select('*')
      .limit(100);
    
    const executionTime = Date.now() - startTime;
    expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds
  });
});
```

### 3. Security Testing
```typescript
// Test security boundaries
describe('Security Validation', () => {
  it('should prevent unauthorized data access', async () => {
    // Attempt to access data without proper authentication
    const unauthenticatedClient = createClient(url, anonKey);
    
    const { data, error } = await unauthenticatedClient
      .from('protected_table')
      .select('*');
    
    expect(data).toHaveLength(0);
  });
});
```

## Tools and Resources

### 1. Analysis Tools
- `scripts/policy-analysis.js` - Detect circular dependencies
- `scripts/policy-dependency-mapper.js` - Visualize policy relationships
- `src/utils/automatedPolicyValidator.ts` - Automated validation

### 2. Testing Tools
- `src/test/rlsPolicyTests.test.ts` - Policy test suite
- `src/test/policyPerformanceRunner.ts` - Performance benchmarks
- `src/test/rlsPolicyTestUtils.ts` - Testing utilities

### 3. Monitoring Tools
- Policy Performance Dashboard - Monitor policy execution times
- Policy Validation Dashboard - Check for issues
- Automated alerts for policy errors

### 4. Documentation
- `docs/RLS_POLICY_GUIDELINES.md` - Comprehensive guidelines
- `docs/RLS_POLICY_TROUBLESHOOTING.md` - Troubleshooting guide
- `database-policy-analysis.md` - Project-specific analysis

## Quick Reference

### Essential Commands
```sql
-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Create user access policy
CREATE POLICY "user_access" ON table_name
FOR ALL USING (user_id = auth.uid());

-- Create supporting index
CREATE INDEX IF NOT EXISTS idx_table_user_id ON table_name(user_id);

-- Check policy status
SELECT * FROM pg_policies WHERE tablename = 'table_name';
```

### Testing Commands
```bash
# Run policy tests
npm run test:policies

# Analyze dependencies
node scripts/policy-analysis.js

# Performance benchmarks
npm run test:performance
```

### Common Policy Templates
```sql
-- User data access
CREATE POLICY "user_data" ON table_name
FOR ALL USING (user_id = auth.uid());

-- Public read access
CREATE POLICY "public_read" ON table_name
FOR SELECT USING (auth.role() = 'authenticated');

-- Service role bypass
CREATE POLICY "service_bypass" ON table_name
FOR ALL USING (auth.role() = 'service_role');
```

Remember: Simple, well-indexed policies are always better than complex, clever ones!