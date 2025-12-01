import { useEffect } from 'react';
import { useClientStatus } from '@/hooks/useClientStatus';
import { useAssignedForms } from '@/hooks/useAssignedForms';
import { SignupFormsList } from '@/components/Client/SignupFormsList';
import ClientLayout from '@/components/Layout/ClientLayout';
import { useNavigate } from 'react-router-dom';

export default function SignupForms() {
  const { customerId, status, loading: statusLoading } = useClientStatus();
  const { assignments, loading: formsLoading } = useAssignedForms(customerId ?? undefined);
  const navigate = useNavigate();

  // Filter for signup forms only
  const signupForms = assignments.filter(
    assignment => assignment.form_template?.form_type === 'signup'
  );

  useEffect(() => {
    // If status is already 'registered', redirect to dashboard
    if (!statusLoading && status === 'registered') {
      navigate('/client/dashboard', { replace: true });
    }
  }, [status, statusLoading, navigate]);

  return (
    <ClientLayout>
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome!</h1>
          <p className="text-muted-foreground">
            Complete the forms below to finish setting up your account
          </p>
        </div>

        <SignupFormsList 
          forms={signupForms} 
          loading={statusLoading || formsLoading} 
        />
      </div>
    </ClientLayout>
  );
}
