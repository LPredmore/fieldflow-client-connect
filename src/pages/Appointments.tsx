import { useState, useMemo } from "react";
import { Plus, Search, Filter, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAllAppointments, AllAppointment } from "@/hooks/useAllAppointments";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { useServices } from "@/hooks/useServices";
import { useTenantStaff } from "@/hooks/useTenantStaff";
import AppointmentView from "@/components/Appointments/AppointmentView";
import { CreateAppointmentDialog } from "@/components/Appointments/CreateAppointmentDialog";
import { AppointmentFilters, AppointmentFilterValues } from "@/components/Appointments/AppointmentFilters";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
    case 'documented':
      return 'bg-success text-success-foreground';
    case 'scheduled':
      return 'bg-primary text-primary-foreground';
    case 'cancelled':
      return 'bg-destructive text-destructive-foreground';
    case 'late_cancel/noshow':
      return 'bg-warning text-warning-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  documented: "Documented",
  cancelled: "Cancelled",
  "late_cancel/noshow": "Late Cancel / No Show",
};

const DEFAULT_FILTERS: AppointmentFilterValues = {
  status: null,
  clientId: null,
  serviceId: null,
  dateFrom: null,
  dateTo: null,
  staffIds: [],
};

export default function Appointments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewAppointment, setViewAppointment] = useState<AllAppointment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<AppointmentFilterValues>(DEFAULT_FILTERS);
  
  const { isAdmin } = useAuth();
  
  // Fetch tenant staff for admin multi-clinician filter (include inactive for historical data)
  const { tenantStaff } = useTenantStaff({ includeInactive: true });
  
  // Use the new useAllAppointments hook - directly queries appointments table
  const { 
    appointments, 
    loading,
    refetch: refetchAppointments,
  } = useAllAppointments({
    // Only pass staffIds for admins when they have selected specific clinicians
    staffIds: isAdmin && filters.staffIds.length > 0 ? filters.staffIds : undefined,
    dateFrom: filters.dateFrom?.toISOString(),
    dateTo: filters.dateTo?.toISOString(),
  });
  
  // Fetch clients and services for filter dropdowns
  const { clients } = useClients();
  const { services } = useServices();
  
  const { toast } = useToast();
  
  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status) count++;
    if (filters.clientId) count++;
    if (filters.serviceId) count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.staffIds.length > 0) count++;
    return count;
  }, [filters]);
  
  // Filter based on search term and client-side filters (status, client, service)
  const filteredAppointments = useMemo(() => {
    return appointments.filter(item => {
      // Text search
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        item.client_name.toLowerCase().includes(searchLower) ||
        item.service_name.toLowerCase().includes(searchLower) ||
        item.clinician_name.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
      
      // Status filter
      if (filters.status && item.status !== filters.status) {
        return false;
      }
      
      // Client filter
      if (filters.clientId && item.client_id !== filters.clientId) {
        return false;
      }
      
      // Service filter
      if (filters.serviceId && item.service_id !== filters.serviceId) {
        return false;
      }
      
      return true;
    });
  }, [appointments, searchTerm, filters.status, filters.clientId, filters.serviceId]);

  const handleViewAppointment = (appointment: AllAppointment) => {
    setViewAppointment(appointment);
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', deleteId);
      
      if (error) throw error;
      
      toast({
        title: "Appointment deleted",
        description: "The appointment has been deleted successfully.",
      });
      
      setDeleteId(null);
      refetchAppointments();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting",
        description: error.message,
      });
    }
  };

  const handleRefresh = async () => {
    await refetchAppointments();
  };

  // For AppointmentView compatibility, create a minimal update handler
  const handleUpdateAppointment = async (id: string, updates: any) => {
    const { error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id);
    
    if (error) throw error;
    
    await refetchAppointments();
  };

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      <div className="w-full">
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Appointments</h1>
                <p className="text-muted-foreground">Manage and track your appointments</p>
              </div>
              
            </div>
            <CreateAppointmentDialog 
              open={createDialogOpen}
              onOpenChange={setCreateDialogOpen}
              onAppointmentCreated={handleRefresh}
              trigger={
                <Button className="shadow-material-sm hover:shadow-material-md transition-shadow duration-fast">
                  <Plus className="h-4 w-4 mr-2" />
                  New Appointment
                </Button>
              }
            />
          </div>

          {/* Filters */}
          <Card className="mb-6 shadow-material-md">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by client, service, or clinician..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="sm:w-auto relative">
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                      {activeFilterCount > 0 && (
                        <Badge 
                          variant="secondary" 
                          className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                        >
                          {activeFilterCount}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 max-h-[80vh] overflow-y-auto" align="end">
                    <AppointmentFilters
                      filters={filters}
                      onFiltersChange={setFilters}
                      clients={clients || []}
                      services={services || []}
                      onClose={() => setFiltersOpen(false)}
                      isAdmin={isAdmin}
                      tenantStaff={tenantStaff}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Appointments Table */}
          <Card className="shadow-material-md">
            <CardHeader>
              <CardTitle>All Appointments ({filteredAppointments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Clinician</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-muted rounded animate-pulse"></div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredAppointments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {searchTerm || activeFilterCount > 0
                          ? "No appointments found matching your criteria"
                          : "No appointments found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAppointments.map((appointment) => (
                      <TableRow 
                        key={appointment.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewAppointment(appointment)}
                      >
                        <TableCell className="font-medium">
                          {appointment.client_name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {appointment.service_name}
                            {appointment.is_telehealth && (
                              <Video className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{appointment.clinician_name}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(appointment.status)}>
                            {STATUS_LABELS[appointment.status] || appointment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{appointment.display_date}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Appointment View Modal */}
        <Dialog open={!!viewAppointment} onOpenChange={() => setViewAppointment(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Appointment Details</DialogTitle>
            </DialogHeader>
            {viewAppointment && (
              <AppointmentView 
                job={viewAppointment}
                onUpdate={handleUpdateAppointment}
                onRefresh={handleRefresh}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this appointment. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
