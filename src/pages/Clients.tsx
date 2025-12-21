import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MoreVertical, Pencil, Trash2, Mail, Phone, MapPin, User, FileText } from "lucide-react";
import { useClients, Client } from "@/hooks/useClients";
import { ClientFormData } from "@/types/client";
import { ClientForm } from "@/components/Clients/ClientForm";
import { ClientStatsCards } from "@/components/Clients/ClientStatsCards";
import { TreatmentPlanDialog } from "@/components/Clinical/TreatmentPlanDialog";
import { getClientDisplayName } from "@/utils/clientDisplayName";
import { useAuth } from "@/hooks/useAuth";

export default function Clients() {
  const { user } = useAuth();
  const { clients, loading, stats, createClient, updateClient, deleteClient } = useClients();
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [treatmentPlanClient, setTreatmentPlanClient] = useState<Client | null>(null);

  // Get clinician name for treatment plan
  const clinicianName = user?.staffAttributes?.staffData 
    ? `${user.staffAttributes.staffData.prov_name_f || ''} ${user.staffAttributes.staffData.prov_name_l || ''}`.trim()
    : '';

  // Filter and search clients
  const filteredClients = useMemo(() => {
    let filtered = clients;

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered?.filter(client => 
        getClientDisplayName(client).toLowerCase().includes(searchLower) ||
        client.email?.toLowerCase().includes(searchLower) ||
        client.phone?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [clients, searchTerm]);

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

  const formatAddress = (client: Client) => {
    const parts = [client.pat_addr_1, client.pat_city, client.pat_state, client.pat_zip].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground">Manage your client records</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Stats */}
      <ClientStatsCards stats={stats} />

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Client Grid */}
      {!loading && filteredClients && filteredClients.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <Card key={client.id} className="shadow-material-md hover:shadow-material-lg transition-shadow duration-normal">
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
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setTreatmentPlanClient(client)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Treatment Plan
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setEditingClient(client)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => setDeletingClient(client)}
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
                {client.assigned_staff_name && client.assigned_staff_name !== 'Unassigned' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Assigned to: {client.assigned_staff_name}</span>
                  </div>
                )}
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
              <User className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium text-foreground">No clients found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchTerm ? "Try adjusting your search" : "Get started by adding your first client"}
              </p>
              {!searchTerm && (
                <Button onClick={() => setIsFormOpen(true)} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Client
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
        client={treatmentPlanClient}
        clinicianName={clinicianName}
      />
    </div>
  );
}
