import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AppRouter } from "@/components/AppRouter";
import ClientLayout from "@/components/Layout/ClientLayout";
import { ClientRoutingState } from "@/hooks/useClientRouting";

// Stable array references - defined outside component to prevent re-render loops
const REGISTRATION_ALLOWED_STATES: ClientRoutingState[] = ['needs_registration'];
const SIGNUP_ALLOWED_STATES: ClientRoutingState[] = ['completing_signup'];
const DASHBOARD_ALLOWED_STATES: ClientRoutingState[] = ['registered'];

// Client pages
const ClientPortal = lazy(() => import("@/pages/client/Portal"));
const ClientRegistration = lazy(() => import("@/pages/client/RegistrationWrapper"));
const CompleteForm = lazy(() => import("@/pages/client/CompleteForm"));
const SignupForms = lazy(() => import("@/pages/client/SignupForms"));

const PageLoadingFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
  </div>
);

const ClientPortalApp = () => {
  return (
    <Routes>
      {/* Redirect /client to /client/dashboard */}
      <Route path="/" element={<Navigate to="/client/dashboard" replace />} />
      
      {/* Client registration - for incomplete profiles */}
      <Route path="/registration" element={
        <AppRouter allowedStates={REGISTRATION_ALLOWED_STATES} portalType="client">
          <Suspense fallback={<PageLoadingFallback />}>
            <ClientRegistration />
          </Suspense>
        </AppRouter>
      } />
      
      {/* Client signup forms - for completing registration */}
      <Route path="/signup-forms" element={
        <AppRouter allowedStates={SIGNUP_ALLOWED_STATES} portalType="client">
          <Suspense fallback={<PageLoadingFallback />}>
            <SignupForms />
          </Suspense>
        </AppRouter>
      } />
      
      {/* Main client dashboard */}
      <Route path="/dashboard" element={
        <AppRouter allowedStates={DASHBOARD_ALLOWED_STATES} portalType="client">
          <ClientLayout>
            <Suspense fallback={<PageLoadingFallback />}>
              <ClientPortal />
            </Suspense>
          </ClientLayout>
        </AppRouter>
      } />
      
      {/* Form completion */}
      <Route path="/complete-form/:assignmentId" element={
        <AppRouter allowedStates={DASHBOARD_ALLOWED_STATES} portalType="client">
          <ClientLayout>
            <Suspense fallback={<PageLoadingFallback />}>
              <CompleteForm />
            </Suspense>
          </ClientLayout>
        </AppRouter>
      } />
    </Routes>
  );
};

export default ClientPortalApp;