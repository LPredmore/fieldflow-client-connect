import { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StaffRegistrationForm } from '@/components/Staff/StaffRegistrationForm';
import { AppRouter } from '@/components/AppRouter';

// ⚡ PERFORMANCE: Memoize component to prevent unnecessary re-renders
function StaffRegistration() {
  return (
    <AppRouter allowedStates={['needs_onboarding']} portalType="staff">
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader className="text-center space-y-2">
              <CardTitle className="text-3xl">Complete Your Registration</CardTitle>
              <CardDescription className="text-base">
                Welcome! Please complete your professional profile to access the platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StaffRegistrationForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppRouter>
  );
}

export default memo(StaffRegistration);
