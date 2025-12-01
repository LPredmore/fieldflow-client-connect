import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, AlertTriangle, Search, ArrowUpDown, CheckCircle2, XCircle, Shield, Clock, Ban } from "lucide-react";
import { useSupabaseQuery } from "@/hooks/data/useSupabaseQuery";
import { format, differenceInDays, addYears } from "date-fns";
import { Loader2 } from "lucide-react";
import { EditLicenseDialog } from "./EditLicenseDialog";
import { US_STATES } from "@/constants/usStates";

type SortField = 'clinician_name' | 'state' | 'license_type' | 'expiration_date' | 'status' | 'verification_status';
type SortOrder = 'asc' | 'desc';

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

export function LicenseManagementTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [licenseTypeFilter, setLicenseTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [verificationFilter, setVerificationFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>('expiration_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [editingLicense, setEditingLicense] = useState<LicenseWithClinician | null>(null);

  // Fetch all licenses with clinician info
  const { data: licenses, loading, refetch } = useSupabaseQuery<LicenseWithClinician>({
    table: 'clinician_licenses',
    select: 'id, clinician_id, state, license_type, license_number, issue_date, expiration_date, is_primary, is_active, verification_status, verified_by_user_id, verified_at, verification_notes, clinicians(prov_name_f, prov_name_last)',
    orderBy: { column: 'expiration_date', ascending: true },
  });

  // Get unique license types from the data
  const uniqueLicenseTypes = useMemo(() => {
    if (!licenses) return [];
    const types = new Set(licenses.map(l => l.license_type));
    return Array.from(types).sort();
  }, [licenses]);

  // Calculate license status
  const getLicenseStatus = (expirationDate: string, isActive: boolean) => {
    if (!isActive) return 'inactive';
    const daysUntilExpiration = differenceInDays(new Date(expirationDate), new Date());
    if (daysUntilExpiration < 0) return 'expired';
    if (daysUntilExpiration <= 30) return 'expiring_soon';
    return 'active';
  };

  // Get verification status badge
  const getVerificationBadge = (verificationStatus: string) => {
    switch (verificationStatus) {
      case 'verified':
        return (
          <Badge variant="default" className="gap-1 bg-success text-success-foreground">
            <Shield className="h-3 w-3" />
            Verified
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="default" className="gap-1 bg-warning text-warning-foreground">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="gap-1">
            <Ban className="h-3 w-3" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Unverified
          </Badge>
        );
    }
  };

  // Filter and sort licenses
  const filteredAndSortedLicenses = useMemo(() => {
    if (!licenses) return [];

    let filtered = licenses.filter(license => {
      const clinicianName = `${license.clinicians?.prov_name_f || ''} ${license.clinicians?.prov_name_last || ''}`.toLowerCase();
      const matchesSearch = searchTerm === '' || 
        clinicianName.includes(searchTerm.toLowerCase()) ||
        license.license_number.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesState = stateFilter === 'all' || license.state === stateFilter;
      const matchesLicenseType = licenseTypeFilter === 'all' || license.license_type === licenseTypeFilter;
      
      const status = getLicenseStatus(license.expiration_date, license.is_active);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      
      const matchesVerification = verificationFilter === 'all' || license.verification_status === verificationFilter;

      return matchesSearch && matchesState && matchesLicenseType && matchesStatus && matchesVerification;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case 'clinician_name':
          aVal = `${a.clinicians?.prov_name_f} ${a.clinicians?.prov_name_last}`;
          bVal = `${b.clinicians?.prov_name_f} ${b.clinicians?.prov_name_last}`;
          break;
        case 'state':
          aVal = a.state;
          bVal = b.state;
          break;
        case 'license_type':
          aVal = a.license_type;
          bVal = b.license_type;
          break;
        case 'expiration_date':
          aVal = new Date(a.expiration_date);
          bVal = new Date(b.expiration_date);
          break;
        case 'status':
          aVal = getLicenseStatus(a.expiration_date, a.is_active);
          bVal = getLicenseStatus(b.expiration_date, b.is_active);
          break;
        case 'verification_status':
          aVal = a.verification_status;
          bVal = b.verification_status;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [licenses, searchTerm, stateFilter, licenseTypeFilter, statusFilter, verificationFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getStatusBadge = (expirationDate: string, isActive: boolean) => {
    const status = getLicenseStatus(expirationDate, isActive);
    const daysUntilExpiration = differenceInDays(new Date(expirationDate), new Date());

    switch (status) {
      case 'expired':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Expired
          </Badge>
        );
      case 'expiring_soon':
        return (
          <Badge variant="default" className="gap-1 bg-warning text-warning-foreground">
            <AlertTriangle className="h-3 w-3" />
            Expires in {daysUntilExpiration} days
          </Badge>
        );
      case 'inactive':
        return (
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3" />
            Inactive
          </Badge>
        );
      default:
        return (
          <Badge variant="default" className="gap-1 bg-success text-success-foreground">
            <CheckCircle2 className="h-3 w-3" />
            Active
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>License Management</CardTitle>
          <CardDescription>
            View, edit, and manage all clinician licenses across your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Name or license #"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="state-filter">State</Label>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger id="state-filter">
                  <SelectValue placeholder="All states" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="license-type-filter">License Type</Label>
              <Select value={licenseTypeFilter} onValueChange={setLicenseTypeFilter}>
                <SelectTrigger id="license-type-filter">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueLicenseTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-filter">Expiration Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verification-filter">Verification</Label>
              <Select value={verificationFilter} onValueChange={setVerificationFilter}>
                <SelectTrigger id="verification-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-transparent">.</Label>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSearchTerm("");
                  setStateFilter("all");
                  setLicenseTypeFilter("all");
                  setStatusFilter("all");
                  setVerificationFilter("all");
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => handleSort('clinician_name')}
                    >
                      Clinician
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => handleSort('state')}
                    >
                      State
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => handleSort('license_type')}
                    >
                      License Type
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>License Number</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => handleSort('expiration_date')}
                    >
                      Expiration
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => handleSort('status')}
                    >
                      Exp. Status
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => handleSort('verification_status')}
                    >
                      Verification
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedLicenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No licenses found matching your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedLicenses.map((license) => (
                    <TableRow key={license.id}>
                      <TableCell className="font-medium">
                        {license.clinicians?.prov_name_f} {license.clinicians?.prov_name_last}
                        {license.is_primary && (
                          <Badge variant="outline" className="ml-2">Primary</Badge>
                        )}
                      </TableCell>
                      <TableCell>{license.state}</TableCell>
                      <TableCell>{license.license_type}</TableCell>
                      <TableCell className="font-mono text-sm">{license.license_number}</TableCell>
                      <TableCell>
                        {license.issue_date ? format(new Date(license.issue_date), 'MMM d, yyyy') : 'N/A'}
                      </TableCell>
                      <TableCell>{format(new Date(license.expiration_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        {getStatusBadge(license.expiration_date, license.is_active)}
                      </TableCell>
                      <TableCell>
                        {getVerificationBadge(license.verification_status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingLicense(license)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Showing {filteredAndSortedLicenses.length} of {licenses?.length || 0} licenses
            </div>
            <div className="flex gap-4">
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-success" />
                Active: {filteredAndSortedLicenses.filter(l => getLicenseStatus(l.expiration_date, l.is_active) === 'active').length}
              </span>
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-warning" />
                Expiring Soon: {filteredAndSortedLicenses.filter(l => getLicenseStatus(l.expiration_date, l.is_active) === 'expiring_soon').length}
              </span>
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-destructive" />
                Expired: {filteredAndSortedLicenses.filter(l => getLicenseStatus(l.expiration_date, l.is_active) === 'expired').length}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {editingLicense && (
        <EditLicenseDialog
          license={editingLicense}
          onClose={() => setEditingLicense(null)}
          onSuccess={() => {
            refetch();
            setEditingLicense(null);
          }}
        />
      )}
    </>
  );
}
