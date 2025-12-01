# RLS Policy Troubleshooting Guide

## Common Issues and Solutions

### 1. Infinite Recursion Errors

**Error Message:**
```
infinite recursion detected in policy for relation 'table_name'
```

**Cause:**
Circular dependencies between RLS policies on different tables.

**Solution:**
1. Identify the circular reference using policy analysis tools
2. Simplify policies to use direct `auth.uid()` comparisons
3. Remove cross-table references in policy conditions

**Example Fix:**
```sql
-- BEFORE (problematic)
CREATE POLICY "clinicians_policy" ON clinicians
FOR SELECT USING (
  user_id IN (SELECT user_id FROM profiles WHERE profiles.user_id = auth.uid())
);

-- AFTER (fixed)
CREATE POLICY "clinicians_policy" ON clinicians
FOR SELECT USING (user_id = auth.uid());
```

### 2. Slow Query Performance

**Symptoms:**
- Queries taking longer than expected
- High CPU usage on database
- Timeout errors

**Diagnosis:**
```sql
-- Check policy evaluation time
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM table_name WHERE user_id = 'user-id';
```

**Solutions:**
1. Add proper indexes for policy conditions
2. Simplify policy logic
3. Move complex filtering to application level

**Index Examples:**
```sql
CREATE INDEX IF NOT EXISTS idx_table_user_id ON table_name(user_id);
CREATE INDEX IF NOT EXISTS idx_table_composite ON table_name(user_id, status, created_at);
```

### 3. Access Denied Errors

**Error Message:**
```
new row violates row-level security policy for table "table_name"
```

**Cause:**
Policy conditions are too restrictive or incorrectly configured.

**Debugging Steps:**
1. Check if user is authenticated: `SELECT auth.uid()`
2. Verify user_id in the record matches authenticated user
3. Test policy conditions manually

**Common Fixes:**
```sql
-- Ensure INSERT policy allows user to create their own records
CREATE POLICY "table_insert_policy" ON table_name
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Ensure UPDATE policy allows user to modify their own records
CREATE POLICY "table_update_policy" ON table_name
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

### 4. Policy Not Applied

**Symptoms:**
- Users can access data they shouldn't
- Policies seem to be ignored

**Checks:**
1. Verify RLS is enabled on the table:
```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'your_table_name';
```

2. Enable RLS if needed:
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

3. Check policy exists and is active:
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'your_table_name';
```

### 5. Service Role Access Issues

**Problem:**
System operations failing due to RLS restrictions.

**Solution:**
Create service role bypass policies:
```sql
CREATE POLICY "table_service_bypass" ON table_name
FOR ALL USING (auth.role() = 'service_role');
```

**Application Usage:**
```typescript
// Use service role for system operations
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('id', recordId);
```

## Diagnostic Tools

### 1. Policy Analysis Script
```bash
node scripts/policy-analysis.js
```
- Identifies circular dependencies
- Maps policy relationships
- Generates dependency report

### 2. Policy Performance Testing
```bash
npm run test:policies
```
- Tests policy evaluation performance
- Validates security requirements
- Checks for common issues

### 3. Database Query Analysis
```sql
-- Check current policies
SELECT * FROM pg_policies WHERE schemaname = 'public';

-- Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Analyze query performance
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) 
SELECT * FROM table_name WHERE condition;
```

## Emergency Procedures

### 1. Disable RLS Temporarily
**⚠️ Use only in emergencies - removes all security!**
```sql
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
```

### 2. Drop Problematic Policy
```sql
DROP POLICY IF EXISTS policy_name ON table_name;
```

### 3. Rollback Migration
```bash
node scripts/migration-executor.js --rollback
```

## Prevention Strategies

### 1. Pre-deployment Validation
- Run policy analysis before deploying
- Test with realistic data volumes
- Validate security requirements

### 2. Monitoring Setup
- Monitor query performance
- Set up alerts for policy errors
- Track policy evaluation times

### 3. Code Review Checklist
- [ ] No circular policy dependencies
- [ ] Required indexes exist
- [ ] Policies tested with user scenarios
- [ ] Performance benchmarks met
- [ ] Security requirements validated

## Getting Help

### 1. Check Logs
```typescript
// Enable detailed logging
const supabase = createClient(url, key, {
  auth: {
    debug: true
  }
});
```

### 2. Use Monitoring Dashboard
Access the policy performance dashboard at `/admin/policy-performance` to:
- View policy evaluation times
- Check for circular dependencies
- Monitor error rates

### 3. Run Automated Validation
```bash
npm run validate:policies
```

### 4. Contact Support
When reporting issues, include:
- Error messages and stack traces
- Policy definitions involved
- Query patterns causing issues
- Database schema relevant to the problem
- Steps to reproduce the issue

## Quick Reference

### Common Policy Patterns
```sql
-- User access only
CREATE POLICY "user_access" ON table_name
FOR ALL USING (user_id = auth.uid());

-- Read-only for authenticated users
CREATE POLICY "authenticated_read" ON table_name
FOR SELECT USING (auth.role() = 'authenticated');

-- Service role bypass
CREATE POLICY "service_bypass" ON table_name
FOR ALL USING (auth.role() = 'service_role');
```

### Essential Indexes
```sql
-- User-based access
CREATE INDEX idx_table_user_id ON table_name(user_id);

-- Status filtering
CREATE INDEX idx_table_status ON table_name(status);

-- Composite for complex queries
CREATE INDEX idx_table_composite ON table_name(user_id, status, created_at);
```

### Testing Commands
```bash
# Run policy tests
npm run test:policies

# Analyze policy dependencies
node scripts/policy-analysis.js

# Validate deployment
node scripts/deployment-validator.js
```