# Design Document

## Overview

This design addresses the critical environment variable configuration mismatch that prevents the application from starting. The solution involves standardizing environment variable names across all files, adding proper validation, and ensuring consistent configuration between development, testing, and production environments.

The fix is straightforward but requires careful coordination across multiple files to ensure no references are missed and proper fallback mechanisms are in place.

## Architecture

### Environment Variable Standardization

**Standard Naming Convention:**
- `VITE_SUPABASE_URL` - Supabase project URL (already correct)
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Public/anonymous key for client-side operations (already defined in .env)
- `VITE_SUPABASE_SERVICE_ROLE_KEY` - Admin key for server-side operations (needs to be added to .env)

**File Categories:**
1. **Application Files** - Use VITE_ prefixed variables (Vite build-time injection)
2. **Test Files** - Use process.env for Node.js runtime access
3. **Script Files** - Use process.env for Node.js runtime access

### Client Initialization Strategy

**Current Problem:**
- Module-level initialization in `monitoredSupabaseClient.ts` fails immediately on import
- No validation of environment variables before client creation

**Solution:**
- Add environment variable validation before client creation
- Provide clear error messages for missing variables
- Maintain module-level export for backward compatibility

## Components and Interfaces

### 1. Environment Variable Validation

```typescript
interface EnvironmentConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseServiceRoleKey?: string;
}

function validateEnvironment(): EnvironmentConfig {
  const config = {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    supabaseServiceRoleKey: import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  };
  
  // Validation logic with clear error messages
}
```

### 2. Updated Client Configurations

**MonitoredSupabaseClient:**
- Replace `VITE_SUPABASE_ANON_KEY` with `VITE_SUPABASE_PUBLISHABLE_KEY`
- Add environment validation before client creation
- Maintain existing API for backward compatibility

**AutomatedPolicyValidator:**
- Update fallback chain to use correct variable names
- Prioritize service role key for admin operations
- Fall back to publishable key if service role key unavailable

### 3. Test Environment Updates

**Test Configuration:**
- Update all test files to use consistent variable names
- Update test documentation with correct environment variables
- Ensure test mocks use the same naming convention

## Data Models

### Environment Configuration

```typescript
// Current (incorrect) references
VITE_SUPABASE_ANON_KEY // ❌ Undefined

// Corrected references
VITE_SUPABASE_PUBLISHABLE_KEY // ✅ Defined in .env
```

### File Update Mapping

| File | Current Reference | Corrected Reference |
|------|------------------|-------------------|
| `monitoredSupabaseClient.ts` | `VITE_SUPABASE_ANON_KEY` | `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `automatedPolicyValidator.ts` | `VITE_SUPABASE_ANON_KEY` | `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Test files | `VITE_SUPABASE_ANON_KEY` | `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Documentation | `VITE_SUPABASE_ANON_KEY` | `VITE_SUPABASE_PUBLISHABLE_KEY` |

## Error Handling

### Environment Variable Validation

**Missing URL or Key:**
```typescript
if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is required but not defined in environment variables');
}

if (!supabasePublishableKey) {
  throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is required but not defined in environment variables');
}
```

**Clear Error Messages:**
- Specify exact environment variable names that are missing
- Provide guidance on where to find or set these variables
- Differentiate between development and production configuration issues

### Graceful Degradation

**Policy Validator:**
- If service role key is missing, log warning but continue with publishable key
- Disable admin-only features when service role key unavailable
- Provide clear feedback about limited functionality

**Monitored Client:**
- Fail fast with clear error message if publishable key missing
- No graceful degradation for core client functionality (it's required)

## Testing Strategy

### Environment Variable Testing

1. **Positive Tests:**
   - Verify clients initialize successfully with correct environment variables
   - Test that all file references resolve to defined variables

2. **Negative Tests:**
   - Test behavior when environment variables are missing
   - Verify error messages are clear and actionable

3. **Integration Tests:**
   - Test application startup with corrected environment variables
   - Verify no module import errors occur

### Test Environment Setup

1. **Update Test Configuration:**
   - Ensure test environment variables match production naming
   - Update test documentation with correct variable names

2. **Mock Validation:**
   - Test files should mock environment variables consistently
   - Verify test mocks don't mask real configuration issues

### Validation Checklist

- [ ] Application starts without Supabase client errors
- [ ] All environment variable references use consistent naming
- [ ] Test suite runs without configuration errors
- [ ] Error messages clearly indicate missing variables
- [ ] Documentation reflects correct environment variable names

## Implementation Priority

1. **Critical (App-Breaking):** Fix `monitoredSupabaseClient.ts` and `automatedPolicyValidator.ts`
2. **High:** Update test files and documentation
3. **Medium:** Add service role key to .env for deployment scripts
4. **Low:** Enhance error messages and validation

This design ensures the application will start successfully while maintaining consistency across all environment configurations.