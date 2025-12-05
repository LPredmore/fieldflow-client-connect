import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppointmentManagement, ManagedAppointment, AppointmentSeries } from "@/hooks/useAppointmentManagement";
import { useAuth } from "@/hooks/useAuth";
import AppointmentView from "@/components/Appointments/AppointmentView";
import AppointmentSeriesView from "@/components/Appointments/AppointmentSeriesView";
import { CreateAppointmentDialog } from "@/components/Appointments/CreateAppointmentDialog";
import { useToast } from "@/hooks/use-toast";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { formatInUserTimezone } from "@/lib/timezoneUtils";

const TimezoneIndicator = () => {
  const userTimezone = useUserTimezone();
  const timezoneName = new Intl.DateTimeFormat('en', {
    timeZoneName: 'short'
  }).formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="h-4 w-4" />
      <span>Times shown in {timezoneName} ({userTimezone})</span>
    </div>
  );
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-success text-success-foreground';
    case 'scheduled':
      return 'bg-primary text-primary-foreground';
    case 'cancelled':
      return 'bg-destructive text-destructive-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

// Type guard to check if item is AppointmentSeries
function isAppointmentSeries(item: ManagedAppointment | AppointmentSeries): item is AppointmentSeries {
  return 'is_active' in item && 'rrule' in item;
}

export default function Appointments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewAppointment, setViewAppointment] = useState<ManagedAppointment | null>(null);
  const [viewSeries, setViewSeries] = useState<AppointmentSeries | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'appointment' | 'series'>('appointment');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  const { 
    appointments, 
    series, 
    loading, 
    updateAppointment, 
    updateSeries,
    deleteAppointment, 
    deleteSeries,
    refetch
  } = useAppointmentManagement();
  const { userRole, isAdmin } = useAuth();
  const { toast } = useToast();
  const userTimezone = useUserTimezone();

  // Combine and filter appointments and series
  const allItems = [...appointments, ...series];
  const filteredItems = allItems.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    return (
      item.client_name.toLowerCase().includes(searchLower) ||
      item.service_name.toLowerCase().includes(searchLower) ||
      item.clinician_name.toLowerCase().includes(searchLower)
    );
  });

  const handleViewItem = (item: ManagedAppointment | AppointmentSeries) => {
    if (isAppointmentSeries(item)) {
      setViewSeries(item);
    } else {
      setViewAppointment(item);
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

  const getItemDate = (item: ManagedAppointment | AppointmentSeries) => {
    if (isAppointmentSeries(item)) {
      return item.next_occurrence_date 
        ? formatInUserTimezone(item.next_occurrence_date, userTimezone, 'MMM d, yyyy h:mm a')
        : 'No upcoming';
    }
    return formatInUserTimezone(item.start_at, userTimezone, 'MMM d, yyyy h:mm a');
  };

  const getItemStatus = (item: ManagedAppointment | AppointmentSeries) => {
    if (isAppointmentSeries(item)) {
      return item.is_active ? 'Active' : 'Inactive';
    }
    return item.status;
  };

  const getItemStatusColor = (item: ManagedAppointment | AppointmentSeries) => {
    if (isAppointmentSeries(item)) {
      return item.is_active 
        ? 'bg-success text-success-foreground' 
        : 'bg-muted text-muted-foreground';
    }
    return getStatusColor(item.status);
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
                <TimezoneIndicator />
              </div>
              <RoleIndicator />
            </div>
            <CreateAppointmentDialog 
              open={createDialogOpen}
              onOpenChange={setCreateDialogOpen}
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
                <Button variant="outline" className="sm:w-auto">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
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
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date/Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}>
                            <div className="h-4 bg-muted rounded animate-pulse"></div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {searchTerm ? `No appointments found matching "${searchTerm}"` : "No appointments found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow 
                        key={item.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewItem(item)}
                      >
                        <TableCell className="font-medium">{item.client_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.service_name}
                            {'is_telehealth' in item && item.is_telehealth && (
                              <Video className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{item.clinician_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {isAppointmentSeries(item) ? 'Series' : 'Single'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getItemStatusColor(item)}>
                            {getItemStatus(item)}
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
        <Dialog open={!!viewAppointment} onOpenChange={() => setViewAppointment(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Appointment Details</DialogTitle>
            </DialogHeader>
            {viewAppointment && (
              <AppointmentView 
                job={viewAppointment}
                onUpdate={updateAppointment}
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
