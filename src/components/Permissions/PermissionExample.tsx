import React from 'react';
import { PermissionProvider } from '@/contexts/PermissionContext';
import { PermissionGuard, PermissionButton, PermissionSection } from '@/components/Permissions';
import { usePermissionChecks, usePermissionValidation } from '@/hooks/permissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Example component showing different permission patterns
function PermissionExampleContent() {
  const { 
    canAccessInvoicing, 
    canAccessForms,
    canSupervise,
    loading 
  } = usePermissionChecks();
  
  const { validatePermission } = usePermissionValidation();

  const handleFormsAction = () => {
    if (validatePermission('access_forms', 'manage forms')) {
      console.log('Forms action performed');
    }
  };

  const handleInvoiceAction = () => {
    if (validatePermission('access_invoicing', 'create invoices')) {
      console.log('Invoice action performed');
    }
  };

  if (loading) {
    return <div>Loading permissions...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">Permission System Examples</h2>
      
      {/* Permission Guard Example */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Guard Example</CardTitle>
        </CardHeader>
        <CardContent>
          <PermissionGuard 
            permission="access_forms"
            fallback={<p className="text-muted-foreground">You need forms access to see this content.</p>}
          >
            <p className="text-green-600">✅ You can access forms!</p>
          </PermissionGuard>
        </CardContent>
      </Card>

      {/* Permission Button Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Button Examples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <PermissionButton 
              permission="access_forms"
              onClick={handleFormsAction}
            >
              Forms Action
            </PermissionButton>
            
            <PermissionButton 
              permission="access_invoicing"
              onClick={handleInvoiceAction}
              variant="outline"
            >
              Invoice Action
            </PermissionButton>
            
            <PermissionButton 
              permission="supervisor"
              variant="destructive"
              hideWhenNoPermission
            >
              Admin Only Action
            </PermissionButton>
          </div>
        </CardContent>
      </Card>

      {/* Permission Section Example */}
      <PermissionSection 
        permission="supervisor"
        showAccessDenied
        accessDeniedMessage="Only supervisors can access administrative functions."
      >
        <Card>
          <CardHeader>
            <CardTitle>Administrative Section</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This content is only visible to supervisors.</p>
            <Button variant="outline" className="mt-4">
              Admin Function
            </Button>
          </CardContent>
        </Card>
      </PermissionSection>

      {/* Permission Checks Example */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className={canAccessForms ? 'text-green-600' : 'text-red-600'}>
                {canAccessForms ? '✅' : '❌'}
              </span>
              <span>Forms Access</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={canAccessInvoicing ? 'text-green-600' : 'text-red-600'}>
                {canAccessInvoicing ? '✅' : '❌'}
              </span>
              <span>Invoicing Access</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={canSupervise ? 'text-green-600' : 'text-red-600'}>
                {canSupervise ? '✅' : '❌'}
              </span>
              <span>Supervisor Access</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Main component with PermissionProvider
export function PermissionExample() {
  return (
    <PermissionProvider>
      <PermissionExampleContent />
    </PermissionProvider>
  );
}
