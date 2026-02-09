import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, ReactNode } from "react";
import { AppRouter } from "@/components/AppRouter";
import { Layout } from "@/components/Layout/Layout";
import { useAuth } from "@/contexts/AuthenticationContext";
import { isAdminOrAccountOwner } from "@/utils/permissionUtils";

// Core pages - load immediately for better performance
import Index from "@/pages/Index";
import Appointments from "@/pages/Appointments";
import Clients from "@/pages/Clients";
import AllClients from "@/pages/AllClients";
import ClientDetail from "@/pages/ClientDetail";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import Forms from "@/pages/Forms";
import Messages from "@/pages/Messages";

// Lazy load less critical pages
const Calendar = lazy(() => import("@/pages/Calendar"));
const StaffRegistration = lazy(() => import("@/pages/staff/StaffRegistration"));

const PageLoadingFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
  </div>
);

/**
 * Guard component that restricts access to ADMIN or ACCOUNT_OWNER staff roles
 */
const AdminOnlyRoute = ({ children, fallbackMessage }: { children: ReactNode, fallbackMessage: string }) => {
  const { user, isLoading } = useAuth();
  const staffRoleCodes = user?.staffAttributes?.staffRoleCodes;
  const canAccess = isAdminOrAccountOwner(staffRoleCodes);
  
  if (isLoading) {
    return <PageLoadingFallback />;
  }
  
  if (!canAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <p className="text-muted-foreground">{fallbackMessage}</p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
};

const StaffPortalApp = () => {
  return (
    <Routes>
      {/* Staff Registration - outside main AppRouter to allow access for needs_onboarding state */}
      <Route path="/registration" element={
        <Suspense fallback={<PageLoadingFallback />}>
          <StaffRegistration />
        </Suspense>
      } />

      {/* Main Staff Portal - requires staff or admin state */}
      <Route path="/*" element={
        <AppRouter 
          allowedStates={['staff', 'admin']} 
          portalType="staff"
        >
          <Layout>
            <Routes>
              {/* Redirect /staff to /staff/dashboard */}
              <Route path="/" element={<Navigate to="/staff/dashboard" replace />} />
          
          {/* Dashboard */}
          <Route path="/dashboard" element={<Index />} />
          
          {/* Core business functionality - available to all staff */}
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:clientId" element={<ClientDetail />} />
          <Route path="/profile" element={<Profile />} />
          
          {/* Admin-only: All Clients view (ADMIN or ACCOUNT_OWNER staff roles) */}
          <Route path="/allclients" element={
            <AdminOnlyRoute fallbackMessage="You need Admin or Account Owner privileges to view all clients.">
              <AllClients />
            </AdminOnlyRoute>
          } />
          
          {/* Admin-only: All Clients detail view (ADMIN or ACCOUNT_OWNER staff roles) */}
          <Route path="/allclients/:clientId" element={
            <AdminOnlyRoute fallbackMessage="You need Admin or Account Owner privileges to view this client.">
              <ClientDetail />
            </AdminOnlyRoute>
          } />
          
          {/* Legacy route redirect */}
          <Route path="/customers" element={<Navigate to="/staff/clients" replace />} />
          
          {/* Admin-only: Forms (ADMIN or ACCOUNT_OWNER staff roles) */}
          <Route path="/forms" element={
            <AdminOnlyRoute fallbackMessage="You need Admin or Account Owner privileges to access Forms.">
              <Forms />
            </AdminOnlyRoute>
          } />
          
          <Route path="/messages" element={<Messages />} />
          
          <Route path="/calendar" element={
            <Suspense fallback={<PageLoadingFallback />}>
              <Calendar />
            </Suspense>
          } />
          
          {/* Admin-only: Settings (ADMIN or ACCOUNT_OWNER staff roles) */}
          <Route path="/settings" element={
            <AdminOnlyRoute fallbackMessage="You need Admin or Account Owner privileges to access Settings.">
              <Settings />
            </AdminOnlyRoute>
          } />
            </Routes>
          </Layout>
        </AppRouter>
      } />
    </Routes>
  );
};

export default StaffPortalApp;
