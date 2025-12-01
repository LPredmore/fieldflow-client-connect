# Permission System Guide

## Overview
The permission system provides a comprehensive, type-safe way to manage user permissions throughout the application. It leverages our unified data layer for consistent performance and maintainability.

## Core Components

### 1. Permission Data Hooks

#### `usePermissionsData(options)`
Primary hook for managing a single user's permissions.

```tsx
import { usePermissionsData } from '@/hooks/permissions';

function UserPermissions({ userId }) {
  const { 
    data: permissions, 
    loading, 
    error, 
    create, 
    update, 
    remove 
  } = usePermissionsData({ userId });

  const handleUpdatePermissions = async () => {
    await update({ access_services: true });
  };

  return (
    <div>
      {loading && <p>Loading permissions...</p>}
      {permissions.access_services && <p>Can access services</p>}
      <button onClick={handleUpdatePermissions}>
        Grant Service Access
      </button>
    </div>
  );
}
```

#### `useAllPermissionsData(options)`
Hook for managing permissions across all users in a tenant.

```tsx
import { useAllPermissionsData } from '@/hooks/permissions';

function PermissionsManager() {
  const { 
    data: allPermissions, 
    updateByUserId, 
    getPermissionsForUser 
  } = useAllPermissionsData();

  const handleUserUpdate = async (userId: string) => {
    await updateByUserId(userId, { supervisor: true });
  };

  return (
    <div>
      {allPermissions.map(record => (
        <div key={record.id}>
          User: {record.user_id}
          <button onClick={() => handleUserUpdate(record.user_id)}>
            Make Supervisor
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 2. Permission Context

#### `PermissionProvider`
Provides centralized permission state management.

```tsx
import { PermissionProvider } from '@/contexts/PermissionContext';

function App() {
  return (
    <PermissionProvider>
      <YourComponents />
    </PermissionProvider>
  );
}
```

#### `usePermissionContext()`
Access permission context within provider.

```tsx
import { usePermissionContext } from '@/contexts/PermissionContext';

function MyComponent() {
  const { permissions, updatePermissions } = usePermissionContext();
  
  return (
    <div>
      {permissions.access_forms && <FormSection />}
    </div>
  );
}
```

### 3. Permission Guard Components

#### `PermissionGuard`
Conditional rendering based on permissions.

```tsx
import { PermissionGuard } from '@/components/Permissions';

function Dashboard() {
  return (
    <div>
      <PermissionGuard 
        permission="access_services"
        fallback={<p>No service access</p>}
      >
        <ServiceManagement />
      </PermissionGuard>
    </div>
  );
}
```

#### `PermissionButton`
Permission-aware button component.

```tsx
import { PermissionButton } from '@/components/Permissions';

function ActionBar() {
  return (
    <div>
      <PermissionButton 
        permission="access_invoicing"
        onClick={createInvoice}
        hideWhenNoPermission
      >
        Create Invoice
      </PermissionButton>
    </div>
  );
}
```

#### `PermissionSection`
Section-level permission control.

```tsx
import { PermissionSection } from '@/components/Permissions';

function AdminPanel() {
  return (
    <PermissionSection 
      permission="supervisor"
      showAccessDenied
      accessDeniedMessage="Admin access required"
    >
      <AdminControls />
    </PermissionSection>
  );
}
```

#### `PermissionRoute`
Route-level permission protection.

```tsx
import { PermissionRoute } from '@/components/Permissions';

function ProtectedPage() {
  return (
    <PermissionRoute 
      permission="access_forms"
      redirectTo="/dashboard"
    >
      <FormsManagement />
    </PermissionRoute>
  );
}
```

### 4. Permission Utility Hooks

#### `usePermissionChecks()`
Convenient permission checking with computed values.

```tsx
import { usePermissionChecks } from '@/hooks/permissions';

function Dashboard() {
  const { 
    canAccessServices,
    canAccessInvoicing,
    canAccessAnyBusinessFeature,
    isFullAdmin
  } = usePermissionChecks();

  return (
    <div>
      {canAccessAnyBusinessFeature && <BusinessSection />}
      {isFullAdmin && <AdminPanel />}
    </div>
  );
}
```

#### `usePermissionValidation()`
Runtime permission validation with user feedback.

```tsx
import { usePermissionValidation } from '@/hooks/permissions';

function ServiceActions() {
  const { validatePermission, requirePermission } = usePermissionValidation();

  const handleCreateService = () => {
    if (validatePermission('access_services', 'create services')) {
      // Proceed with service creation
      createService();
    }
    // Toast notification shown automatically if no permission
  };

  const handleCriticalAction = () => {
    try {
      requirePermission('supervisor', 'perform critical actions');
      // This will throw if no permission
      performCriticalAction();
    } catch (error) {
      console.error('Permission denied:', error);
    }
  };

  return (
    <div>
      <button onClick={handleCreateService}>Create Service</button>
      <button onClick={handleCriticalAction}>Critical Action</button>
    </div>
  );
}
```

## Permission Types

```typescript
interface UserPermissions {
  access_appointments: boolean;
  access_services: boolean;
  access_invoicing: boolean;
  access_forms: boolean;
  supervisor: boolean;
}
```

## Best Practices

### 1. Use PermissionProvider at App Level
```tsx
// App.tsx
function App() {
  return (
    <AuthProvider>
      <PermissionProvider>
        <Router>
          <Routes>
            {/* Your routes */}
          </Routes>
        </Router>
      </PermissionProvider>
    </AuthProvider>
  );
}
```

### 2. Prefer Permission Guards Over Manual Checks
```tsx
// ✅ Good
<PermissionGuard permission="access_services">
  <ServiceSection />
</PermissionGuard>

// ❌ Avoid
{permissions.access_services && <ServiceSection />}
```

### 3. Use Permission Validation for Actions
```tsx
// ✅ Good
const { validatePermission } = usePermissionValidation();

const handleAction = () => {
  if (validatePermission('access_invoicing', 'create invoices')) {
    createInvoice();
  }
};

// ❌ Avoid
const handleAction = () => {
  if (permissions.access_invoicing) {
    createInvoice();
  } else {
    toast({ title: 'No permission', variant: 'destructive' });
  }
};
```

### 4. Leverage Permission Context for Complex Components
```tsx
// ✅ Good - Single provider for entire feature
function InvoicingFeature() {
  return (
    <PermissionProvider>
      <InvoiceList />
      <InvoiceForm />
      <InvoiceActions />
    </PermissionProvider>
  );
}

// ❌ Avoid - Multiple permission queries
function InvoicingFeature() {
  return (
    <div>
      <InvoiceList /> {/* Each component queries permissions */}
      <InvoiceForm />
      <InvoiceActions />
    </div>
  );
}
```

## Migration from Legacy System

### Old Pattern
```tsx
// Old way
import { usePermissions } from '@/hooks/usePermissions';

function MyComponent() {
  const { permissions, loading } = usePermissions();
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      {permissions.access_services && <ServiceSection />}
    </div>
  );
}
```

### New Pattern
```tsx
// New way
import { PermissionProvider } from '@/contexts/PermissionContext';
import { PermissionGuard } from '@/components/Permissions';

function MyComponent() {
  return (
    <PermissionProvider>
      <PermissionGuard permission="access_services">
        <ServiceSection />
      </PermissionGuard>
    </PermissionProvider>
  );
}
```

## Performance Benefits

1. **Reduced API Calls**: Single permission query per user context
2. **Intelligent Caching**: Automatic caching through data layer
3. **Batch Operations**: Efficient multi-user permission management
4. **Optimistic Updates**: Immediate UI updates with background sync

## Type Safety

All permission operations are fully typed:

```tsx
// TypeScript will enforce valid permission names
<PermissionGuard permission="access_services" /> // ✅ Valid
<PermissionGuard permission="invalid_permission" /> // ❌ Type error

// Permission checks are type-safe
const { canAccessServices } = usePermissionChecks(); // boolean
validatePermission('supervisor', 'admin action'); // boolean
```