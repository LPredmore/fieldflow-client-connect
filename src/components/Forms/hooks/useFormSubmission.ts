import { useCallback } from 'react';
import { useSupabaseInsert } from '@/hooks/data/useSupabaseMutation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface UseFormSubmissionReturn {
  loading: boolean;
  error: string | null;
  success: boolean;
  submitForm: (
    templateId: string,
    responseData: Record<string, any>,
    customerId?: string
  ) => Promise<boolean>;
}

export function useFormSubmission(): UseFormSubmissionReturn {
  const { user } = useAuth();
  const { toast } = useToast();

  // Use generic insert hook for form responses
  const {
    mutate: createResponse,
    loading,
    error,
  } = useSupabaseInsert<{
    form_template_id: string;
    response_data: Record<string, any>;
    customer_id?: string;
    submitted_at: string;
  }>({
    table: 'form_responses',
    successMessage: 'Form submitted successfully',
    userIdColumn: 'submitted_by_user_id', // form_responses uses submitted_by_user_id instead of created_by_user_id
    skipTenantId: true, // form_responses doesn't have tenant_id column
    onError: (error) => {
      console.error('Error submitting form:', error);
    },
  });

  const submitForm = useCallback(async (
    templateId: string,
    responseData: Record<string, any>,
    customerId?: string
  ): Promise<boolean> => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in to submit forms',
      });
      return false;
    }

    try {
      const result = await createResponse({
        form_template_id: templateId,
        response_data: responseData,
        customer_id: customerId,
        submitted_at: new Date().toISOString(),
      });

      return !result.error;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to submit form';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
      console.error('Error submitting form:', err);
      return false;
    }
  }, [user, createResponse, toast]);

  return {
    loading,
    error,
    success: false, // Could be derived from successful submission
    submitForm,
  };
}
