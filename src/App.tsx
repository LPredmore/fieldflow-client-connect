import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ResetPasswordRedirect from "./pages/ResetPasswordRedirect";
// OLD AuthProvider DISABLED - Using new unified system
// import { AuthProvider } from "@/hooks/useAuth";
import { AuthenticationProvider } from "@/providers/AuthenticationProvider";
import { UnifiedRoutingGuard } from "@/components/routing/UnifiedRoutingGuard";
import { BrandColorProvider } from "@/components/BrandColorProvider";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazy, Suspense } from "react";

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

const App = () => {

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
                    <UnifiedRoutingGuard>
                        <Routes>
                          {/* Public routes */}
                          <Route path="/auth" element={<Auth />} />
                          <Route path="/reset-password" element={<ResetPasswordRedirect />} />
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