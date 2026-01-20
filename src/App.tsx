import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// OLD AuthProvider DISABLED - Using new unified system
// import { AuthProvider } from "@/hooks/useAuth";
import { AuthenticationProvider } from "@/providers/AuthenticationProvider";
import { UnifiedRoutingGuard } from "@/components/routing/UnifiedRoutingGuard";
import { BrandColorProvider } from "@/components/BrandColorProvider";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazy, Suspense, useEffect } from "react";
import { initializePolicyMonitoring } from "@/utils/initializePolicyMonitoring";
import { useNavigationCleanup } from "@/hooks/useNavigationCleanup";
// Network resilience system temporarily disabled
// import { 
//   initializeNetworkResilience, 
//   NetworkErrorBoundary, 
//   NetworkStatusBanner 
// } from "@/lib/network";

// Core pages
import Auth from "./pages/Auth";
import CompleteSignup from "./pages/CompleteSignup";
import NotFound from "./pages/NotFound";

// Portal applications
const StaffPortalApp = lazy(() => import("./portals/StaffPortalApp"));


const PageLoadingFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
  </div>
);

const queryClient = new QueryClient();

// Component to handle navigation cleanup inside the router context
const NavigationManager = () => {
  // Set up global navigation cleanup
  useNavigationCleanup({
    cancelPendingRequests: true,
    onNavigate: (previousPath, currentPath) => {
      console.log(`🧭 [App] Global navigation cleanup: ${previousPath} → ${currentPath}`);
      
      // Additional global cleanup logic can be added here
      // For example, clearing temporary state, cancelling background tasks, etc.
    }
  });
  
  return null; // This component doesn't render anything
};

const App = () => {
  // Network resilience system temporarily disabled
  // useEffect(() => {
  //   console.log('🚀 [App] Initializing Network Resilience System');
  //   initializeNetworkResilience();
  // }, []);

  // Initialize policy monitoring only in development if explicitly enabled
  useEffect(() => {
    // Disabled by default for performance - causes 404 errors and ~400ms delay
    // To enable: set VITE_ENABLE_POLICY_MONITORING=true in .env.local
    if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_POLICY_MONITORING === 'true') {
      initializePolicyMonitoring();
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthenticationProvider>
          {/* OLD AuthProvider REMOVED - Using new unified AuthenticationProvider */}
          <PermissionProvider>
            <BrandColorProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <NavigationManager />
                    <UnifiedRoutingGuard>
                        <Routes>
                          {/* Public routes */}
                          <Route path="/auth" element={<Auth />} />
                          <Route path="/complete-signup" element={<CompleteSignup />} />
                          
                          {/* Staff Portal - All staff routes under /staff/* */}
                          <Route path="/staff/*" element={
                            <Suspense fallback={<PageLoadingFallback />}>
                              <StaffPortalApp />
                            </Suspense>
                          } />
                          
                          {/* Root redirect - UnifiedRoutingGuard will handle this */}
                          <Route path="/" element={<div />} />
                          
                          {/* 404 fallback */}
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </UnifiedRoutingGuard>
                    </BrowserRouter>
                </TooltipProvider>
              </BrandColorProvider>
          </PermissionProvider>
          {/* OLD AuthProvider REMOVED - Using new unified AuthenticationProvider */}
        </AuthenticationProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;