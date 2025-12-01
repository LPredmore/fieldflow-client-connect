import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useStaffProfile } from '@/hooks/useStaffProfile';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';

interface LicenseType {
  id: number;
  license: string;
  specialty: string;
}

interface ProfessionalData {
  is_clinician?: boolean;
  clinician_license_type?: string;
  prov_npi?: string;
  clinician_taxonomy_code?: string;
  prov_name_f?: string;
  prov_name_last?: string;
  clinician_status?: 'New' | 'Active' | 'Inactive' | 'On Leave';
  clinician_accepting_new_clients?: 'Yes' | 'No';
}

interface ProfessionalSettingsProps {
  userId: string;
  onDataChange: (data: ProfessionalData) => void;
}

export function ProfessionalSettings({ userId, onDataChange }: ProfessionalSettingsProps) {
  const { staff, loading: staffLoading } = useStaffProfile({ profileId: userId });
  
  const { data: licenseTypes, loading: licenseLoading } = useSupabaseQuery<LicenseType>({
    table: 'cliniclevel_license_types',
    select: '*',
  });

  // Fetch staff status enum values from database
  const [statusOptions, setStatusOptions] = useState<string[]>(['New', 'Active', 'Inactive', 'On Leave']);
  
  useEffect(() => {
    const fetchStatusEnum = async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('prov_status')
        .limit(1);
      
      // Fallback to default values if query fails
      if (error) {
        console.warn('Could not fetch enum values, using defaults');
      }
    };
    fetchStatusEnum();
  }, []);

  const [isClinician, setIsClinician] = useState(false);
  const [formData, setFormData] = useState<ProfessionalData>({
    clinician_license_type: '',
    prov_npi: '',
    clinician_taxonomy_code: '',
    prov_name_f: '',
    prov_name_last: '',
    clinician_status: 'New' as const,
    clinician_accepting_new_clients: undefined,
  });

  // Initialize form data when staff data loads
  useEffect(() => {
    if (staff) {
      setIsClinician(staff.is_clinician || false);
      setFormData({
        clinician_license_type: staff.clinician_license_type || '',
        prov_npi: staff.prov_npi || '',
        clinician_taxonomy_code: staff.clinician_taxonomy_code || '',
        prov_name_f: staff.prov_name_f || '',
        prov_name_last: staff.prov_name_last || '',
        clinician_status: (staff.clinician_status as 'New' | 'Active' | 'Inactive' | 'On Leave') || 'New',
        clinician_accepting_new_clients: staff.clinician_accepting_new_clients as 'Yes' | 'No' | undefined,
      });
    }
  }, [staff]);

  const handleClinicianToggle = (checked: boolean) => {
    setIsClinician(checked);
    onDataChange({ ...formData, is_clinician: checked });
  };

  const handleChange = (field: keyof ProfessionalData, value: any) => {
    const updatedData = { ...formData, [field]: value };
    setFormData(updatedData);
    onDataChange({ ...updatedData, is_clinician: isClinician });
  };

  if (staffLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Professional Information</CardTitle>
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
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Professional Information</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No staff profile found for this user.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Professional Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Clinician Toggle */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="space-y-0.5">
            <Label htmlFor="clinician-toggle">Clinician</Label>
            <div className="text-sm text-muted-foreground">
              This staff member provides clinical services
            </div>
          </div>
          <Switch
            id="clinician-toggle"
            checked={isClinician}
            onCheckedChange={handleClinicianToggle}
          />
        </div>

        {/* Professional Fields - Only show when isClinician is true */}
        {isClinician && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* License */}
          <div className="space-y-2">
            <Label htmlFor="license" className="text-xs">License</Label>
            <Select
              value={formData.clinician_license_type}
              onValueChange={(value) => handleChange('clinician_license_type', value)}
              disabled={licenseLoading}
            >
              <SelectTrigger id="license" className="h-9">
                <SelectValue placeholder="Select license type" />
              </SelectTrigger>
              <SelectContent>
                {licenseTypes.map((type) => (
                  <SelectItem key={type.id} value={type.license}>
                    {type.license}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-xs">Status</Label>
            <Select
              value={formData.clinician_status}
              onValueChange={(value) => handleChange('clinician_status', value as 'New' | 'Active' | 'Inactive' | 'On Leave')}
            >
              <SelectTrigger id="status" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* NPI Number */}
          <div className="space-y-2">
            <Label htmlFor="npi" className="text-xs">NPI Number</Label>
            <Input
              id="npi"
              type="text"
              placeholder="10-digit number"
              value={formData.prov_npi}
              onChange={(e) => handleChange('prov_npi', e.target.value)}
              maxLength={10}
              className="h-9"
            />
          </div>

          {/* Accepting New Clients */}
          <div className="space-y-2">
            <Label htmlFor="accepting" className="text-xs">Accepting New Clients</Label>
            <Select
              value={formData.clinician_accepting_new_clients}
              onValueChange={(value) => handleChange('clinician_accepting_new_clients', value as 'Yes' | 'No')}
            >
              <SelectTrigger id="accepting" className="h-9">
                <SelectValue placeholder="Select option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Taxonomy Code */}
          <div className="space-y-2">
            <Label htmlFor="taxonomy" className="text-xs">Taxonomy Code</Label>
            <Input
              id="taxonomy"
              type="text"
              placeholder="Enter taxonomy code"
              value={formData.clinician_taxonomy_code}
              onChange={(e) => handleChange('clinician_taxonomy_code', e.target.value)}
              className="h-9"
            />
          </div>

          {/* Provider First Name */}
          <div className="space-y-2">
            <Label htmlFor="provider-first-name" className="text-xs">Provider First Name</Label>
            <Input
              id="provider-first-name"
              type="text"
              placeholder="First name for professional use"
              value={formData.prov_name_f}
              onChange={(e) => handleChange('prov_name_f', e.target.value)}
              className="h-9"
            />
          </div>

          {/* Provider Last Name */}
          <div className="space-y-2">
            <Label htmlFor="provider-last-name" className="text-xs">Provider Last Name</Label>
            <Input
              id="provider-last-name"
              type="text"
              placeholder="Last name for professional use"
              value={formData.prov_name_last}
              onChange={(e) => handleChange('prov_name_last', e.target.value)}
              className="h-9"
            />
          </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
