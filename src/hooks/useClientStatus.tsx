import { useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useSupabaseUpdate } from '@/hooks/data/useSupabaseMutation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export type ClientStatus = 'new' | 'completing_signup' | 'registered';

interface ClientStatusData {
  id: string;
  status: ClientStatus;
}

// Cache to prevent duplicate requests
const requestCache = new Map<string, Promise<any>>();

export function useClientStatus() {
  const { user } = useAuth();

  // Query client status from customers table with caching
  const {
    data: statusArray,
    loading: queryLoading,
    error: queryError,
    refetch,
  } = useSupabaseQuery<ClientStatusData>({
    table: 'customers',
    select: 'id, status',
    filters: {
      client_user_id: user?.id,
    },
    enabled: !!user,
    // Add stale time to prevent excessive refetching
    staleTime: 30000, // 30 seconds
    onError: (error) => {
      console.error('Error fetching client status:', error);
    },
  });

  // Extract status and customer ID
  const { status, customerId } = useMemo(() => {
    if (statusArray?.length > 0) {
      const data = statusArray[0];
      return {
        status: data.status,
        customerId: data.id,
      };
    }
    return {
      status: null,
      customerId: null,
    };
  }, [statusArray]);

  // Update status mutation
  const {
    mutate: updateStatusMutation,
    loading: updateLoading,
    error: updateError,
  } = useSupabaseUpdate<{ status: ClientStatus }>({
    table: 'customers',
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      console.error('Error updating client status:', error);
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateStatus = async (newStatus: ClientStatus) => {
    if (!customerId) {
      console.error('No customer ID available');
      return false;
    }

    const result = await updateStatusMutation({
      id: customerId,
      status: newStatus,
    });

    return !result.error;
  };

  return {
    status,
    customerId,
    loading: queryLoading || updateLoading,
    error: queryError || updateError,
    updateStatus,
    refetch,
  };
}
