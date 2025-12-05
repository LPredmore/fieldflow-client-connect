import { useState } from "react";
import { Plus, Search, Filter, Clock, Video } from "lucide-react";
import RoleIndicator from "@/components/Layout/RoleIndicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppointments, Appointment } from "@/hooks/useAppointments";
import AppointmentView from "@/components/Appointments/AppointmentView";
import { CreateAppointmentDialog } from "@/components/Appointments/CreateAppointmentDialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

export default function Appointments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewAppointment, setViewAppointment] = useState<Appointment | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  const { appointments, loading, refetch } = useAppointments();
  const { tenantId } = useAuth();
  const { toast } = useToast();

  // Filter appointments
  const filteredAppointments = appointments.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (item.client_name?.toLowerCase() || '').includes(searchLower) ||
      (item.service_name?.toLowerCase() || '').includes(searchLower)
    );
  });

  const handleUpdateAppointment = async (appointmentId: string, updates: Partial<Appointment>) => {
    try {
      const { client_name, service_name, ...dbUpdates } = updates;
      
      const { error } = await supabase
        .from('appointments')
        .update(dbUpdates)
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      toast({ title: "Appointment updated" });
      setViewAppointment(null);
      refetch();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating appointment",
        description: error.message,
      });
    }
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
              </div>
              <RoleIndicator />
            </div>
            <CreateAppointmentDialog 
              open={createDialogOpen}
              onOpenChange={setCreateDialogOpen}
              onSuccess={refetch}
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
                    placeholder="Search by client or service..."
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
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date/Time</TableHead>
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
                        {searchTerm ? `No appointments found matching "${searchTerm}"` : "No appointments found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAppointments.map((item) => (
                      <TableRow 
                        key={item.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setViewAppointment(item)}
                      >
                        <TableCell className="font-medium">{item.client_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.service_name}
                            {item.is_telehealth && (
                              <Video className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {item.series_id ? 'Recurring' : 'Single'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(item.status)}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(item.start_at), 'MMM d, yyyy h:mm a')}
                        </TableCell>
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
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
