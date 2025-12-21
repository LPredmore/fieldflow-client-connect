import { useCallback } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface TreatmentPlan {
  id: string;
  tenant_id: string;
  client_id: string;
  staff_id: string;
  plan_version: number;
  is_active: boolean;
  start_date: string;
  plan_length: string | null;
  treatment_frequency: string | null;
  next_update_date: string | null;
  problem_narrative: string | null;
  treatment_goal: string | null;
  primary_objective: string | null;
  secondary_objective: string | null;
  tertiary_objective: string | null;
  intervention_1: string | null;
  intervention_2: string | null;
  intervention_3: string | null;
  intervention_4: string | null;
  intervention_5: string | null;
  intervention_6: string | null;
  private_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TreatmentPlanFormData {
  start_date: string;
  plan_length: string;
  treatment_frequency: string;
  next_update_date?: string;
  problem_narrative: string;
  treatment_goal: string;
  primary_objective: string;
  secondary_objective?: string;
  tertiary_objective?: string;
  intervention_1: string;
  intervention_2: string;
  intervention_3?: string;
  intervention_4?: string;
  intervention_5?: string;
  intervention_6?: string;
  private_notes?: string;
}

export function useTreatmentPlans(clientId: string | undefined) {
  const { user, tenantId } = useAuth();
  const staffId = user?.staffAttributes?.staffData?.id;

  const {
    data: plans,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<TreatmentPlan>({
    table: 'client_treatment_plans',
    select: '*',
    filters: {
      tenant_id: 'auto',
      client_id: clientId,
    },
    orderBy: { column: 'plan_version', ascending: false },
    enabled: !!clientId && !!tenantId,
  });

  // Get the active treatment plan
  const activePlan = plans?.find(p => p.is_active) || null;

  // Create a new treatment plan
  const createPlan = useCallback(async (formData: TreatmentPlanFormData) => {
    if (!clientId || !tenantId || !staffId) {
      toast({
        title: "Error",
        description: "Missing required data. Please try again.",
        variant: "destructive",
      });
      return { data: null, error: new Error("Missing required data") };
    }

    try {
      // First, deactivate any existing active plans
      if (activePlan) {
        await supabase
          .from('client_treatment_plans')
          .update({ is_active: false })
          .eq('client_id', clientId)
          .eq('is_active', true);
      }

      // Get the next plan version
      const nextVersion = (plans?.length || 0) + 1;

      // Insert the new plan
      const { data, error } = await supabase
        .from('client_treatment_plans')
        .insert({
          tenant_id: tenantId,
          client_id: clientId,
          staff_id: staffId,
          plan_version: nextVersion,
          is_active: true,
          ...formData,
        })
        .select()
        .single();

      if (error) throw error;

      await refetch();

      toast({
        title: "Success",
        description: "Treatment plan created successfully",
      });

      return { data, error: null };
    } catch (err) {
      console.error('Error creating treatment plan:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create treatment plan",
        variant: "destructive",
      });
      return { data: null, error: err };
    }
  }, [clientId, tenantId, staffId, activePlan, plans, refetch]);

  // Update an existing treatment plan
  const updatePlan = useCallback(async (planId: string, formData: Partial<TreatmentPlanFormData>) => {
    try {
      const { data, error } = await supabase
        .from('client_treatment_plans')
        .update(formData)
        .eq('id', planId)
        .select()
        .single();

      if (error) throw error;

      await refetch();

      toast({
        title: "Success",
        description: "Treatment plan updated successfully",
      });

      return { data, error: null };
    } catch (err) {
      console.error('Error updating treatment plan:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update treatment plan",
        variant: "destructive",
      });
      return { data: null, error: err };
    }
  }, [refetch]);

  // Deactivate a treatment plan
  const deactivatePlan = useCallback(async (planId: string) => {
    try {
      const { error } = await supabase
        .from('client_treatment_plans')
        .update({ is_active: false })
        .eq('id', planId);

      if (error) throw error;

      await refetch();

      toast({
        title: "Success",
        description: "Treatment plan deactivated",
      });

      return { error: null };
    } catch (err) {
      console.error('Error deactivating treatment plan:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to deactivate treatment plan",
        variant: "destructive",
      });
      return { error: err };
    }
  }, [refetch]);

  return {
    plans: plans || [],
    activePlan,
    loading,
    error,
    createPlan,
    updatePlan,
    deactivatePlan,
    refetch,
  };
}
