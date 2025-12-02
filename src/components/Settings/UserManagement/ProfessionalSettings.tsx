import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Stethoscope } from 'lucide-react';
import { useStaffProfile } from '@/hooks/useStaffProfile';
import { LicenseManagement } from '@/components/Staff/LicenseManagement';

interface ProfessionalData {
  prov_npi?: string;
  prov_taxonomy?: string;
  prov_status?: string;
  prov_accepting_new_clients?: 'Yes' | 'No';
}

interface ProfessionalSettingsProps {
  userId: string;
  onDataChange: (data: ProfessionalData) => void;
}

export function ProfessionalSettings({ userId, onDataChange }: ProfessionalSettingsProps) {
  const { staff, loading: staffLoading } = useStaffProfile({ profileId: userId });
  
  const [formData, setFormData] = useState<ProfessionalData>({
    prov_npi: '',
    prov_taxonomy: '',
    prov_status: '',
    prov_accepting_new_clients: 'No',
  });

  // Initialize form data when staff data loads
  useEffect(() => {
    if (staff) {
      setFormData({
        prov_npi: staff.prov_npi || '',
        prov_taxonomy: staff.prov_taxonomy || '',
        prov_status: staff.prov_status || '',
        prov_accepting_new_clients: staff.prov_accepting_new_clients || 'No',
      });
    }
  }, [staff]);

  const handleChange = (field: keyof ProfessionalData, value: string | boolean) => {
    let dbValue: string | 'Yes' | 'No' = value as string;
    
    // Convert boolean to 'Yes'/'No' for prov_accepting_new_clients
    if (field === 'prov_accepting_new_clients' && typeof value === 'boolean') {
      dbValue = value ? 'Yes' : 'No';
    }
    
    const newData = { ...formData, [field]: dbValue };
    setFormData(newData);
    onDataChange(newData);
  };

  // Show loading state while data is being fetched
  if (staffLoading && !staff) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!staff) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">No staff profile found for this user.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5" />
          <CardTitle>Professional Information</CardTitle>
        </div>
        <CardDescription>
          Manage provider credentials and professional details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* License Management - uses staff_licenses table */}
        <div className="space-y-2">
          <Label>State Licenses</Label>
          <LicenseManagement 
            staffId={staff.id} 
            specialty={staff.prov_field}
          />
        </div>

        {/* NPI */}
        <div className="space-y-2">
          <Label htmlFor="npi">National Provider Identifier (NPI)</Label>
          <Input
            id="npi"
            value={formData.prov_npi}
            onChange={(e) => handleChange('prov_npi', e.target.value)}
            placeholder="Enter NPI"
          />
        </div>

        {/* Taxonomy Code */}
        <div className="space-y-2">
          <Label htmlFor="taxonomy">Taxonomy Code</Label>
          <Input
            id="taxonomy"
            value={formData.prov_taxonomy}
            onChange={(e) => handleChange('prov_taxonomy', e.target.value)}
            placeholder="Enter taxonomy code"
          />
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="status">Provider Status</Label>
          <Select
            value={formData.prov_status}
            onValueChange={(value) => handleChange('prov_status', value)}
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="On Leave">On Leave</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Accepting New Clients */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="accepting-clients">Accepting New Clients</Label>
            <p className="text-sm text-muted-foreground">
              Toggle whether this provider is accepting new clients
            </p>
          </div>
          <Switch
            id="accepting-clients"
            checked={formData.prov_accepting_new_clients === 'Yes'}
            onCheckedChange={(checked) => handleChange('prov_accepting_new_clients', checked)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
