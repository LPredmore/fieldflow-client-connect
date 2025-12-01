/**
 * Complete Signup Page
 * 
 * Shown to users who have authenticated but are missing profile data.
 * This prevents blank pages and provides a clear path forward.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, LogOut, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function CompleteSignup() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleContactSupport = () => {
    window.location.href = 'mailto:support@valorwell.org?subject=Account Setup Incomplete';
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
          </div>
          <CardTitle>Account Setup Incomplete</CardTitle>
          <CardDescription>
            Your account was created, but some required information is missing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              We've detected that your account setup didn't complete successfully. This can happen if:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Your invitation link expired</li>
              <li>A technical error occurred during signup</li>
              <li>Required profile data wasn't saved</li>
            </ul>
          </div>

          <div className="pt-4 space-y-3">
            <Button 
              onClick={handleContactSupport} 
              className="w-full"
              variant="default"
            >
              <Mail className="w-4 h-4 mr-2" />
              Contact Support
            </Button>
            
            <Button 
              onClick={handleLogout} 
              className="w-full"
              variant="outline"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>

          <div className="pt-4 text-xs text-center text-muted-foreground">
            Support will help complete your account setup and get you access to the system.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
