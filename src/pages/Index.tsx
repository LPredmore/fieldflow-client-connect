import { 
  Briefcase, 
  Users, 
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { ErrorBoundary } from "@/components/ui/error-boundary";

import RoleIndicator from "@/components/Layout/RoleIndicator";
import MetricCard from "@/components/Dashboard/MetricCard";
import RecentJobs from "@/components/Dashboard/RecentJobs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClients } from "@/hooks/useClients";
import { useAppointments } from "@/hooks/useAppointments";
import { ClientForm } from "@/components/Clients/ClientForm";
import { useMemo, useState } from "react";
import { format } from "date-fns";

const Index = () => {
  const { stats: clientStats, createClient } = useClients();
  const { appointments, loading: appointmentsLoading } = useAppointments();

  // Modal state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Calculate dashboard metrics from real data
  const dashboardMetrics = useMemo(() => {
    const activeJobs = appointments.filter(job => 
      job.status === 'scheduled'
    ).length;
    
    const cancelledJobs = appointments.filter(job => 
      job.status === 'cancelled'
    ).length;
    
    const todaysJobs = appointments.filter(job => {
      const today = new Date().toDateString();
      const jobDate = new Date(job.start_at).toDateString();
      return jobDate === today;
    }).length;

    // Calculate completion rate for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentJobs = appointments.filter(job => 
      new Date(job.start_at) >= thirtyDaysAgo
    );
    
    const completedRecentJobs = recentJobs.filter(job => 
      job.status === 'completed'
    ).length;
    
    const completionRate = recentJobs.length > 0 
      ? Math.round((completedRecentJobs / recentJobs.length) * 100)
      : 0;

    return {
      activeJobs,
      cancelledJobs,
      todaysJobs,
      completionRate,
      totalCustomers: clientStats.total,
    };
  }, [appointments, clientStats]);

  // Get today's scheduled jobs
  const todaysSchedule = useMemo(() => {
    const today = new Date().toDateString();
    return appointments
      .filter(job => {
        const jobDate = new Date(job.start_at).toDateString();
        return jobDate === today;
      })
      .slice(0, 3);
  }, [appointments]);

  return (
    <>
      <ErrorBoundary>
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
                <p className="text-muted-foreground">Welcome back! Here's what's happening with your practice.</p>
              </div>
              <RoleIndicator />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-4">
              <Button 
                onClick={() => window.location.href = '/staff/appointments'}
                className="shadow-material-sm hover:shadow-material-md transition-shadow duration-fast"
              >
                <Briefcase className="h-4 w-4 mr-2" />
                New Appointment
              </Button>
              <Button 
                onClick={() => setIsCustomerModalOpen(true)}
                variant="outline" 
                className="shadow-material-sm hover:shadow-material-md transition-shadow duration-fast"
              >
                <Users className="h-4 w-4 mr-2" />
                Add Client
              </Button>
              <Button 
                variant="outline" 
                className="shadow-material-sm hover:shadow-material-md transition-shadow duration-fast"
                onClick={() => window.location.href = '/staff/calendar'}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </Button>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Active Appointments"
              value={appointmentsLoading ? '...' : dashboardMetrics.activeJobs}
              subtitle={`${dashboardMetrics.todaysJobs} scheduled today`}
              icon={Briefcase}
            />
            <MetricCard
              title="Total Clients"
              value={dashboardMetrics.totalCustomers}
              subtitle={clientStats.active > 0 || clientStats.new > 0 
                ? `${clientStats.active} active, ${clientStats.new} new`
                : "No clients yet"
              }
              icon={Users}
            />
            <MetricCard
              title="Completion Rate"
              value={`${dashboardMetrics.completionRate}%`}
              subtitle="Last 30 days"
              icon={TrendingUp}
            />
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Recent Jobs - Takes up 2 columns */}
            <div className="xl:col-span-2">
              <RecentJobs />
            </div>

            {/* Today's Schedule */}
            <Card className="shadow-material-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Today's Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                {appointmentsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-muted rounded-lg animate-pulse"></div>
                    ))}
                  </div>
                ) : todaysSchedule.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No appointments scheduled for today
                  </p>
                ) : (
                  <div className="space-y-3">
                    {todaysSchedule.map((job) => {
                      const getJobStatusColor = (status: string) => {
                        switch (status) {
                          case 'completed':
                            return 'bg-success';
                          case 'scheduled':
                            return 'bg-primary';
                          default:
                            return 'bg-muted';
                        }
                      };

                      const getJobStatusIcon = (status: string) => {
                        switch (status) {
                          case 'completed':
                            return CheckCircle;
                          case 'scheduled':
                            return Calendar;
                          default:
                            return AlertTriangle;
                        }
                      };

                      const StatusIcon = getJobStatusIcon(job.status);

                      return (
                        <div key={job.id} className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                          <div className={`h-2 w-2 rounded-full ${getJobStatusColor(job.status)}`}></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{job.client_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(job.start_at), 'h:mm a')} - {job.service_name}
                            </p>
                          </div>
                          <StatusIcon className={`h-4 w-4 ${
                            job.status === 'completed' ? 'text-success' : 
                            job.status === 'cancelled' ? 'text-warning' : 
                            'text-primary'
                          }`} />
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => window.location.href = '/staff/calendar'}
                >
                  View Full Calendar
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </ErrorBoundary>

      {/* Modals */}
      <ClientForm
        open={isCustomerModalOpen}
        onOpenChange={setIsCustomerModalOpen}
        onSubmit={async (data) => {
          await createClient(data);
        }}
        title="Add New Client"
      />
    </>
  );
};

export default Index;
