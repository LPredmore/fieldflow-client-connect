# Schema Change Runbook

This runbook provides a comprehensive process for managing database schema changes to prevent query failures and performance issues like those experienced with the `appointment_series.notes` column removal.

## Overview

Schema changes are high-risk operations that can break application functionality if not properly coordinated with code changes. This runbook ensures safe schema evolution while maintaining application stability.

## Pre-Change Planning

### 1. Impact Analysis Checklist

Before making any schema changes, complete this analysis:

- [ ] **Identify Affected Tables and Columns**
  - List all tables being modified
  - Document columns being added, modified, or removed
  - Note any constraint changes (foreign keys, indexes, etc.)

- [ ] **Code Impact Assessment**
  - Search codebase for references to affected columns
  - Identify all queries that use the affected tables
  - Document all components that depend on the data

- [ ] **Dependency Mapping**
  - Map relationships between affected tables
  - Identify cascade effects of changes
  - Document any external system dependencies

### 2. Codebase Audit Process

Use these tools and techniques to find all references:

#### Automated Search Commands
```bash
# Search for column references
grep -r "column_name" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"

# Search for table references
grep -r "table_name" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"

# Search in SQL files and migrations
find . -name "*.sql" -exec grep -l "column_name" {} \;

# Search in configuration files
grep -r "column_name" . --include="*.json" --include="*.yaml" --include="*.yml"
```

#### Comprehensive Audit Script
```bash
#!/bin/bash
# schema-audit.sh - Comprehensive schema reference audit

COLUMN_NAME=$1
TABLE_NAME=$2

if [ -z "$COLUMN_NAME" ] || [ -z "$TABLE_NAME" ]; then
    echo "Usage: $0 <column_name> <table_name>"
    exit 1
fi

echo "=== Schema Change Impact Audit ==="
echo "Column: $COLUMN_NAME"
echo "Table: $TABLE_NAME"
echo "Date: $(date)"
echo

echo "=== TypeScript/JavaScript Files ==="
grep -rn "$COLUMN_NAME" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | head -20

echo
echo "=== SQL Files and Migrations ==="
find . -name "*.sql" -exec grep -Hn "$COLUMN_NAME" {} \;

echo
echo "=== Configuration Files ==="
grep -rn "$COLUMN_NAME" . --include="*.json" --include="*.yaml" --include="*.yml"

echo
echo "=== Test Files ==="
grep -rn "$COLUMN_NAME" . --include="*test*" --include="*spec*"

echo
echo "=== Documentation ==="
grep -rn "$COLUMN_NAME" . --include="*.md" --include="*.txt"

echo
echo "=== Table References ==="
grep -rn "$TABLE_NAME" src/ --include="*.ts" --include="*.tsx" | head -10
```

#### Database Query Analysis
```sql
-- Find all queries that reference the column
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    typname as data_type
FROM pg_attribute 
JOIN pg_type ON pg_attribute.atttypid = pg_type.oid
JOIN pg_class ON pg_attribute.attrelid = pg_class.oid
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE attname = 'column_name' 
AND schemaname = 'public'
AND attnum > 0;

-- Check for foreign key dependencies
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND (tc.table_name = 'your_table' OR ccu.table_name = 'your_table');
```

### 3. Change Classification

Classify your schema change to determine the appropriate strategy:

#### Low Risk Changes
- Adding new nullable columns
- Adding new tables
- Adding non-unique indexes
- Increasing column size limits

#### Medium Risk Changes
- Adding new non-nullable columns with defaults
- Renaming columns (with proper migration)
- Adding unique constraints
- Modifying column types (compatible changes)

#### High Risk Changes
- Removing columns
- Removing tables
- Changing column types (incompatible changes)
- Adding non-nullable columns without defaults
- Removing constraints

## Schema Change Strategies

### Strategy 1: Additive Changes (Low Risk)

For adding new columns or tables:

```sql
-- Example: Adding a new column
ALTER TABLE appointment_series 
ADD COLUMN new_column VARCHAR(255) NULL;

-- Add index if needed
CREATE INDEX idx_appointment_series_new_column 
ON appointment_series(new_column);
```

**Process**:
1. Apply schema change
2. Deploy code that uses new column
3. Backfill data if needed
4. Add constraints if required

### Strategy 2: Column Renaming (Medium Risk)

For renaming columns while maintaining compatibility:

```sql
-- Step 1: Add new column
ALTER TABLE appointment_series 
ADD COLUMN new_column_name VARCHAR(255);

-- Step 2: Copy data
UPDATE appointment_series 
SET new_column_name = old_column_name;

-- Step 3: (After code deployment) Remove old column
ALTER TABLE appointment_series 
DROP COLUMN old_column_name;
```

**Process**:
1. Add new column with desired name
2. Copy data from old to new column
3. Deploy code that uses both columns (transition period)
4. Deploy code that only uses new column
5. Remove old column

### Strategy 3: Column Removal (High Risk)

For removing columns safely:

```sql
-- Step 1: Make column nullable (if not already)
ALTER TABLE appointment_series 
ALTER COLUMN notes DROP NOT NULL;

-- Step 2: (After code deployment) Remove column
ALTER TABLE appointment_series 
DROP COLUMN notes;
```

**Process**:
1. **Code First**: Deploy code that doesn't use the column
2. **Validate**: Ensure no queries reference the column
3. **Schema Second**: Remove the column from database
4. **Cleanup**: Remove any related indexes or constraints

## Implementation Process

### Phase 1: Pre-Change Validation

#### 1. Run Schema Audit
```bash
# Run comprehensive audit
./scripts/schema-audit.sh column_name table_name > audit-report.txt

# Review audit report
cat audit-report.txt
```

#### 2. Create Migration Plan
Document the exact steps:

```markdown
## Migration Plan: Remove appointment_series.notes

### Current State
- Column exists in database
- Referenced in useUnifiedAppointments hook
- No other code references found

### Target State  
- Column removed from database
- All code references removed
- No functionality impact

### Steps
1. Remove code references to notes column
2. Deploy code changes
3. Validate no errors in production
4. Remove column from database schema
5. Update documentation
```

#### 3. Prepare Rollback Plan
```sql
-- Rollback script for column removal
ALTER TABLE appointment_series 
ADD COLUMN notes TEXT NULL;

-- Restore any indexes
CREATE INDEX idx_appointment_series_notes 
ON appointment_series(notes);
```

### Phase 2: Code Changes

#### 1. Update Application Code
Remove or update all references found in audit:

```typescript
// Before: References non-existent column
const query = supabase
  .from('appointment_series')
  .select('id, title, notes'); // ❌ Remove this

// After: Only reference existing columns  
const query = supabase
  .from('appointment_series')
  .select('id, title, description'); // ✅ Use existing column
```

#### 2. Update Type Definitions
```typescript
// Before
interface AppointmentSeries {
  id: string;
  title: string;
  notes?: string; // ❌ Remove this
  description?: string;
}

// After
interface AppointmentSeries {
  id: string;
  title: string;
  description?: string; // ✅ Keep existing fields
}
```

#### 3. Add Schema Validation Tests
```typescript
// Add test to prevent future schema mismatches
describe('Schema Validation', () => {
  it('should only reference existing columns', async () => {
    const { data, error } = await supabase
      .from('appointment_series')
      .select('id, title, description') // Only existing columns
      .limit(1);
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
  
  it('should fail when referencing non-existent columns', async () => {
    const { error } = await supabase
      .from('appointment_series')
      .select('id, title, notes') // Non-existent column
      .limit(1);
    
    expect(error).toBeDefined();
    expect(error.message).toContain('column "notes" does not exist');
  });
});
```

### Phase 3: Deployment and Validation

#### 1. Deploy Code Changes
```bash
# Deploy with monitoring
npm run build
npm run test
npm run deploy:staging

# Validate staging
npm run test:integration

# Deploy to production
npm run deploy:production
```

#### 2. Monitor for Issues
```bash
# Monitor error logs
tail -f /var/log/app/error.log | grep -i "column\|schema"

# Check application metrics
curl https://your-app.com/health

# Validate key functionality
npm run test:smoke
```

#### 3. Apply Schema Changes
Only after code is successfully deployed and validated:

```sql
-- Apply schema change
ALTER TABLE appointment_series DROP COLUMN notes;

-- Verify change
\d appointment_series
```

### Phase 4: Post-Change Validation

#### 1. Run Validation Tests
```bash
# Run full test suite
npm test

# Run integration tests
npm run test:integration

# Run performance tests
npm run test:performance
```

#### 2. Monitor Performance
```sql
-- Check query performance
SELECT 
    query,
    mean_time,
    calls
FROM pg_stat_statements 
WHERE query LIKE '%appointment_series%'
ORDER BY mean_time DESC;
```

#### 3. Validate User Experience
- Test all affected pages load correctly
- Verify no missing data or broken functionality
- Check error rates in monitoring dashboard

## Automated Validation Tools

### Schema Validation Script
```javascript
// scripts/validate-schema.js
const { supabase } = require('./supabase-client');

async function validateSchema() {
  const validationResults = [];
  
  // Test queries that should work
  const validQueries = [
    {
      table: 'appointment_series',
      select: 'id, title, description',
      description: 'Basic appointment series query'
    },
    {
      table: 'appointment_occurrences', 
      select: 'id, series_id, start_at, end_at',
      description: 'Basic appointment occurrences query'
    }
  ];
  
  for (const query of validQueries) {
    try {
      const { data, error } = await supabase
        .from(query.table)
        .select(query.select)
        .limit(1);
        
      if (error) {
        validationResults.push({
          query: query.description,
          status: 'FAIL',
          error: error.message
        });
      } else {
        validationResults.push({
          query: query.description,
          status: 'PASS'
        });
      }
    } catch (err) {
      validationResults.push({
        query: query.description,
        status: 'ERROR',
        error: err.message
      });
    }
  }
  
  // Test queries that should fail (removed columns)
  const invalidQueries = [
    {
      table: 'appointment_series',
      select: 'id, title, notes',
      description: 'Query with removed notes column'
    }
  ];
  
  for (const query of invalidQueries) {
    try {
      const { error } = await supabase
        .from(query.table)
        .select(query.select)
        .limit(1);
        
      if (error && error.message.includes('does not exist')) {
        validationResults.push({
          query: query.description,
          status: 'PASS (Expected failure)',
          error: error.message
        });
      } else {
        validationResults.push({
          query: query.description,
          status: 'FAIL (Should have failed)',
          error: 'Query succeeded when it should have failed'
        });
      }
    } catch (err) {
      validationResults.push({
        query: query.description,
        status: 'PASS (Expected error)',
        error: err.message
      });
    }
  }
  
  return validationResults;
}

// Run validation
validateSchema().then(results => {
  console.log('Schema Validation Results:');
  results.forEach(result => {
    console.log(`${result.status}: ${result.query}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  });
  
  const failures = results.filter(r => r.status.includes('FAIL'));
  if (failures.length > 0) {
    console.error(`\n${failures.length} validation failures found!`);
    process.exit(1);
  } else {
    console.log('\n✅ All validations passed!');
  }
});
```

### Pre-Commit Hook
```bash
#!/bin/sh
# .git/hooks/pre-commit
# Validate schema references before commit

echo "Running schema validation..."

# Run schema validation script
node scripts/validate-schema.js

if [ $? -ne 0 ]; then
    echo "❌ Schema validation failed. Commit aborted."
    exit 1
fi

echo "✅ Schema validation passed."
```

## Emergency Procedures

### Immediate Rollback (Production Issues)

If schema changes cause production issues:

#### 1. Immediate Code Rollback
```bash
# Revert to previous working version
git revert HEAD
npm run build
npm run deploy:production --force
```

#### 2. Schema Rollback (if needed)
```sql
-- Restore removed column
ALTER TABLE appointment_series 
ADD COLUMN notes TEXT NULL;

-- Restore any removed indexes
CREATE INDEX idx_appointment_series_notes 
ON appointment_series(notes);

-- Restore any removed constraints
ALTER TABLE appointment_series 
ADD CONSTRAINT check_notes_length 
CHECK (length(notes) <= 1000);
```

#### 3. Data Recovery (if needed)
```sql
-- Restore data from backup
INSERT INTO appointment_series (id, notes)
SELECT id, notes 
FROM appointment_series_backup 
WHERE notes IS NOT NULL;
```

### Communication During Emergencies

#### Internal Communication
1. Immediately notify team in #incidents channel
2. Update status page if user-facing impact
3. Escalate to on-call engineer if needed

#### External Communication  
1. Update status page within 15 minutes
2. Notify affected customers within 30 minutes
3. Provide regular updates every 30 minutes

## Best Practices Summary

### Do's ✅
- Always audit code before schema changes
- Deploy code changes before schema changes for removals
- Use gradual migration strategies for high-risk changes
- Test schema changes in staging environment
- Monitor performance and errors after changes
- Document all changes and rollback procedures
- Use automated validation tools

### Don'ts ❌
- Never remove columns without removing code references first
- Don't skip the audit phase
- Don't make multiple schema changes simultaneously
- Don't deploy schema changes during peak hours
- Don't assume changes are safe without testing
- Don't forget to update documentation and tests

### Change Approval Process

#### Low Risk Changes
- Developer review
- Automated testing
- Staging validation

#### Medium Risk Changes  
- Senior developer review
- Manual testing in staging
- Performance impact assessment
- Rollback plan documentation

#### High Risk Changes
- Architecture team review
- Comprehensive testing plan
- Staged rollout strategy
- 24/7 monitoring plan
- Detailed rollback procedures
- Business stakeholder approval

## Monitoring and Alerting

### Key Metrics to Monitor
- Query success/failure rates
- Page load times
- Error rates by type
- Database connection health
- Circuit breaker state

### Alert Thresholds
```yaml
alerts:
  schema_error:
    condition: error_message contains "column does not exist"
    severity: critical
    notification: immediate
    
  query_failure_rate:
    condition: failure_rate > 2%
    duration: 5m
    severity: warning
    
  page_load_degradation:
    condition: avg_load_time > baseline * 1.5
    duration: 10m
    severity: warning
```

This runbook provides a comprehensive framework for managing schema changes safely and preventing the types of issues that caused the original performance problems.