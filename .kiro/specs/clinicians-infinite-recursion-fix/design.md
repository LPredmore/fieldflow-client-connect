# Design Document

## Overview

The infinite recursion error in the clinicians table is caused by Row Level Security (RLS) policies that create circular references when evaluating access permissions. This typically occurs when:

1. A policy on the `clinicians` table references another table (like `profiles` or `user_permissions`)
2. That referenced table has its own RLS policy that queries back to the `clinicians` table
3. This creates an infinite loop during policy evaluation

The solution involves restructuring the RLS policies to eliminate circular dependencies while maintaining proper security controls.

## Architecture

### Current Problem Pattern
```
clinicians table RLS policy → references profiles table
profiles table RLS policy → references clinicians table
= INFINITE RECURSION
```

### Proposed Solution Pattern
```
clinicians table RLS policy → uses auth.uid() directly
profiles table RLS policy → uses auth.uid() directly
= NO CIRCULAR REFERENCES
```

## Components and Interfaces

### 1. Database Policy Analysis
- **Audit existing RLS policies** on all tables that interact with clinicians
- **Identify circular references** between tables
- **Map dependency chains** to understand the full scope of the issue

### 2. Policy Restructuring
- **Simplify clinicians table policies** to use direct user authentication
- **Remove cross-table references** in RLS policies where possible
- **Implement hierarchical policy structure** that avoids circular dependencies

### 3. Authentication-Based Security
- **Use `auth.uid()`** as the primary security mechanism
- **Implement tenant-based filtering** at the application level when needed
- **Create service-level policies** for admin operations

### 4. Query Optimization
- **Add proper indexes** to support the new policy structure
- **Optimize query patterns** to reduce policy evaluation overhead
- **Implement query result caching** to minimize database hits

## Data Models

### Policy Structure Changes

#### Before (Problematic):
```sql
-- clinicians table policy (PROBLEMATIC)
CREATE POLICY "clinicians_select_policy" ON clinicians
FOR SELECT USING (
  user_id IN (
    SELECT user_id FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
);

-- profiles table policy (CREATES CIRCULAR REFERENCE)
CREATE POLICY "profiles_select_policy" ON profiles
FOR SELECT USING (
  user_id = auth.uid() AND
  user_id IN (
    SELECT user_id FROM clinicians 
    WHERE clinicians.user_id = auth.uid()
  )
);
```

#### After (Fixed):
```sql
-- clinicians table policy (DIRECT AUTH)
CREATE POLICY "clinicians_select_policy" ON clinicians
FOR SELECT USING (user_id = auth.uid());

-- profiles table policy (DIRECT AUTH)
CREATE POLICY "profiles_select_policy" ON profiles
FOR SELECT USING (user_id = auth.uid());
```

### Database Schema Considerations

#### Required Indexes:
```sql
-- Ensure efficient policy evaluation
CREATE INDEX IF NOT EXISTS idx_clinicians_user_id ON clinicians(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
```

#### Policy Categories:
1. **User-level policies**: Direct `auth.uid()` comparison
2. **Tenant-level policies**: Application-enforced tenant filtering
3. **Admin-level policies**: Service role bypass for system operations

## Error Handling

### 1. Policy Validation
- **Pre-deployment testing** of all RLS policies
- **Automated detection** of circular references
- **Policy dependency mapping** tools

### 2. Graceful Degradation
- **Circuit breaker pattern** for database queries (already implemented)
- **Fallback to cached data** when policies fail
- **Clear error messages** for policy-related failures

### 3. Monitoring and Alerting
- **Database performance monitoring** for policy evaluation time
- **Error tracking** for infinite recursion detection
- **Query analysis** to identify problematic patterns

## Testing Strategy

### 1. Policy Testing
- **Unit tests** for individual RLS policies
- **Integration tests** for cross-table policy interactions
- **Load testing** to ensure policy performance under stress

### 2. Regression Testing
- **Automated policy validation** in CI/CD pipeline
- **Database migration testing** for policy changes
- **User permission verification** tests

### 3. Performance Testing
- **Query execution time** benchmarks
- **Policy evaluation overhead** measurement
- **Concurrent user** stress testing

## Implementation Phases

### Phase 1: Analysis and Planning
1. **Audit current RLS policies** across all tables
2. **Identify circular dependencies** and problematic patterns
3. **Create policy dependency map** to visualize relationships
4. **Design new policy structure** without circular references

### Phase 2: Policy Restructuring
1. **Create new simplified policies** using direct authentication
2. **Test policies in development environment**
3. **Validate security requirements** are still met
4. **Performance test** the new policy structure

### Phase 3: Migration and Deployment
1. **Create database migration scripts** for policy changes
2. **Deploy changes** with rollback capability
3. **Monitor system performance** post-deployment
4. **Validate user functionality** works correctly

### Phase 4: Optimization and Monitoring
1. **Add performance monitoring** for policy evaluation
2. **Implement query optimization** based on new policies
3. **Create alerting** for policy-related errors
4. **Document new policy patterns** for future development

## Security Considerations

### 1. Access Control Validation
- **Verify user isolation** is maintained with new policies
- **Test tenant separation** if applicable
- **Validate admin access** patterns work correctly

### 2. Data Protection
- **Ensure no data leakage** between users
- **Maintain audit trails** for data access
- **Protect sensitive information** (license numbers, personal data)

### 3. Authentication Integration
- **Validate JWT token handling** in policies
- **Test session management** integration
- **Ensure proper user context** in all scenarios

## Performance Optimization

### 1. Query Optimization
- **Minimize policy evaluation complexity**
- **Use efficient indexes** for policy conditions
- **Optimize join patterns** in application queries

### 2. Caching Strategy
- **Implement query result caching** (already partially implemented)
- **Cache policy evaluation results** where appropriate
- **Use connection pooling** for database efficiency

### 3. Monitoring and Metrics
- **Track query execution times**
- **Monitor policy evaluation overhead**
- **Alert on performance degradation**