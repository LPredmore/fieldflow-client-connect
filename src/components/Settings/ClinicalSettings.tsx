import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { useLicenseTypes } from "@/hooks/useLicenseTypes";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ClinicalSettings() {
  const { licenseTypes, loading } = useLicenseTypes();

  if (loading && licenseTypes === null) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clinical Settings</CardTitle>
        <CardDescription>
          Reference data for license types and specialties used in your EHR system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription>
            License types are system-wide reference data. These values are used when registering new staff members.
          </AlertDescription>
        </Alert>

        {/* License Types Reference Table */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Available License Types</h3>
          
          {(licenseTypes?.length ?? 0) === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No license types configured in the system.
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Specialty</TableHead>
                    <TableHead>License Code</TableHead>
                    <TableHead>License Label</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(licenseTypes ?? []).map((licenseType) => (
                    <TableRow key={licenseType.id}>
                      <TableCell className="font-medium">
                        {licenseType.specialty || "General"}
                      </TableCell>
                      <TableCell>{licenseType.license_code}</TableCell>
                      <TableCell>{licenseType.license_label}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
