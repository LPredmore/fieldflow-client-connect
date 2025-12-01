import { useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useToast } from '@/hooks/use-toast';

interface AssignedForm {
  id: string;
  form_template_id: string;
  customer_id: string;
  due_date: string | null;
  status: 'pending' | 'completed' | 'overdue';
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  form_template: {
    id: string;
    name: string;
    description: string | null;
    form_type: string;
  };
}

export function useAssignedForms(customerId: string | undefined) {
  const { toast } = useToast();

  // Query assigned forms with form template details
  const {
    data: rawAssignments,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<AssignedForm>({
    table: 'form_assignments',
    select: `
      *,
      form_template:form_templates (
        id,
        name,
        description,
        form_type
      )
    `,
    filters: {
      customer_id: customerId,
    },
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!customerId,
    onError: (error) => {
      console.error('Error fetching assignments:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load assigned forms',
      });
    },
  });

  // Process assignments to check for overdue status
  const assignments = useMemo(() => {
    const now = new Date();
    return (rawAssignments || []).map((assignment) => {
      if (
        assignment.status === 'pending' &&
        assignment.due_date &&
        new Date(assignment.due_date) < now
      ) {
        return { ...assignment, status: 'overdue' as const };
      }
      return assignment;
    });
  }, [rawAssignments]);

  // Categorize forms
  const pendingForms = useMemo(() => 
    assignments.filter((a) => a.status === 'pending' || a.status === 'overdue'),
    [assignments]
  );

  const completedForms = useMemo(() => 
    assignments.filter((a) => a.status === 'completed'),
    [assignments]
  );

  // Set up real-time subscription
  useEffect(() => {
    if (!customerId) return;

    const channel = supabase
      .channel('form-assignments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'form_assignments',
          filter: `customer_id=eq.${customerId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId, refetch]);

  return {
    assignments,
    pendingForms,
    completedForms,
    loading,
    error,
    refetch,
  };
}
