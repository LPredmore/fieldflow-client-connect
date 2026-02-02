import { useState, useMemo } from "react";
import { Plus, Search, Filter, Clock, Video } from "lucide-react";
import RoleIndicator from "@/components/Layout/RoleIndicator";
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
import { useStaffAppointments, StaffAppointment } from "@/hooks/useStaffAppointments";
import { useAppointmentSeries, AppointmentSeries } from "@/hooks/useAppointmentSeries";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { useServices } from "@/hooks/useServices";
import AppointmentView from "@/components/Appointments/AppointmentView";
import AppointmentSeriesView from "@/components/Appointments/AppointmentSeriesView";
import { CreateAppointmentDialog } from "@/components/Appointments/CreateAppointmentDialog";
import { AppointmentFilters, AppointmentFilterValues } from "@/components/Appointments/AppointmentFilters";
import { useToast } from "@/hooks/use-toast";

const TimezoneIndicator = ({ timezone }: { timezone: string }) => {
  if (!timezone) return null;
  
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="h-4 w-4" />
      <span>Times shown in {timezone}</span>
    </div>
  );
};

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

// Type to represent either an appointment or a series in the combined list
type ListItem = (StaffAppointment & { itemType: 'appointment' }) | (AppointmentSeries & { itemType: 'series' });

// Type guard to check if item is AppointmentSeries
function isAppointmentSeries(item: ListItem): item is (AppointmentSeries & { itemType: 'series' }) {
  return item.itemType === 'series';
}

const DEFAULT_FILTERS: AppointmentFilterValues = {
  status: null,
  clientId: null,
  serviceId: null,
  dateFrom: null,
  dateTo: null,
};

export default function Appointments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewAppointmentId, setViewAppointmentId] = useState<string | null>(null);
  const [viewSeries, setViewSeries] = useState<AppointmentSeries | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'appointment' | 'series'>('appointment');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<AppointmentFilterValues>(DEFAULT_FILTERS);
  
  // Use unified staff appointments for timezone-aware display with pre-formatted strings
  const { 
    appointments, 
    getAppointmentById, 
    staffTimezone,
    updateAppointment,
    deleteAppointment,
    refetch: refetchAppointments,
    loading: appointmentsLoading,
  } = useStaffAppointments();
  
  // Use appointment series for series CRUD operations
  const {
    series,
    updateSeries,
    deleteSeries,
    refetch: refetchSeries,
    loading: seriesLoading,
  } = useAppointmentSeries();
  
  // Fetch clients and services for filter dropdowns
  const { clients } = useClients();
  const { services } = useServices();
  
  // Get the selected appointment with pre-formatted display strings
  const viewAppointment = viewAppointmentId ? getAppointmentById(viewAppointmentId) : null;
  
  const { userRole, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const loading = appointmentsLoading || seriesLoading;

  // Combine appointments and series into a single list with type discriminator
  const allItems: ListItem[] = [
    ...appointments.map(a => ({ ...a, itemType: 'appointment' as const })),
    ...series.map(s => ({ ...s, itemType: 'series' as const })),
  ];
  
  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status) count++;
    if (filters.clientId) count++;
    if (filters.serviceId) count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    return count;
  }, [filters]);
  
  // Filter based on search term and advanced filters
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      // Text search
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        item.client_name.toLowerCase().includes(searchLower) ||
        item.service_name.toLowerCase().includes(searchLower) ||
        item.clinician_name.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
      
      // Status filter (only for appointments, series have is_active)
      if (filters.status) {
        if (isAppointmentSeries(item)) {
          // Map status filter to series is_active
          if (filters.status === 'scheduled' && !item.is_active) return false;
          if (filters.status === 'cancelled' && item.is_active) return false;
        } else {
          if (item.status !== filters.status) return false;
        }
      }
      
      // Client filter
      if (filters.clientId && item.client_id !== filters.clientId) {
        return false;
      }
      
      // Service filter
      if (filters.serviceId && item.service_id !== filters.serviceId) {
        return false;
      }
      
      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        let itemDate: Date;
        if (isAppointmentSeries(item)) {
          itemDate = item.next_occurrence_date 
            ? new Date(item.next_occurrence_date) 
            : new Date(item.start_at);
        } else {
          itemDate = new Date(item.start_at);
        }
        
        if (filters.dateFrom && itemDate < filters.dateFrom) return false;
        if (filters.dateTo) {
          // Include the entire end date
          const endOfDay = new Date(filters.dateTo);
          endOfDay.setHours(23, 59, 59, 999);
          if (itemDate > endOfDay) return false;
        }
      }
      
      return true;
    });
  }, [allItems, searchTerm, filters]);

  const handleViewItem = (item: ListItem) => {
    if (isAppointmentSeries(item)) {
      // Extract series without itemType for the modal
      const { itemType, ...seriesData } = item;
      setViewSeries(seriesData);
    } else {
      setViewAppointmentId(item.id);
    }
  };

  const handleDelete = (id: string, type: 'appointment' | 'series') => {
    setDeleteId(id);
    setDeleteType(type);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    
    try {
      if (deleteType === 'series') {
        await deleteSeries(deleteId);
      } else {
        await deleteAppointment(deleteId);
      }
      setDeleteId(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting",
        description: error.message,
      });
    }
  };

  const handleRefresh = async () => {
    await Promise.all([refetchAppointments(), refetchSeries()]);
  };

  const getItemDate = (item: ListItem) => {
    if (isAppointmentSeries(item)) {
      // For series, show next occurrence or "No upcoming"
      if (item.next_occurrence_date) {
        return new Date(item.next_occurrence_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
      return 'No upcoming';
    }
    // For appointments, use pre-formatted display_date if available
    return item.display_date || new Date(item.start_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getItemStatus = (item: ListItem) => {
    if (isAppointmentSeries(item)) {
      return item.is_active ? 'Active' : 'Inactive';
    }
    return item.status;
  };

  const getItemStatusLabel = (item: ListItem) => {
    if (isAppointmentSeries(item)) {
      return item.is_active ? 'Active Series' : 'Inactive Series';
    }
    return STATUS_LABELS[item.status] || item.status;
  };

  const getItemStatusColor = (item: ListItem) => {
    if (isAppointmentSeries(item)) {
      return item.is_active 
        ? 'bg-success text-success-foreground' 
        : 'bg-muted text-muted-foreground';
    }
    return getStatusColor(item.status);
  };

  // Get client display name: preferred name + last name
  const getClientDisplayName = (item: ListItem) => {
    // For appointments, we have client_legal_name which is "First Last"
    // But we want "Preferred Last" - the hook gives us client_name (preferred) and client_legal_name
    if (!isAppointmentSeries(item)) {
      // client_legal_name is "First Last", we need to extract last name
      const legalName = item.client_legal_name || '';
      const lastNameMatch = legalName.split(' ').pop() || '';
      const preferredOrFirst = item.client_name || legalName.split(' ')[0] || '';
      
      if (preferredOrFirst && lastNameMatch && preferredOrFirst !== lastNameMatch) {
        return `${preferredOrFirst} ${lastNameMatch}`;
      }
      return item.client_name || legalName || 'Unknown Client';
    }
    // For series, use client_name which includes preferred name
    return item.client_name || 'Unknown Client';
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full">
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Appointments</h1>
                <p className="text-muted-foreground">Manage and track your appointments</p>
                <TimezoneIndicator timezone={staffTimezone} />
              </div>
              <RoleIndicator />
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
                  <PopoverContent className="w-80" align="end">
                    <AppointmentFilters
                      filters={filters}
                      onFiltersChange={setFilters}
                      clients={clients || []}
                      services={services || []}
                      onClose={() => setFiltersOpen(false)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Appointments Table */}
          <Card className="shadow-material-md">
            <CardHeader>
              <CardTitle>All Appointments</CardTitle>
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
                  ) : filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {searchTerm || activeFilterCount > 0
                          ? "No appointments found matching your criteria"
                          : "No appointments found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow 
                        key={item.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewItem(item)}
                      >
                        <TableCell className="font-medium">
                          {getClientDisplayName(item)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.service_name}
                            {!isAppointmentSeries(item) && item.is_telehealth && (
                              <Video className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{item.clinician_name}</TableCell>
                        <TableCell>
                          <Badge className={getItemStatusColor(item)}>
                            {getItemStatusLabel(item)}
                          </Badge>
                        </TableCell>
                        <TableCell>{getItemDate(item)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Appointment View Modal */}
        <Dialog open={!!viewAppointment} onOpenChange={() => setViewAppointmentId(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Appointment Details</DialogTitle>
            </DialogHeader>
            {viewAppointment && (
              <AppointmentView 
                job={viewAppointment}
                onUpdate={updateAppointment}
                onRefresh={handleRefresh}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Series View Modal */}
        <Dialog open={!!viewSeries} onOpenChange={() => setViewSeries(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Appointment Series Details</DialogTitle>
            </DialogHeader>
            {viewSeries && (
              <AppointmentSeriesView 
                jobSeries={viewSeries}
                onUpdate={updateSeries}
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
                {deleteType === 'series' 
                  ? 'This will delete the series and all its scheduled appointments. This action cannot be undone.'
                  : 'This will permanently delete this appointment. This action cannot be undone.'
                }
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
