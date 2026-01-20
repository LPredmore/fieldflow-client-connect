import { useEffect, useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFormSubmission } from './hooks/useFormSubmission';
import { DynamicForm } from './DynamicForm/DynamicForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FormTemplate, FormField } from './types';
import { performanceMonitor } from '@/utils/performanceMonitor';

interface DynamicRegistrationProps {
  template?: FormTemplate | null;
  fields?: FormField[];
  onComplete?: () => void | Promise<void>;
  onBack?: () => void;
  showProgress?: boolean;
}

function DynamicRegistration({ template, fields = [], onComplete, onBack, showProgress = true }: DynamicRegistrationProps = {}) {
  // Track performance in development
  useEffect(() => {
    performanceMonitor.trackComponentMount('DynamicRegistration');
    return () => performanceMonitor.trackComponentUnmount('DynamicRegistration');
  }, []);
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const { submitForm } = useFormSubmission();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(true);

  // Get customer ID from authenticated user
  useEffect(() => {
    const fetchCustomerId = async () => {
      if (!user) {
        setLoadingCustomer(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id')
          .eq('client_user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching customer:', error);
        } else if (data) {
          setCustomerId(data.id);
        }
      } catch (err) {
        console.error('Exception fetching customer:', err);
      } finally {
        setLoadingCustomer(false);
      }
    };

    fetchCustomerId();
  }, [user]);

  const handleSubmit = async (data: Record<string, any>) => {
    if (!template?.id || !customerId) {
      console.error('Missing template ID or customer ID');
      return;
    }

    const success = await submitForm(template.id, data, customerId);

    if (success) {
      // Call onComplete callback if provided
      if (onComplete) {
        await onComplete();
      } else {
        // Default: Navigate to client dashboard
        navigate('/client/dashboard');
      }
    }
  };

  // Show loading state while fetching customer data
  if (loadingCustomer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading registration form...</p>
        </div>
      </div>
    );
  }

  // If no custom form is active, show message (or fallback to original)
  if (!template || !template.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Registration Unavailable</CardTitle>
            <CardDescription>
              No registration form is currently available. Please contact support.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <Card className="shadow-xl border-border/50">
      <CardHeader className="space-y-1 pb-6">
        <CardTitle className="text-3xl font-bold tracking-tight">
          Additional Questions
        </CardTitle>
        {template.description && (
          <CardDescription className="text-base">{template.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <DynamicForm
          template={template}
          fields={fields}
          onSubmit={handleSubmit}
          submitButtonText="Continue"
          onBack={onBack}
        />
      </CardContent>
    </Card>
  );
}

// Memoize with custom comparison to only re-render when template or fields actually change
export default memo(DynamicRegistration, (prevProps, nextProps) => {
  return (
    prevProps.template?.id === nextProps.template?.id &&
    prevProps.fields?.length === nextProps.fields?.length &&
    prevProps.onComplete === nextProps.onComplete &&
    prevProps.onBack === nextProps.onBack &&
    prevProps.showProgress === nextProps.showProgress
  );
});
