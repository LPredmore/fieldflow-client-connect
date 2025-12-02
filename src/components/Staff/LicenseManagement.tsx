/**
 * LicenseManagement Component
 * Reusable component for displaying and managing staff licenses
 * Used in Profile.tsx and ProfessionalSettings.tsx
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, Trash2, Check, X, AlertCircle } from 'lucide-react';
import { US_STATES } from '@/constants/usStates';
import { useStaffLicenses, type StaffLicense, type CreateLicenseData, type UpdateLicenseData } from '@/hooks/useStaffLicenses';
import { useLicenseTypes } from '@/hooks/useLicenseTypes';
import { format, parseISO, isAfter } from 'date-fns';

interface LicenseManagementProps {
  staffId: string;
  specialty?: string | null;
  readOnly?: boolean;
}

export function LicenseManagement({ staffId, specialty, readOnly = false }: LicenseManagementProps) {
  const { licenses, loading, createLicense, updateLicense, deleteLicense } = useStaffLicenses({ staffId });
  const { licenseTypes } = useLicenseTypes({ specialty });

  // Helper to get human-readable label from license code
  const getLicenseLabel = (code: string) => {
    const found = licenseTypes.find(lt => lt.license_code === code);
    return found?.license_label || code;
  };
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [newLicense, setNewLicense] = useState({
    state: '',
    licenseType: '',
    licenseNumber: '',
    issuedOn: '',
    expiresOn: '',
  });

  const [editLicense, setEditLicense] = useState<{
    licenseType: string;
    licenseNumber: string;
    issuedOn: string;
    expiresOn: string;
  }>({
    licenseType: '',
    licenseNumber: '',
    issuedOn: '',
    expiresOn: '',
  });

  const resetNewLicense = () => {
    setNewLicense({
      state: '',
      licenseType: '',
      licenseNumber: '',
      issuedOn: '',
      expiresOn: '',
    });
    setIsAdding(false);
  };

  const handleAddLicense = async () => {
    if (!newLicense.state || !newLicense.licenseType || !newLicense.licenseNumber) {
      return;
    }

    setIsSaving(true);
    const result = await createLicense({
      staff_id: staffId,
      license_state: newLicense.state as CreateLicenseData['license_state'],
      license_type: newLicense.licenseType,
      license_number: newLicense.licenseNumber,
      issue_date: newLicense.issuedOn || null,
      expiration_date: newLicense.expiresOn || null,
    });
    setIsSaving(false);

    if (!result.error) {
      resetNewLicense();
    }
  };

  const startEditing = (license: StaffLicense) => {
    setEditingId(license.id);
    setEditLicense({
      licenseType: license.license_type,
      licenseNumber: license.license_number,
      issuedOn: license.issue_date || '',
      expiresOn: license.expiration_date || '',
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditLicense({
      licenseType: '',
      licenseNumber: '',
      issuedOn: '',
      expiresOn: '',
    });
  };

  const handleUpdateLicense = async (licenseId: string) => {
    setIsSaving(true);
    const updateData: UpdateLicenseData = {
      license_type: editLicense.licenseType,
      license_number: editLicense.licenseNumber,
      issue_date: editLicense.issuedOn || null,
      expiration_date: editLicense.expiresOn || null,
    };
    
    const result = await updateLicense(licenseId, updateData);
    setIsSaving(false);

    if (!result.error) {
      cancelEditing();
    }
  };

  const handleDeleteLicense = async (licenseId: string) => {
    if (!confirm('Are you sure you want to remove this license?')) return;
    await deleteLicense(licenseId);
  };

  const isExpired = (expirationDate: string | null) => {
    if (!expirationDate) return false;
    return isAfter(new Date(), parseISO(expirationDate));
  };

  const isExpiringSoon = (expirationDate: string | null) => {
    if (!expirationDate) return false;
    const expDate = parseISO(expirationDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return !isExpired(expirationDate) && isAfter(thirtyDaysFromNow, expDate);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Existing Licenses */}
      {licenses.length === 0 && !isAdding ? (
        <p className="text-sm text-muted-foreground py-4">No licenses on file.</p>
      ) : (
        <div className="space-y-3">
          {licenses.map((license) => (
            <div 
              key={license.id} 
              className="flex items-start justify-between p-4 border rounded-lg bg-muted/30"
            >
              {editingId === license.id ? (
                // Edit Mode
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">License Type</Label>
                      <Select
                        value={editLicense.licenseType}
                        onValueChange={(value) => setEditLicense(prev => ({ ...prev, licenseType: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {licenseTypes.map((type) => (
                            <SelectItem key={type.id} value={type.license_code}>
                              {type.license_label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">License Number</Label>
                      <Input
                        value={editLicense.licenseNumber}
                        onChange={(e) => setEditLicense(prev => ({ ...prev, licenseNumber: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Issued On</Label>
                      <Input
                        type="date"
                        value={editLicense.issuedOn}
                        onChange={(e) => setEditLicense(prev => ({ ...prev, issuedOn: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Expires On</Label>
                      <Input
                        type="date"
                        value={editLicense.expiresOn}
                        onChange={(e) => setEditLicense(prev => ({ ...prev, expiresOn: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateLicense(license.id)}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelEditing}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                // View Mode
                <>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{license.license_state}</span>
                      <Badge variant="outline">{getLicenseLabel(license.license_type)}</Badge>
                      {isExpired(license.expiration_date) && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Expired
                        </Badge>
                      )}
                      {isExpiringSoon(license.expiration_date) && (
                        <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800">
                          <AlertCircle className="h-3 w-3" />
                          Expiring Soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      License #: {license.license_number}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      {license.issue_date && (
                        <span>Issued: {format(parseISO(license.issue_date), 'MMM d, yyyy')}</span>
                      )}
                      {license.issue_date && license.expiration_date && <span> • </span>}
                      {license.expiration_date && (
                        <span>Expires: {format(parseISO(license.expiration_date), 'MMM d, yyyy')}</span>
                      )}
                    </div>
                  </div>
                  {!readOnly && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing(license)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteLicense(license.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add New License Form */}
      {isAdding && (
        <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">New License</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">State *</Label>
              <Select
                value={newLicense.state}
                onValueChange={(value) => setNewLicense(prev => ({ ...prev, state: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.value} - {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">License Type *</Label>
              <Select
                value={newLicense.licenseType}
                onValueChange={(value) => setNewLicense(prev => ({ ...prev, licenseType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {licenseTypes.map((type) => (
                    <SelectItem key={type.id} value={type.license_code}>
                      {type.license_label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">License Number *</Label>
            <Input
              value={newLicense.licenseNumber}
              onChange={(e) => setNewLicense(prev => ({ ...prev, licenseNumber: e.target.value }))}
              placeholder="Enter license number"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Issued On</Label>
              <Input
                type="date"
                value={newLicense.issuedOn}
                onChange={(e) => setNewLicense(prev => ({ ...prev, issuedOn: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expires On</Label>
              <Input
                type="date"
                value={newLicense.expiresOn}
                onChange={(e) => setNewLicense(prev => ({ ...prev, expiresOn: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleAddLicense}
              disabled={isSaving || !newLicense.state || !newLicense.licenseType || !newLicense.licenseNumber}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add License'
              )}
            </Button>
            <Button variant="outline" onClick={resetNewLicense} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Add License Button */}
      {!isAdding && !readOnly && (
        <Button
          variant="outline"
          onClick={() => setIsAdding(true)}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add New License
        </Button>
      )}
    </div>
  );
}
