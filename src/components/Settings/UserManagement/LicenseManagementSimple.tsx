import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield } from "lucide-react";

/**
 * Simplified License Management Component
 * 
 * The clinician_licenses table doesn't exist in the current schema.
 * License information is now stored directly in the staff table:
 * - prov_license_type
 * - prov_license_number
 * 
 * This component serves as a placeholder until proper license
 * management is implemented using the staff table structure.
 */
export function LicenseManagementSimple() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          License Management
        </CardTitle>
        <CardDescription>
          Manage staff licenses and credentials
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertDescription>
            License management is now handled through individual staff profiles.
            Navigate to each staff member's profile to view and edit their license information.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
