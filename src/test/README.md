# Database Schema Validation Tests

This directory contains automated tests for validating database queries against the current schema to prevent issues caused by schema changes.

## Overview

The schema validation system helps prevent database query errors by:

1. **Validating queries against known removed columns** - Catches references to columns that have been removed from the database
2. **Analyzing migration impact** - Identifies which queries would be affected by schema changes
3. **Providing automated testing** - Runs as part of the test suite to catch issues early

## Test Files

### Core Validation Tests

- **`basicSchemaValidation.test.ts`** - Basic functionality tests for the schema validator
- **`realWorldQueryValidation.test.ts`** - Tests against actual query patterns used in the application
- **`migrationValidator.test.ts`** - Tests for the migration validation utility

### Test Coverage

The tests validate:

- ✅ Detection of removed columns (`notes`, `estimated_cost`, `override_estimated_cost`)
- ✅ Parsing of complex Supabase select strings with joins
- ✅ Migration impact analysis
- ✅ Real-world query patterns from `useUnifiedAppointments`
- ✅ Edge cases and error handling

## Running the Tests

```bash
# Run all schema validation tests
npm run test:schema

# Run specific test files
npx vitest run src/test/basicSchemaValidation.test.ts
npx vitest run src/test/realWorldQueryValidation.test.ts

# Run migration validator
npm run validate:migration
```

## Key Components

### SchemaValidator Class

Located in `src/utils/schemaValidator.ts`, provides:

- `validateColumns()` - Check if columns exist in a table
- `parseSelectString()` - Parse Supabase select strings
- `validateQuery()` - Validate complete query structures
- `analyzeMigrationImpact()` - Analyze impact of schema changes

### Known Removed Columns

The system tracks columns that have been removed from the schema:

```typescript
export const KNOWN_REMOVED_COLUMNS = {
  appointment_series: ['notes', 'estimated_cost'],
  appointment_occurrences: ['override_estimated_cost'],
} as const;
```

### Migration Validator

Located in `src/utils/migrationValidator.ts`, provides:

- Codebase scanning for database queries
- Validation against known issues
- CI/CD integration support
- Detailed reporting

## Usage Examples

### Validate a Query

```typescript
import { validateAgainstKnownIssues } from '@/utils/schemaValidator';

const result = await validateAgainstKnownIssues(
  'appointment_series', 
  'id, title, notes' // This will fail because 'notes' was removed
);

if (!result.isValid) {
  console.error('Invalid columns:', result.invalidColumns);
}
```

### Parse Select String

```typescript
import { SchemaValidator } from '@/utils/schemaValidator';

const parsed = SchemaValidator.parseSelectString(`
  *,
  appointment_series!inner(
    title,
    description,
    service_id
  )
`);

console.log(parsed);
// [
//   { table: 'appointment_series', columns: ['title', 'description', 'service_id'] }
// ]
```

### Migration Impact Analysis

```typescript
import { SchemaValidator } from '@/utils/schemaValidator';

const impact = await SchemaValidator.analyzeMigrationImpact(
  'appointment_series',
  ['notes'], // Removed columns
  ['new_field'] // Added columns
);

console.log(impact.recommendations);
```

## Integration with CI/CD

The migration validator can be integrated into CI/CD pipelines:

```bash
# Validate all queries in the codebase
npm run validate:migration

# Exit code 0 = success, 1 = validation failed
```

## Current Status

✅ **Task 2.3 Complete**: Automated schema validation tests have been implemented with:

1. **Schema validation tests** - Validate queries against current schema
2. **Known issue detection** - Catch references to removed columns
3. **Migration impact analysis** - Analyze effects of schema changes
4. **Real-world validation** - Test actual query patterns from the codebase
5. **CI/CD integration** - Migration validator for automated checking

The system successfully validates that the current `useUnifiedAppointments` query no longer references the problematic `notes` column that was causing 60-second page load times.

## Requirements Satisfied

This implementation satisfies **Requirement 4.3**:
- ✅ Create tests that validate all database queries against current schema
- ✅ Add tests that fail if non-existent columns are referenced  
- ✅ Implement migration impact analysis tests

The tests ensure that future schema changes won't introduce similar query validation issues.