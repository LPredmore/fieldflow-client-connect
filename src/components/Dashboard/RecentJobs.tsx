import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Clock, Video } from "lucide-react";
import { useAppointments } from "@/hooks/useAppointments";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

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

export default function RecentJobs() {
  const { upcomingAppointments, loading } = useAppointments();
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card className="shadow-material-md">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Upcoming Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-material-md">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Upcoming Appointments</CardTitle>
      </CardHeader>
      <CardContent>
        {upcomingAppointments.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No upcoming appointments
          </p>
        ) : (
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
                    {format(new Date(appointment.start_at), 'h:mm a')}
                  </div>
                </div>
                
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium">
                    {format(new Date(appointment.start_at), 'EEEE, MMM d, yyyy')}
                  </span>
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
        )}
      </CardContent>
    </Card>
  );
}
