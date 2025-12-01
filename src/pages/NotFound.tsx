import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

const NotFound = () => {
  const location = useLocation();
  const { user, userRole } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  // Determine the home route based on user role
  const getHomeRoute = () => {
    if (!user) return "/auth";
    if (userRole === "client") return "/client/dashboard";
    return "/staff/dashboard";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <Link 
          to={getHomeRoute()} 
          className="text-primary underline hover:text-primary/80"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
