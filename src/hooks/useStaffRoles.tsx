import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StaffRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_clinical: boolean;
}

/**
 * Fetches all available staff roles from the staff_roles table.
 * This is global reference data (not tenant-scoped).
 */
export function useStaffRoles() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['staff_roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_roles')
        .select('id, code, name, description, is_clinical')
        .order('name');

      if (error) throw error;
      return data as StaffRole[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - roles rarely change
  });

  return {
    roles: data ?? [],
    loading: isLoading,
    error,
    refetch,
  };
}
