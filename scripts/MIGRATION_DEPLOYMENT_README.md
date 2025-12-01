# Migration Deployment Scripts

This directory contains scripts for safely deploying database migrations with validation and rollback capabilities, specifically designed for the clinicians infinite recursion fix.

## Scripts Overview

### 1. `migration-executor.js`
Safely executes database migrations with rollback capability and validation checks.

**Features:**
- Pre-migration validation
- Step-by-step migration execution with error handling
- Automatic rollback on failure
- Policy backup creation
- Post-migration validation
- Comprehensive reporting

### 2. `deployment-validator.js`
Validates that migrations were successful and the system is working correctly.

**Features:**
- Database connectivity testing
- Policy existence verification
- Circular dependency detection
- Performance benchmarking
- Staff registration workflow testing
- Helper function validation

### 3. `deploy-migration.js`
Combined workflow script that executes migration and validation together.

**Features:**
- Complete deployment workflow
- Command-line options for different scenarios
- Comprehensive reporting
- Error handling and rollback

## Usage

### Quick Start - Deploy the Clinicians Fix

```bash
# Run the complete deployment workflow
node scripts/deploy-migration.js

# This will:
# 1. Run pre-migration validation
# 2. Execute the clinicians infinite recursion fix migration
# 3. Run post-migration validation
# 4. Generate reports
```

### Advanced Usage

```bash
# Deploy a specific migration file
node scripts/deploy-migration.js my-custom-migration.sql

# Only run validation (no migration)
node scripts/deploy-migration.js --validate-only

# Deploy without post-migration validation (not recommended)
node scripts/deploy-migration.js --skip-validation

# Show help
node scripts/deploy-migration.js --help
```

### Individual Script Usage

```bash
# Run only the migration executor
node scripts/migration-executor.js [migration-file]

# Run only the deployment validator
node scripts/deployment-validator.js

# Run policy analysis
node scripts/policy-analysis.js
```

## Prerequisites

### Environment Variables
Ensure these environment variables are set in your `.env` file:

```env
VITE_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Dependencies
The scripts require the following npm packages:
- `@supabase/supabase-js`
- Node.js ES modules support

### Permissions
The service role key must have permissions to:
- Read and modify database policies
- Execute SQL statements
- Create and drop database objects
- Query system tables

## Migration Process

### 1. Pre-Migration Validation
- ✅ Database connectivity check
- ✅ Required tables existence verification
- ✅ Current policy analysis
- ✅ Policy backup creation

### 2. Migration Execution
- ✅ SQL statement parsing and execution
- ✅ Error handling with rollback capability
- ✅ Step-by-step progress tracking
- ✅ Rollback step generation

### 3. Post-Migration Validation
- ✅ Policy existence verification
- ✅ Circular dependency detection
- ✅ Performance testing
- ✅ Functional testing
- ✅ Staff registration workflow validation

## Reports Generated

### Migration Report
- `migration-report-[timestamp].json`
- Contains execution details, validation results, and rollback information

### Validation Report
- `deployment-validation-report-[timestamp].json`
- Contains test results, performance metrics, and recommendations

### Policy Analysis Report
- `policy-analysis-report.json`
- Contains policy dependency analysis and circular reference detection

### Backup Files
- `backups/policy-backup-[timestamp].sql`
- Contains SQL to restore previous policies if rollback is needed

## Troubleshooting

### Common Issues

#### 1. Environment Variables Missing
```
Error: Missing required environment variables: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```
**Solution:** Ensure your `.env` file contains the required Supabase credentials.

#### 2. Permission Denied
```
Error: permission denied for relation [table_name]
```
**Solution:** Verify that the service role key has the necessary permissions.

#### 3. Migration Already Applied
```
Error: policy "[policy_name]" already exists
```
**Solution:** The migration may have been partially applied. Check the database state and consider manual cleanup.

#### 4. Circular Dependencies Still Exist
```
Warning: Found X circular reference(s) after migration
```
**Solution:** Review the validation report to identify remaining circular dependencies and update policies accordingly.

### Manual Rollback

If automatic rollback fails, you can manually restore policies:

```bash
# 1. Find the backup file
ls backups/policy-backup-*.sql

# 2. Apply the backup (replace with actual filename)
psql -h your-db-host -U postgres -d your-database -f backups/policy-backup-[timestamp].sql
```

### Validation Failures

If validation fails after migration:

1. **Review the validation report** for specific test failures
2. **Check the policy analysis** for remaining circular dependencies
3. **Run individual tests** to isolate issues:
   ```bash
   node scripts/deployment-validator.js --validate-only
   ```
4. **Check database logs** for any policy-related errors

## Best Practices

### Before Running Migration
1. **Backup your database** (full backup, not just policies)
2. **Test in a staging environment** first
3. **Review the migration SQL** to understand what changes will be made
4. **Ensure maintenance window** if running in production

### During Migration
1. **Monitor the output** for any warnings or errors
2. **Don't interrupt the process** - let rollback complete if needed
3. **Keep the terminal session active** to see real-time progress

### After Migration
1. **Review all generated reports** thoroughly
2. **Test the staff registration workflow** manually
3. **Monitor application logs** for any policy-related errors
4. **Keep backup files** until you're confident the migration is stable

## Security Considerations

- **Service role key** has elevated privileges - keep it secure
- **Backup files** may contain sensitive policy information
- **Reports** are saved locally and may contain database structure information
- **Test users** created during validation are cleaned up automatically

## Support

If you encounter issues:

1. Check the generated reports for detailed error information
2. Review the troubleshooting section above
3. Examine the database logs for additional context
4. Consider running validation-only mode to diagnose issues without making changes

## Files Created

The scripts will create the following files in your project:

```
├── migration-report-[timestamp].json
├── deployment-validation-report-[timestamp].json
├── policy-analysis-report.json
└── backups/
    └── policy-backup-[timestamp].sql
```

These files contain important information about the migration process and should be reviewed after deployment.