import { useState } from "react";
import { Briefcase } from "lucide-react";
import { ErrorBoundary } from "@/components/ui/error-boundary";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStaffAppointments, StaffAppointment } from "@/hooks/useStaffAppointments";
import AppointmentCard from "@/components/Dashboard/AppointmentCard";
import { SessionDocumentationDialog, CancellationType } from "@/components/Appointments/SessionDocumentationDialog";
import { SessionNoteDialog } from "@/components/Clinical/SessionNoteDialog";
import { TreatmentPlanDialog } from "@/components/Clinical/TreatmentPlanDialog";
import { useTreatmentPlans } from "@/hooks/useTreatmentPlans";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isDashboardRoute = location.pathname === '/staff/dashboard';
  
  // Dialog state
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<StaffAppointment | null>(null);
  
  // Session Note dialog state
  const [sessionNoteDialogOpen, setSessionNoteDialogOpen] = useState(false);
  
  // Treatment Plan dialog state
  const [treatmentPlanDialogOpen, setTreatmentPlanDialogOpen] = useState(false);
  const [selectedClientIdForPlan, setSelectedClientIdForPlan] = useState<string | null>(null);
  
  // Get active treatment plan for selected appointment's client
  const { activePlan, refetch: refetchPlans } = useTreatmentPlans(selectedAppointment?.client_id);
  
  // Get staff ID for session notes
  const staffId = user?.staffAttributes?.staffData?.id;
  
  // Use unified staff appointments hook - all timezone handling is server-side
  const { 
    todaysAppointments,
    upcomingAppointments,
    undocumentedAppointments,
    updateAppointment,
    loading,
    refetch: refetchAppointments,
  } = useStaffAppointments({ 
    enabled: isDashboardRoute,
    lookbackDays: 90,
  });

  const handleDocumentSession = (appointmentId: string) => {
    const appt = [...todaysAppointments, ...undocumentedAppointments]
      .find(a => a.id === appointmentId);
    setSelectedAppointment(appt || null);
    setDocumentDialogOpen(true);
  };

  const handleSessionOccurred = (appointmentId: string) => {
    // This is now handled by the session_options phase in SessionDocumentationDialog
    // Keeping for backwards compatibility
    navigate(`/staff/appointments?view=${appointmentId}`);
  };

  const handleSessionNotOccurred = async (
    appointmentId: string,
    cancellationType: CancellationType,
    notes: string
  ) => {
    const charge = cancellationType === 'cancelled' ? 0 : 25;
    
    try {
      await updateAppointment(appointmentId, {
        status: cancellationType,
        charge_1: charge,
        narrative_1: notes || null,
      } as any); // Using 'any' because charge_1 and narrative_1 aren't in StaffAppointment interface but are valid DB fields
      
      toast({
        title: cancellationType === 'cancelled' ? 'Appointment Cancelled' : 'No Show Recorded',
        description: cancellationType === 'late_cancel/noshow' 
          ? 'A $25 late cancellation fee has been applied.'
          : 'The appointment has been marked as cancelled.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update appointment status. Please try again.',
      });
      throw error;
    }
  };

  const handleOpenSessionNote = (appointment: StaffAppointment) => {
    setSelectedAppointment(appointment);
    setSessionNoteDialogOpen(true);
  };

  const handleOpenTreatmentPlan = (clientId: string) => {
    setSelectedClientIdForPlan(clientId);
    setTreatmentPlanDialogOpen(true);
  };

  const handleSessionNoteSuccess = () => {
    refetchAppointments();
    setSessionNoteDialogOpen(false);
    setSelectedAppointment(null);
  };

  const handleTreatmentPlanSuccess = () => {
    refetchPlans();
    setTreatmentPlanDialogOpen(false);
    // Re-open the document dialog to allow creating session note
    if (selectedAppointment) {
      setDocumentDialogOpen(true);
    }
  };

  return (
    <ErrorBoundary>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
              <p className="text-muted-foreground">Welcome back! Here's your schedule overview.</p>
            </div>
            
          </div>
        </div>
        {/* Three Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Appointments */}
          <Card className="shadow-material-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Today's Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-20 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : todaysAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No appointments scheduled for today
                </p>
              ) : (
                <div className="space-y-3">
                  {todaysAppointments.map((appt) => (
                    <AppointmentCard
                      key={appt.id}
                      id={appt.id}
                      clientName={appt.client_name}
                      displayDate={appt.display_date}
                      displayTime={appt.display_time}
                      isTelehealth={appt.is_telehealth}
                      showDocumentButton
                      onDocumentClick={handleDocumentSession}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Appointments */}
          <Card className="shadow-material-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Upcoming Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-20 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : upcomingAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming appointments
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingAppointments.map((appt) => (
                    <AppointmentCard
                      key={appt.id}
                      id={appt.id}
                      clientName={appt.client_name}
                      displayDate={appt.display_date}
                      displayTime={appt.display_time}
                      isTelehealth={appt.is_telehealth}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Undocumented Appointments */}
          <Card className="shadow-material-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Undocumented Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-20 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : undocumentedAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  All appointments are documented
                </p>
              ) : (
                <div className="space-y-3">
                  {undocumentedAppointments.map((appt) => (
                    <AppointmentCard
                      key={appt.id}
                      id={appt.id}
                      clientName={appt.client_name}
                      displayDate={appt.display_date}
                      displayTime={appt.display_time}
                      isTelehealth={appt.is_telehealth}
                      showDocumentButton
                      onDocumentClick={handleDocumentSession}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Session Documentation Dialog */}
      <SessionDocumentationDialog
        open={documentDialogOpen}
        onOpenChange={setDocumentDialogOpen}
        appointment={selectedAppointment}
        onSessionOccurred={handleSessionOccurred}
        onSessionNotOccurred={handleSessionNotOccurred}
        onOpenSessionNote={handleOpenSessionNote}
        onOpenTreatmentPlan={handleOpenTreatmentPlan}
      />

      {/* Session Note Dialog */}
      {selectedAppointment && activePlan && staffId && (
        <SessionNoteDialog
          open={sessionNoteDialogOpen}
          onOpenChange={setSessionNoteDialogOpen}
          appointment={selectedAppointment}
          activePlan={activePlan}
          staffId={staffId}
          onSuccess={handleSessionNoteSuccess}
        />
      )}

      {/* Treatment Plan Dialog */}
      {selectedClientIdForPlan && (
        <TreatmentPlanDialog
          open={treatmentPlanDialogOpen}
          onOpenChange={(open) => {
            setTreatmentPlanDialogOpen(open);
            if (!open) {
              setSelectedClientIdForPlan(null);
            }
          }}
          clientId={selectedClientIdForPlan}
          clinicianName={user?.staffAttributes?.staffData?.prov_name_f + ' ' + user?.staffAttributes?.staffData?.prov_name_l}
        />
      )}
    </ErrorBoundary>
  );
};

export default Index;
