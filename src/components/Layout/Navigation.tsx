import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  Menu,
  LogOut,
  Briefcase, 
  Users, 
  FileText, 
  Receipt, 
  Calendar,
  Settings,
  Wrench,
  User,
  DollarSign,
  CheckCircle,
  FileCheck,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { usePermissionChecks } from "@/hooks/permissions/usePermissionChecks";
import { getRoleDisplayName, canAccessSettings, UserRole } from "@/utils/roleUtils";
import { STAFF_NAVIGATION, BILLING_NAVIGATION } from "@/config/navigation";

function NavigationContent() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { signOut, user, userRole, isAdmin } = useAuth();
  const { settings } = useSettings();
  const { 
    canAccessServices, 
    canAccessInvoicing, 
    canAccessForms,
    loading: permissionsLoading 
  } = usePermissionChecks();

  // Detect portal type based on current route
  const portalType = location.pathname.startsWith('/billing') ? 'billing' : 'staff';
  const navigationItems = portalType === 'billing' ? BILLING_NAVIGATION : STAFF_NAVIGATION;

  const handleSignOut = async () => {
    await signOut();
  };

  // Show portal switcher for staff with billing access
  const showPortalSwitcher = userRole === 'staff' && canAccessInvoicing && !permissionsLoading;

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-surface shadow-material-md"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation Sidebar */}
      <nav className={cn(
        "fixed left-0 top-0 z-40 h-full w-64 bg-surface border-r border-border shadow-material-lg transition-transform duration-normal lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-20 items-center justify-start border-b border-border bg-primary px-6 gap-3 py-4">
            {settings?.logo_url && (
              <img 
                src={settings.logo_url} 
                alt="Business Logo" 
                className="h-8 w-8 object-contain"
              />
            )}
            <h1 className="text-xl font-bold text-primary-foreground">
              {!settings && (
                <div className="h-6 w-24 bg-primary-foreground/20 rounded animate-pulse"></div>
              )}
              {settings?.business_name && settings.business_name}
            </h1>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 space-y-1 px-3 py-4">
          {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              // Hide items based on admin requirement
              if ('requireAdmin' in item && item.requireAdmin && !isAdmin) {
                return null;
              }
              
              // Don't hide permission-gated items while permissions are loading
              if (!permissionsLoading) {
                // Hide items based on permission requirements only after loading
                if ('permission' in item && item.permission === 'access_services' && !canAccessServices) {
                  return null;
                }
                
                if ('permission' in item && item.permission === 'access_invoicing' && !canAccessInvoicing) {
                  return null;
                }
                
                if ('permission' in item && item.permission === 'access_forms' && !canAccessForms) {
                  return null;
                }
              }
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-fast hover:bg-accent hover:text-accent-foreground",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-material-sm" 
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* User Section */}
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-sm font-medium text-primary-foreground">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  {userRole ? getRoleDisplayName(userRole as UserRole) : 'Loading...'}
                </p>
              </div>
            </div>
            
            {/* Portal Switcher for staff with billing access */}
            {showPortalSwitcher && (
              <Link
                to={portalType === 'billing' ? '/staff/dashboard' : '/billing/dashboard'}
                className="w-full mb-2 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-accent text-accent-foreground hover:bg-accent/80 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {portalType === 'billing' ? (
                  <>
                    <Home className="h-4 w-4" />
                    Switch to Staff Portal
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4" />
                    Switch to Billing Portal
                  </>
                )}
              </Link>
            )}
            
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}

export default function Navigation() {
  return (
    <PermissionProvider>
      <NavigationContent />
    </PermissionProvider>
  );
}