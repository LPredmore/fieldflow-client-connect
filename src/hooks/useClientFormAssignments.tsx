import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface ClientFormAssignment {
  id: string;
  tenant_id: string;
  client_id: string;
  form_template_id: string;
  assigned_by_profile_id: string | null;
  assigned_at: string;
  due_at: string | null;
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
  completed_at: string | null;
  form_response_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  form_template?: {
    id: string;
    name: string;
    description: string | null;
    form_type: string | null;
    is_active: boolean;
  };
  assigned_by?: {
    id: string;
    email: string | null;
  };
}

interface UseClientFormAssignmentsOptions {
  clientId: string | null;
  enabled?: boolean;
}

interface AssignFormData {
  form_template_id: string;
  due_at?: string | null;
  notes?: string | null;
}

export function useClientFormAssignments({ clientId, enabled = true }: UseClientFormAssignmentsOptions) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<ClientFormAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    if (!clientId || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('client_form_assignments')
        .select(`
          *,
          form_template:form_templates(id, name, description, form_type, is_active),
          assigned_by:profiles!assigned_by_profile_id(id, email)
        `)
        .eq('client_id', clientId)
        .order('assigned_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Type assertion since Supabase doesn't know about our new table yet
      setAssignments((data as unknown as ClientFormAssignment[]) || []);
    } catch (err: any) {
      console.error('Error fetching form assignments:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clientId, enabled]);

  const assignForm = useCallback(async (data: AssignFormData): Promise<boolean> => {
    if (!clientId) return false;

    try {
      // Get tenant_id from user context
      const tenantId = user?.staffAttributes?.staffData?.tenant_id;
      if (!tenantId) {
        throw new Error('Unable to determine tenant');
      }

      const { error: insertError } = await supabase
        .from('client_form_assignments')
        .insert({
          tenant_id: tenantId,
          client_id: clientId,
          form_template_id: data.form_template_id,
          assigned_by_profile_id: user?.id,
          due_at: data.due_at || null,
          notes: data.notes || null,
          status: 'pending',
        });

      if (insertError) {
        // Handle unique constraint violation
        if (insertError.code === '23505') {
          toast({
            variant: 'destructive',
            title: 'Already Assigned',
            description: 'This form is already assigned to this client and pending completion.',
          });
          return false;
        }
        throw insertError;
      }

      toast({
        title: 'Form Assigned',
        description: 'The form has been assigned to this client.',
      });

      await fetchAssignments();
      return true;
    } catch (err: any) {
      console.error('Error assigning form:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to assign form',
      });
      return false;
    }
  }, [clientId, user, toast, fetchAssignments]);

  const cancelAssignment = useCallback(async (assignmentId: string): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('client_form_assignments')
        .update({ status: 'cancelled' })
        .eq('id', assignmentId);

      if (updateError) throw updateError;

      toast({
        title: 'Assignment Cancelled',
        description: 'The form assignment has been cancelled.',
      });

      await fetchAssignments();
      return true;
    } catch (err: any) {
      console.error('Error cancelling assignment:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to cancel assignment',
      });
      return false;
    }
  }, [toast, fetchAssignments]);

  // Get pending assignments only
  const pendingAssignments = assignments.filter(a => a.status === 'pending');

  return {
    assignments,
    pendingAssignments,
    loading,
    error,
    fetchAssignments,
    assignForm,
    cancelAssignment,
    refetch: fetchAssignments,
  };
}
