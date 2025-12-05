import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Clock, Video } from "lucide-react";
import { useUnifiedAppointments } from "@/hooks/useUnifiedAppointments";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { formatInUserTimezone } from "@/lib/timezoneUtils";
import { GracefulDataWrapper } from "@/components/ui/graceful-data-wrapper";

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

interface RecentJobsProps {
  enabled?: boolean;
}

export default function RecentJobs({ enabled = true }: RecentJobsProps) {
  const location = useLocation();
  const isDashboardRoute = location.pathname === '/staff/dashboard';
  
  const { 
    upcomingAppointments, 
    loading, 
    error, 
    refetch,
    isStale,
    isCircuitBreakerOpen,
    lastUpdated,
    errorType
  } = useUnifiedAppointments({ 
    enabled: enabled && isDashboardRoute 
  });
  
  const navigate = useNavigate();
  const userTimezone = useUserTimezone();

  const appointmentsContent = (
    <div className="space-y-4">
      {upcomingAppointments.map((appointment) => (
        <div 
          key={appointment.id}
          className="border border-border rounded-lg p-4 hover:shadow-material-sm transition-shadow duration-fast"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-foreground">{appointment.client_name}</h4>
                {appointment.is_telehealth && (
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Video className="h-3 w-3" />
                    Telehealth
                  </Badge>
                )}
                {appointment.series_id && (
                  <Badge variant="secondary" className="text-xs">
                    Recurring
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium text-primary">{appointment.service_name}</p>
            </div>
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <Badge className={`text-xs ${getStatusColor(appointment.status)}`}>
              {appointment.status}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatInUserTimezone(appointment.start_at, userTimezone, 'h:mm a')}
            </div>
          </div>
          
          <div className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium">
              {formatInUserTimezone(appointment.start_at, userTimezone, 'EEEE, MMM d, yyyy')}
            </span>
            {appointment.clinician_name && (
              <span className="ml-2">• {appointment.clinician_name}</span>
            )}
          </div>
        </div>
      ))}
      
      <div className="pt-2">
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => navigate('/staff/appointments')}
        >
          View All Appointments
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="shadow-material-md">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Upcoming Appointments</CardTitle>
      </CardHeader>
      <CardContent>
        <GracefulDataWrapper
          loading={loading}
          error={error}
          errorType={errorType}
          data={upcomingAppointments}
          isStale={isStale}
          isCircuitBreakerOpen={isCircuitBreakerOpen}
          lastUpdated={lastUpdated}
          onRetry={refetch}
          onRefresh={refetch}
          emptyStateTitle="No upcoming appointments"
          emptyStateDescription="Schedule your first appointment to get started"
        >
          {appointmentsContent}
        </GracefulDataWrapper>
      </CardContent>
    </Card>
  );
}
