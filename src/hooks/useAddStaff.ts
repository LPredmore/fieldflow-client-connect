import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface AddStaffData {
  email: string;
  firstName: string;
  lastName: string;
  specialty?: string;
  roles: string[];
  tenantId: string;
}

interface AddStaffResult {
  success: boolean;
  userId?: string;
  staffId?: string;
  password?: string;
  error?: string;
}

export function useAddStaff() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createStaff = async (data: AddStaffData): Promise<AddStaffResult> => {
    setLoading(true);
    setError(null);

    try {
      const { data: response, error: fnError } = await supabase.functions.invoke(
        'create-staff-account',
        {
          body: {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            specialty: data.specialty,
            roles: data.roles,
            tenantId: data.tenantId,
          },
        }
      );

      if (fnError) {
        const errorMessage = fnError.message || 'Failed to create staff account';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        return { success: false, error: errorMessage };
      }

      if (response?.error) {
        setError(response.error);
        toast({
          title: 'Error',
          description: response.error,
          variant: 'destructive',
        });
        return { success: false, error: response.error };
      }

      // Invalidate relevant queries to refresh staff list
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });

      return {
        success: true,
        userId: response.userId,
        staffId: response.staffId,
        password: response.password,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    createStaff,
    loading,
    error,
  };
}
