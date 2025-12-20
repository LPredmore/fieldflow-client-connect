import { Briefcase } from "lucide-react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import RoleIndicator from "@/components/Layout/RoleIndicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStaffAppointments } from "@/hooks/useStaffAppointments";
import AppointmentCard from "@/components/Dashboard/AppointmentCard";
import { useLocation, useNavigate } from "react-router-dom";

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboardRoute = location.pathname === '/staff/dashboard';
  
  // Use unified staff appointments hook - all timezone handling is server-side
  const { 
    todaysAppointments,
    upcomingAppointments,
    undocumentedAppointments,
    loading,
  } = useStaffAppointments({ 
    enabled: isDashboardRoute 
  });

  const handleDocumentSession = (appointmentId: string) => {
    navigate(`/staff/appointments?view=${appointmentId}`);
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
            <RoleIndicator />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={() => navigate('/staff/appointments')}
              className="shadow-material-sm hover:shadow-material-md transition-shadow duration-fast"
            >
              <Briefcase className="h-4 w-4 mr-2" />
              New Appointment
            </Button>
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
    </ErrorBoundary>
  );
};

export default Index;
