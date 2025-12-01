import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useClinicianLicenses } from "@/hooks/useClinicianLicenses";
import { US_STATES } from "@/constants/usStates";
import { useLicenseTypes } from "@/hooks/useLicenseTypes";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Calendar, Shield } from "lucide-react";
import { addYears, format } from "date-fns";

interface LicenseWithClinician {
  id: string;
  clinician_id: string;
  state: string;
  license_type: string;
  license_number: string;
  issue_date: string | null;
  expiration_date: string;
  is_primary: boolean;
  is_active: boolean;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  verified_by_user_id: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  clinicians: {
    prov_name_f: string;
    prov_name_last: string;
  };
}

interface EditLicenseDialogProps {
  license: LicenseWithClinician;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditLicenseDialog({ license, onClose, onSuccess }: EditLicenseDialogProps) {
  const [formData, setFormData] = useState({
    state: license.state,
    license_type: license.license_type,
    license_number: license.license_number,
    issue_date: license.issue_date || '',
    expiration_date: license.expiration_date,
    is_primary: license.is_primary,
    is_active: license.is_active,
    verification_status: license.verification_status,
    verification_notes: license.verification_notes || '',
  });

  const { toast } = useToast();
  const { user } = useAuth();
  const { updateLicense, saving } = useClinicianLicenses(license.clinician_id);
  const { licenseTypes, loading: licenseTypesLoading } = useLicenseTypes();

  const uniqueLicenseTypes = Array.from(
    new Set(licenseTypes?.map(lt => lt.license).filter(Boolean))
  ) as string[];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare update data
    const updateData: any = {
      id: license.id,
      ...formData,
    };

    // If verification status changed to verified, add verification metadata
    if (formData.verification_status === 'verified' && license.verification_status !== 'verified') {
      updateData.verified_by_user_id = user?.id;
      updateData.verified_at = new Date().toISOString();
    }

    const result = await updateLicense(updateData);

    if (!result.error) {
      toast({
        title: "License updated",
        description: "The license has been successfully updated.",
      });
      onSuccess();
    }
  };

  const handleRenew = () => {
    const currentExpiration = new Date(formData.expiration_date);
    const newExpiration = addYears(currentExpiration, 1);
    setFormData({
      ...formData,
      expiration_date: format(newExpiration, 'yyyy-MM-dd'),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit License</DialogTitle>
          <DialogDescription>
            Update license information for {license.clinicians?.prov_name_f} {license.clinicians?.prov_name_last}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select
                value={formData.state}
                onValueChange={(value) => setFormData({ ...formData, state: value })}
              >
                <SelectTrigger id="state">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="license_type">License Type</Label>
              <Select
                value={formData.license_type}
                onValueChange={(value) => setFormData({ ...formData, license_type: value })}
                disabled={licenseTypesLoading}
              >
                <SelectTrigger id="license_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {uniqueLicenseTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="license_number">License Number</Label>
              <Input
                id="license_number"
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue_date">Issue Date</Label>
              <Input
                id="issue_date"
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiration_date">Expiration Date</Label>
              <div className="flex gap-2">
                <Input
                  id="expiration_date"
                  type="date"
                  value={formData.expiration_date}
                  onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  required
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRenew}
                  title="Renew for 1 year"
                >
                  <Calendar className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_primary">Primary License</Label>
                <p className="text-sm text-muted-foreground">
                  Mark this as the clinician's primary license
                </p>
              </div>
              <Switch
                id="is_primary"
                checked={formData.is_primary}
                onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive licenses won't be used for patient matching
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          {/* Verification Section */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Shield className="h-5 w-5" />
              License Verification
            </div>

            <div className="space-y-2">
              <Label htmlFor="verification_status">Verification Status</Label>
              <Select
                value={formData.verification_status}
                onValueChange={(value) => setFormData({ ...formData, verification_status: value as any })}
              >
                <SelectTrigger id="verification_status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unverified">Unverified</SelectItem>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Change status after checking against state licensing databases
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verification_notes">Verification Notes</Label>
              <Textarea
                id="verification_notes"
                placeholder="Add notes about verification (e.g., checked with state board, found discrepancy, etc.)"
                value={formData.verification_notes}
                onChange={(e) => setFormData({ ...formData, verification_notes: e.target.value })}
                rows={3}
              />
            </div>

            {license.verified_at && (
              <div className="text-sm text-muted-foreground">
                Last verified: {format(new Date(license.verified_at), 'MMM d, yyyy h:mm a')}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
