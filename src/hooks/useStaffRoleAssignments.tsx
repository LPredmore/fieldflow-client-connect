import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UseStaffRoleAssignmentsProps {
  staffId: string | null;
}

/**
 * Fetches role assignments for a specific staff member.
 * Returns an array of role codes (e.g., ['CLINICIAN', 'TELEHEALTH']).
 */
export function useStaffRoleAssignments({ staffId }: UseStaffRoleAssignmentsProps) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['staff_role_assignments', staffId],
    queryFn: async () => {
      if (!staffId) return [];

      const { data, error } = await supabase
        .from('staff_role_assignments')
        .select('staff_role_id, staff_roles(code)')
        .eq('staff_id', staffId);

      if (error) throw error;
      
      // Extract role codes from the joined data
      return data?.map((assignment: any) => assignment.staff_roles?.code).filter(Boolean) as string[] || [];
    },
    enabled: !!staffId,
  });

  return {
    assignments: data ?? [],
    loading: isLoading,
    error,
    refetch,
  };
}
