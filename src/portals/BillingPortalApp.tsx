import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AppRouter } from "@/components/AppRouter";
import { Layout } from "@/components/Layout/Layout";

const BillingDashboard = lazy(() => import("@/pages/billing/Dashboard"));
const EligibilityCheck = lazy(() => import("@/pages/billing/EligibilityCheck"));
const Claims = lazy(() => import("@/pages/billing/Claims"));
const Remittances = lazy(() => import("@/pages/billing/Remittances"));

const PageLoadingFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
  </div>
);

const BillingPortalApp = () => {
  return (
    <Routes>
      <Route path="/*" element={
        <AppRouter 
          allowedStates={['staff', 'admin']} 
          portalType="billing"
          requiredPermissions={['access_invoicing']}
        >
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/billing/dashboard" replace />} />
              
              <Route path="/dashboard" element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <BillingDashboard />
                </Suspense>
              } />
              
              <Route path="/eligibility" element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <EligibilityCheck />
                </Suspense>
              } />
              
              <Route path="/claims" element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <Claims />
                </Suspense>
              } />
              
              <Route path="/remittances" element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <Remittances />
                </Suspense>
              } />
            </Routes>
          </Layout>
        </AppRouter>
      } />
    </Routes>
  );
};

export default BillingPortalApp;
