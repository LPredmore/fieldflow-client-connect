/**
 * Routing Debug Panel Component
 * 
 * Development-only component to display routing state and decisions.
 * Helps with debugging routing issues.
 * 
 * Requirements: 7.5, 7.6
 */

import { useAuth } from '@/contexts/AuthenticationContext';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Shield } from 'lucide-react';

/**
 * RoutingDebugPanel Component
 * 
 * Shows current routing state for debugging purposes.
 * Only renders in development mode.
 */
export function RoutingDebugPanel() {
  const { user, isLoading, error } = useAuth();
  const location = useLocation();

  // Only render in development
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-md">
      <Card className="shadow-lg border-2 border-primary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Routing Debug Panel
          </CardTitle>
          <CardDescription className="text-xs">Development Only</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Current Path:</span>
            <Badge variant="outline">{location.pathname}</Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-semibold">Auth Status:</span>
            <Badge variant={isLoading ? 'secondary' : user ? 'default' : 'destructive'}>
              {isLoading ? 'Loading' : user ? 'Authenticated' : 'Not Authenticated'}
            </Badge>
          </div>

          {user && (
            <>
              <div className="flex items-center justify-between">
                <span className="font-semibold">User Role:</span>
                <Badge variant="outline">{user.role}</Badge>
              </div>

              {/* Role Context - Derived from user_roles table */}
              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-primary">Role Context</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">
                          All roles are now sourced from the user_roles table via UnifiedRoleDetectionService.detectUserRole()
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {user.role === 'staff' && user.staffAttributes && (
                  <>
                    <div className="flex items-center justify-between pl-3 border-l-2 border-primary">
                      <span className="text-muted-foreground">isAdmin:</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={user.staffAttributes.is_admin ? 'destructive' : 'secondary'}>
                          {user.staffAttributes.is_admin ? 'Yes' : 'No'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">(user_roles)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pl-3 border-l-2 border-primary">
                      <span className="text-muted-foreground">isClinician:</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={user.staffAttributes.is_clinician ? 'default' : 'secondary'}>
                          {user.staffAttributes.is_clinician ? 'Yes' : 'No'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">(user_roles)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pl-3 border-l-2 border-primary">
                      <span className="text-muted-foreground">isStaff:</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Yes</Badge>
                        <span className="text-xs text-muted-foreground">(user_roles)</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Expected Route */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Expected Route:</span>
                  <Badge variant="outline">
                    {user.role === 'client'
                      ? '/client/dashboard'
                      : user.staffAttributes?.prov_status === 'New'
                      ? '/staff/registration'
                      : '/staff/dashboard'}
                  </Badge>
                </div>
              </div>

              {/* Routing Logic Source */}
              <div className="border-t pt-3 bg-primary/5 -mx-4 -mb-4 p-3 rounded-b">
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="font-semibold text-foreground mb-1">Authorization Source:</div>
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    <span>UnifiedRoleDetectionService</span>
                  </div>
                  <div className="flex items-center gap-1 pl-4">
                    → detectUserRole(userId)
                  </div>
                  <div className="flex items-center gap-1 pl-4">
                    → user_roles table
                  </div>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="pt-2 border-t">
              <span className="font-semibold text-destructive">Error:</span>
              <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
