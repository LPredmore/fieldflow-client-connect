# Phase 2: Generic Data Fetching System - Migration Guide

## Overview

This phase introduces a generic data fetching system that eliminates repetitive patterns across 15+ hooks and provides consistent error handling, loading states, and CRUD operations.

## New Generic Hooks

### 1. `useSupabaseQuery<T>` - Generic Query Hook
```tsx
const { data, loading, error, refetch } = useSupabaseQuery<Customer>({
  table: 'customers',
  select: '*, profiles(full_name)',
  filters: { tenant_id: 'auto' },
  orderBy: { column: 'created_at', ascending: false },
  transform: (data) => data.map(transformCustomer),
});
```

### 2. `useSupabaseMutation<T>` - Generic Mutation Hooks
```tsx
// Insert
const { mutate: create, loading, error } = useSupabaseInsert<CustomerData>({
  table: 'customers',
  successMessage: 'Customer created successfully',
});

// Update
const { mutate: update } = useSupabaseUpdate<Customer>({
  table: 'customers',
  successMessage: 'Customer updated successfully',
});

// Delete
const { mutate: remove } = useSupabaseDelete({
  table: 'customers',
  successMessage: 'Customer deleted successfully',
});
```

### 3. `useSupabaseTable<T>` - Complete CRUD Hook
```tsx
const {
  data, loading, error, refetch,
  create, update, remove,
  createLoading, updateLoading, deleteLoading
} = useSupabaseTable<Customer, CustomerFormData>({
  table: 'customers',
  filters: { tenant_id: 'auto' },
  orderBy: { column: 'created_at', ascending: false },
});
```

## Migration Examples

### Before (Old Pattern - 50+ lines)
```tsx
export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, tenantId } = useAuth();
  const { toast } = useToast();

  const fetchCustomers = async () => {
    if (!user || !tenantId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false });
      
      if (error) {
        toast({
          variant: "destructive",
          title: "Error loading customers",
          description: error.message,
        });
        return;
      }
      
      setCustomers(data.map(transformCustomer));
    } catch (error) {
      // Error handling...
    } finally {
      setLoading(false);
    }
  };

  const createCustomer = async (data) => {
    // 20+ lines of create logic...
  };

  const updateCustomer = async (id, data) => {
    // 20+ lines of update logic...
  };

  // ... more repetitive code
}
```

### After (New Pattern - 15 lines)
```tsx
export function useCustomersData() {
  return useSupabaseTable<Customer, CustomerFormData>({
    table: 'customers',
    select: '*, profiles(full_name)',
    filters: { tenant_id: 'auto' },
    orderBy: { column: 'created_at', ascending: false },
    transform: (data) => data.map(transformCustomer),
    insertOptions: { successMessage: 'Customer created successfully' },
    updateOptions: { successMessage: 'Customer updated successfully' },
    deleteOptions: { successMessage: 'Customer deleted successfully' },
  });
}
```

## Benefits

### Code Reduction
- **Before**: 50-80 lines per hook × 15 hooks = 750-1200 lines
- **After**: 10-20 lines per hook × 15 hooks = 150-300 lines
- **Savings**: 60-75% code reduction

### Consistency
- ✅ Standardized error handling
- ✅ Consistent loading states
- ✅ Automatic tenant filtering
- ✅ Standardized success messages
- ✅ Automatic timestamp management

### Features
- ✅ Auto-retry on network errors
- ✅ Optimistic updates
- ✅ Automatic refetch after mutations
- ✅ TypeScript support with generics
- ✅ Customizable transforms
- ✅ Flexible filtering

## Migration Strategy

### Phase 2A: Create New Data Hooks (Week 1)
1. ✅ Create generic hook system
2. ✅ Create example modernized hooks
3. 🔄 Migrate 3-4 critical hooks as proof of concept
4. 🔄 Test thoroughly

### Phase 2B: Gradual Migration (Week 2)
1. 🔄 Migrate remaining hooks one by one
2. 🔄 Update components to use new hooks
3. 🔄 Remove old hooks after migration
4. 🔄 Update tests

### Phase 2C: Optimization (Week 3)
1. 🔄 Add caching layer if needed
2. 🔄 Add optimistic updates
3. 🔄 Performance optimization
4. 🔄 Documentation

## Hook Migration Checklist

For each hook to migrate:

### 1. Identify Pattern
- [ ] Simple query only → `useSupabaseQuery`
- [ ] Query + mutations → `useSupabaseTable`
- [ ] Custom logic → Custom hook using generic hooks

### 2. Extract Configuration
- [ ] Table name
- [ ] Select fields
- [ ] Filters (especially tenant_id)
- [ ] Ordering
- [ ] Transform functions

### 3. Create New Hook
- [ ] Use appropriate generic hook
- [ ] Configure options
- [ ] Add TypeScript types
- [ ] Test functionality

### 4. Update Components
- [ ] Replace old hook import
- [ ] Update destructured properties
- [ ] Test component functionality
- [ ] Update tests if needed

### 5. Clean Up
- [ ] Remove old hook file
- [ ] Update exports
- [ ] Remove unused imports

## Example Migrations

### Simple Query Hook
```tsx
// Before: useServices.tsx (60 lines)
// After: useServicesData.tsx (15 lines)
export function useServicesData() {
  return useSupabaseTable<Service, ServiceFormData>({
    table: 'services',
    filters: { tenant_id: 'auto' },
    orderBy: { column: 'created_at', ascending: false },
  });
}
```

### Complex Hook with Custom Logic
```tsx
// Before: useProfiles.tsx (80 lines)
// After: useProfilesData.tsx (40 lines) - still 50% reduction
export function useProfilesData() {
  const query = useSupabaseQuery<Profile>({
    table: 'profiles',
    // Custom OR filter logic
  });
  
  const update = useSupabaseUpdate<Profile>({
    table: 'profiles',
    onSuccess: () => query.refetch(),
  });
  
  return { ...query, update: update.mutate };
}
```

## Next Steps

1. **Test the new system** with existing components
2. **Migrate critical hooks first** (customers, services, profiles)
3. **Gradually replace remaining hooks**
4. **Add optimizations** as needed

The generic system provides a solid foundation that will make future data fetching much more consistent and maintainable.