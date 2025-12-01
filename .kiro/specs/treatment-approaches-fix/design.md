# Design Document

## Overview

The treatment approaches auto-population issue stems from a timing problem in the `useTreatmentApproaches` hook. The current implementation uses `enabled: !!specialty` which prevents the query from running when specialty is initially empty, and doesn't properly handle the case where specialty becomes available after form initialization.

The solution involves modifying the hook to always fetch treatment approaches data immediately, then filter client-side based on the specialty parameter. This approach eliminates the timing dependency and provides better performance through caching.

## Architecture

### Current Architecture Issues

1. **Conditional Query Execution**: The `enabled: !!specialty` flag creates a dependency that prevents data loading when specialty is initially empty
2. **No Reactive Re-fetching**: When specialty changes from empty to a value, the hook doesn't automatically re-trigger the query
3. **Timing Dependency**: The hook depends on the form being reset with clinician data before it can function
4. **Poor User Experience**: Users see "No treatment approaches available" instead of a loading state

### Proposed Architecture

1. **Immediate Data Fetching**: Always fetch all treatment approaches on hook initialization
2. **Client-Side Filtering**: Filter the cached data based on specialty parameter changes
3. **Reactive Updates**: Automatically update filtered results when specialty changes
4. **Improved Loading States**: Show appropriate loading/empty states based on data availability

## Components and Interfaces

### Modified useTreatmentApproaches Hook

```typescript
interface UseTreatmentApproachesOptions {
  specialty?: string | null;
}

interface UseTreatmentApproachesResult {
  approaches: string[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  allApproaches: TreatmentApproach[]; // New: access to all data for debugging
}
```

**Key Changes:**
- Remove `enabled: !!specialty` dependency
- Always fetch all treatment approaches data
- Filter client-side based on specialty parameter
- Add logging for debugging
- Provide access to all approaches for troubleshooting

### Enhanced Error Handling

```typescript
interface TreatmentApproachError {
  type: 'NETWORK_ERROR' | 'NO_DATA' | 'FILTER_ERROR';
  message: string;
  specialty?: string;
  timestamp: Date;
}
```

### Logging Interface

```typescript
interface TreatmentApproachLog {
  specialty: string | null;
  allApproachesCount: number;
  filteredApproachesCount: number;
  timestamp: Date;
  cacheHit: boolean;
}
```

## Data Models

### TreatmentApproach (Existing)

```typescript
interface TreatmentApproach {
  id: number;
  approaches: string | null;
  specialty: string | null;
  created_at: string;
}
```

### Enhanced Hook State

```typescript
interface HookState {
  allData: TreatmentApproach[];
  filteredApproaches: string[];
  loading: boolean;
  error: string | null;
  lastSpecialty: string | null;
  cacheTimestamp: Date | null;
}
```

## Error Handling

### Error Types and Responses

1. **Network/Database Errors**
   - Display: "Unable to load treatment approaches. Please try again."
   - Action: Provide retry button
   - Logging: Log full error details with context

2. **No Data Available**
   - Display: "No treatment approaches found for your specialty."
   - Action: Show contact support option
   - Logging: Log specialty and available data

3. **Filtering Errors**
   - Display: "Error filtering treatment approaches."
   - Action: Fall back to showing all approaches
   - Logging: Log filtering parameters and error

### Loading States

1. **Initial Load**: "Loading treatment approaches..."
2. **Filtering**: Show cached data immediately, no additional loading state
3. **Error State**: Clear error message with retry option
4. **Empty State**: "No treatment approaches available for [specialty]"

## Testing Strategy

### Unit Tests

1. **Hook Behavior Tests**
   - Test immediate data fetching on initialization
   - Test client-side filtering with different specialty values
   - Test error handling for network failures
   - Test caching behavior across multiple hook instances

2. **Integration Tests**
   - Test hook integration with StaffRegistrationForm
   - Test form initialization timing with hook data loading
   - Test specialty changes triggering correct filtering

3. **Edge Case Tests**
   - Test with null/undefined specialty values
   - Test with empty treatment approaches data
   - Test with malformed database responses
   - Test rapid specialty changes

### Performance Tests

1. **Caching Efficiency**
   - Verify single database query for multiple hook instances
   - Test client-side filtering performance with large datasets
   - Measure memory usage of cached data

2. **User Experience Tests**
   - Measure time to display treatment approaches
   - Test loading state transitions
   - Verify no "No treatment approaches available" flash

## Implementation Details

### Phase 1: Hook Modification

1. Remove `enabled: !!specialty` from useSupabaseQuery call
2. Always fetch all treatment approaches data
3. Implement client-side filtering in useMemo
4. Add comprehensive logging

### Phase 2: Enhanced Error Handling

1. Add specific error types for different failure scenarios
2. Implement retry functionality
3. Add fallback behaviors for edge cases

### Phase 3: Performance Optimization

1. Implement proper caching strategy
2. Add performance monitoring
3. Optimize filtering algorithm if needed

### Phase 4: Testing and Validation

1. Add comprehensive unit tests
2. Test integration with form component
3. Validate performance improvements
4. Test error scenarios

## Database Considerations

### Current Schema
- Table: `treatment_approaches`
- Columns: `id`, `approaches`, `specialty`, `created_at`
- Data: Specialty "Mental Health" has approaches "CBT", "CPT", etc.

### Query Optimization
- Single query to fetch all treatment approaches
- Client-side filtering eliminates need for specialty-specific queries
- Reduced database load through caching

## Monitoring and Observability

### Logging Points

1. Hook initialization with parameters
2. Data fetch success/failure
3. Filtering operations with results
4. Error conditions with context
5. Performance metrics

### Debug Information

1. Current specialty value
2. Total approaches available
3. Filtered approaches count
4. Cache status and age
5. Error history

This design addresses all the requirements while providing a robust, performant, and maintainable solution to the treatment approaches auto-population issue.