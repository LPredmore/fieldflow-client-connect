import { 
  Briefcase, 
  Users, 
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { GracefulDataWrapper } from "@/components/ui/graceful-data-wrapper";
import { ErrorBoundary } from "@/components/ui/error-boundary";

import RoleIndicator from "@/components/Layout/RoleIndicator";
import MetricCard from "@/components/Dashboard/MetricCard";
import RecentJobs from "@/components/Dashboard/RecentJobs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClients } from "@/hooks/useClients";
import { useUnifiedAppointments } from "@/hooks/useUnifiedAppointments";
import { ClientForm } from "@/components/Clients/ClientForm";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

const Index = () => {
  const location = useLocation();
  const isDashboardRoute = location.pathname === '/staff/dashboard';
  
  const { stats: clientStats, createClient } = useClients();
  const { 
    unifiedJobs: appointments,
    error: appointmentsError,
    isStale: appointmentsStale,
    isCircuitBreakerOpen: appointmentsCircuitOpen,
    lastUpdated: appointmentsLastUpdated,
    refetchJobs
  } = useUnifiedAppointments({ 
    enabled: isDashboardRoute 
  });

  // Modal state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Calculate dashboard metrics from real data
  const dashboardMetrics = useMemo(() => {
    const activeJobs = appointments.filter(job => 
      job.status === 'scheduled' || job.status === 'in_progress'
    ).length;
    
    const urgentJobs = appointments.filter(job => 
      job.priority === 'urgent' || job.priority === 'high'
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
      urgentJobs,
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
      .slice(0, 3); // Show up to 3 jobs
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
                  <p className="text-muted-foreground">Welcome back! Here's what's happening with your field operations.</p>
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
                Add Customer
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
              title="Active Jobs"
              value={dashboardMetrics.activeJobs}
              subtitle={`${dashboardMetrics.urgentJobs} urgent, ${dashboardMetrics.todaysJobs} scheduled today`}
              icon={Briefcase}
            />
            <MetricCard
              title="Total Patients"
              value={dashboardMetrics.totalCustomers}
              subtitle={clientStats.active > 0 || clientStats.new > 0 
                ? `${clientStats.active} active, ${clientStats.new} new`
                : "No patients yet"
              }
              icon={Users}
            />
            <MetricCard
              title="Completion Rate"
              value={`${dashboardMetrics.completionRate}%`}
              subtitle="Jobs completed on time (last 30 days)"
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
                <GracefulDataWrapper
                  loading={false} // Today's schedule is derived from appointments data
                  error={appointmentsError}
                  data={todaysSchedule}
                  isStale={appointmentsStale}
                  isCircuitBreakerOpen={appointmentsCircuitOpen}
                  lastUpdated={appointmentsLastUpdated}
                  onRetry={refetchJobs}
                  onRefresh={refetchJobs}
                  emptyStateTitle="No jobs scheduled for today"
                  emptyStateDescription="Schedule some jobs to see them here"
                  showCachedIndicator={false} // We'll show it at the top level
                >
                  <div className="space-y-3">
                    {todaysSchedule.map((job) => {
                      const getJobStatusColor = (status: string) => {
                        switch (status) {
                          case 'completed':
                            return 'bg-success';
                          case 'in_progress':
                            return 'bg-warning';
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
                          case 'in_progress':
                            return Clock;
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
                            <p className="text-sm font-medium">{job.customer_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(job.start_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {job.title}
                            </p>
                          </div>
                          <StatusIcon className={`h-4 w-4 ${
                            job.status === 'completed' ? 'text-success' : 
                            job.status === 'in_progress' ? 'text-warning' : 
                            'text-primary'
                          }`} />
                        </div>
                      );
                    })}
                  </div>
                  
                  <Button 
                    variant="outline" 
                    className="w-full mt-4"
                    onClick={() => window.location.href = '/staff/calendar'}
                  >
                    View Full Calendar
                  </Button>
                </GracefulDataWrapper>
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
        title="Add New Patient"
      />
    </>
  );
};

export default Index;