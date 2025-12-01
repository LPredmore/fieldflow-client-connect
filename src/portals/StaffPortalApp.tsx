import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AppRouter } from "@/components/AppRouter";
import { PermissionGuard } from "@/components/Permissions/PermissionGuard";
import { Layout } from "@/components/Layout/Layout";

// Core pages - load immediately for better performance
import Index from "@/pages/Index";
import Appointments from "@/pages/Appointments";
import Customers from "@/pages/Customers";
import Services from "@/pages/Services";
import Invoices from "@/pages/Invoices";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import Forms from "@/pages/Forms";

// Lazy load less critical pages
const Calendar = lazy(() => import("@/pages/Calendar"));
const StaffRegistration = lazy(() => import("@/pages/staff/StaffRegistration"));

const PageLoadingFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
  </div>
);

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
          <Route path="/customers" element={<Customers />} />
          <Route path="/profile" element={<Profile />} />
          
          {/* Permission-protected routes */}
          <Route path="/services" element={
            <PermissionGuard 
              requiredPermissions={['access_services']}
              fallbackMessage="You need Services permission to access this page."
            >
              <Services />
            </PermissionGuard>
          } />
          
          <Route path="/invoices" element={
            <PermissionGuard 
              requiredPermissions={['access_invoicing']}
              fallbackMessage="You need Invoicing permission to access this page."
            >
              <Invoices />
            </PermissionGuard>
          } />
          
          <Route path="/forms" element={
            <PermissionGuard 
              requiredPermissions={['access_forms']}
              fallbackMessage="You need Forms permission to access this page."
            >
              <Forms />
            </PermissionGuard>
          } />
          
          <Route path="/calendar" element={
            <Suspense fallback={<PageLoadingFallback />}>
              <Calendar />
            </Suspense>
          } />
          
          {/* Admin-only routes */}
          <Route path="/settings" element={
            <AppRouter 
              allowedStates={['admin']}
              portalType="staff"
              fallbackMessage="You need admin privileges to access settings."
            >
              <Settings />
            </AppRouter>
          } />
            </Routes>
          </Layout>
        </AppRouter>
      } />
    </Routes>
  );
};

export default StaffPortalApp;