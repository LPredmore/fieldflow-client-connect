import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  Select, 
  SelectContent, 
  SelectGroup,
  SelectItem, 
  SelectLabel,
  SelectSeparator,
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Plus, Search, MoreVertical, Pencil, Trash2, Mail, Phone, MapPin, User, FileText, Users, Eye, X } from "lucide-react";
import { useClients, Client } from "@/hooks/useClients";
import { ClientFormData } from "@/types/client";
import { ClientForm } from "@/components/Clients/ClientForm";
import { ClientStatsCards } from "@/components/Clients/ClientStatsCards";
import { TreatmentPlanDialog } from "@/components/Clinical/TreatmentPlanDialog";
import { getClientDisplayName } from "@/utils/clientDisplayName";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseQuery } from "@/hooks/data/useSupabaseQuery";

// Status options grouped by category
const STATUS_GROUPS = [
  {
    label: "Intake Pipeline",
    options: [
      { value: "Interested", label: "Interested" },
      { value: "New", label: "New" },
      { value: "Registered", label: "Registered" },
      { value: "Waitlist", label: "Waitlist" },
      { value: "Matching", label: "Matching" },
    ]
  },
  {
    label: "Active Treatment",
    options: [
      { value: "Active", label: "Active" },
      { value: "Unscheduled", label: "Unscheduled" },
      { value: "Scheduled", label: "Scheduled" },
      { value: "Early Sessions", label: "Early Sessions" },
      { value: "Established", label: "Established" },
    ]
  },
  {
    label: "Inactive",
    options: [
      { value: "Inactive", label: "Inactive" },
      { value: "Not the Right Time", label: "Not the Right Time" },
      { value: "Found Somewhere Else", label: "Found Somewhere Else" },
      { value: "Went Dark (Previously Seen)", label: "Went Dark" },
    ]
  },
  {
    label: "Needs Attention",
    options: [
      { value: "Unresponsive - Warm", label: "Unresponsive (Warm)" },
      { value: "Unresponsive - Cold", label: "Unresponsive (Cold)" },
      { value: "Manual Check", label: "Manual Check" },
      { value: "No Insurance", label: "No Insurance" },
      { value: "DNC", label: "Do Not Contact" },
      { value: "Blacklisted", label: "Blacklisted" },
    ]
  }
];

export default function AllClients() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.roleContext?.tenantId;
  const { clients, loading, stats, createClient, updateClient, deleteClient } = useClients({ allTenantClients: true });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [treatmentPlanClient, setTreatmentPlanClient] = useState<Client | null>(null);

  // Fetch staff list for filter dropdown
  const { data: staffList } = useSupabaseQuery<{
    id: string;
    prov_name_f: string | null;
    prov_name_l: string | null;
  }>({
    table: 'staff',
    select: 'id, prov_name_f, prov_name_l',
    filters: { tenant_id: 'auto' },
    enabled: !!tenantId,
    orderBy: { column: 'prov_name_l', ascending: true }
  });

  // Get clinician name for treatment plan
  const clinicianName = user?.staffAttributes?.staffData 
    ? `${user.staffAttributes.staffData.prov_name_f || ''} ${user.staffAttributes.staffData.prov_name_l || ''}`.trim()
    : '';

  // Check if any filters are active
  const hasActiveFilters = statusFilter !== "all" || staffFilter !== "all";

  // Clear all filters
  const clearFilters = () => {
    setStatusFilter("all");
    setStaffFilter("all");
  };

  // Filter and search clients
  const filteredClients = useMemo(() => {
    let filtered = clients;

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered?.filter(client => client.pat_status === statusFilter);
    }

    // Staff filter
    if (staffFilter === "unassigned") {
      filtered = filtered?.filter(client => !client.primary_staff_id);
    } else if (staffFilter !== "all") {
      filtered = filtered?.filter(client => client.primary_staff_id === staffFilter);
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered?.filter(client => 
        getClientDisplayName(client).toLowerCase().includes(searchLower) ||
        client.email?.toLowerCase().includes(searchLower) ||
        client.phone?.toLowerCase().includes(searchLower) ||
        client.assigned_staff_name?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [clients, searchTerm, statusFilter, staffFilter]);

  const handleEditClient = async (data: ClientFormData) => {
    if (editingClient) {
      await updateClient(editingClient.id, data);
      setEditingClient(null);
    }
  };

  const handleDeleteClient = async () => {
    if (deletingClient) {
      await deleteClient(deletingClient.id);
      setDeletingClient(null);
    }
  };

  const handleViewDetails = (client: Client) => {
    navigate(`/staff/allclients/${client.id}`);
  };

  const formatAddress = (client: Client) => {
    const parts = [client.pat_addr_1, client.pat_city, client.pat_state, client.pat_zip].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">All Clients</h1>
          <p className="text-muted-foreground">View and manage all clients across the organization</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Stats */}
      <ClientStatsCards stats={stats} />

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients or assigned staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectSeparator />
              {STATUS_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          {/* Staff Filter */}
          <Select value={staffFilter} onValueChange={setStaffFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Assigned Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {staffList && staffList.length > 0 && (
                <>
                  <SelectSeparator />
                  {staffList.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {`${staff.prov_name_f || ''} ${staff.prov_name_l || ''}`.trim() || 'Unnamed Staff'}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Client Grid */}
      {!loading && filteredClients && filteredClients.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <Card 
              key={client.id} 
              className="shadow-material-md hover:shadow-material-lg transition-shadow duration-normal cursor-pointer"
              onClick={() => handleViewDetails(client)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{getClientDisplayName(client)}</CardTitle>
                      {client.pat_name_preferred && (
                        <p className="text-sm text-muted-foreground">
                          Prefers: {client.pat_name_preferred}
                        </p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetails(client); }}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setTreatmentPlanClient(client); }}>
                        <FileText className="mr-2 h-4 w-4" />
                        Treatment Plan
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingClient(client); }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeletingClient(client); }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {client.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {formatAddress(client) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">{formatAddress(client)}</span>
                  </div>
                )}
                {/* Always show assigned staff for admin view */}
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-primary" />
                  <span className={client.assigned_staff_name === 'Unassigned' ? 'text-muted-foreground italic' : 'text-foreground font-medium'}>
                    {client.assigned_staff_name}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && (!filteredClients || filteredClients.length === 0) && (
        <Card className="shadow-material-sm">
          <CardContent className="py-12">
            <div className="text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium text-foreground">No clients found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {(searchTerm || hasActiveFilters) 
                  ? "Try adjusting your search or filters" 
                  : "No clients exist in this organization yet"}
              </p>
              {!searchTerm && !hasActiveFilters && (
                <Button onClick={() => setIsFormOpen(true)} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Client
                </Button>
              )}
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters} className="mt-4">
                  <X className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-material-sm animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Form */}
      <ClientForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={createClient}
        title="Add New Client"
      />

      {/* Edit Form */}
      <ClientForm
        open={!!editingClient}
        onOpenChange={(open) => !open && setEditingClient(null)}
        onSubmit={handleEditClient}
        client={editingClient}
        title="Edit Client"
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingClient} onOpenChange={(open) => !open && setDeletingClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingClient && getClientDisplayName(deletingClient)}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Treatment Plan Dialog */}
      <TreatmentPlanDialog
        open={!!treatmentPlanClient}
        onOpenChange={(open) => !open && setTreatmentPlanClient(null)}
        clientId={treatmentPlanClient?.id ?? null}
        clinicianName={clinicianName}
      />
    </div>
  );
}
