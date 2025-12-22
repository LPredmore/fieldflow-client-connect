import { useCallback } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Interface matching actual database column names
export interface TreatmentPlan {
  id: string;
  tenant_id: string;
  client_id: string;
  staff_id: string;
  plan_version: number;
  is_active: boolean;
  supersedes_plan_id: string | null;
  treatmentplan_startdate: string | null;
  planlength: string | null;
  treatmentfrequency: string | null;
  next_treatmentplan_update: string | null;
  problem: string | null;
  treatmentgoal: string | null;
  primaryobjective: string | null;
  secondaryobjective: string | null;
  tertiaryobjective: string | null;
  intervention1: string | null;
  intervention2: string | null;
  intervention3: string | null;
  intervention4: string | null;
  intervention5: string | null;
  intervention6: string | null;
  plan_narrative: string | null;
  created_by_profile_id: string;
  created_at: string;
  updated_at: string;
}

// Form data interface with readable names (mapped to DB columns on save)
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
}

// Maps form data to database column names
function mapFormToDatabase(formData: TreatmentPlanFormData) {
  return {
    treatmentplan_startdate: formData.start_date,
    planlength: formData.plan_length,
    treatmentfrequency: formData.treatment_frequency,
    next_treatmentplan_update: formData.next_update_date || null,
    problem: formData.problem_narrative,
    treatmentgoal: formData.treatment_goal,
    primaryobjective: formData.primary_objective,
    secondaryobjective: formData.secondary_objective || null,
    tertiaryobjective: formData.tertiary_objective || null,
    intervention1: formData.intervention_1,
    intervention2: formData.intervention_2,
    intervention3: formData.intervention_3 || null,
    intervention4: formData.intervention_4 || null,
    intervention5: formData.intervention_5 || null,
    intervention6: formData.intervention_6 || null,
  };
}

export function useTreatmentPlans(clientId: string | undefined) {
  const { user, tenantId } = useAuth();
  const staffId = user?.staffAttributes?.staffData?.id;
  const profileId = user?.id;

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
    if (!clientId || !tenantId || !staffId || !profileId) {
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

      // Map form data to database columns
      const dbData = mapFormToDatabase(formData);

      // Insert the new plan
      const { data, error } = await supabase
        .from('client_treatment_plans')
        .insert({
          tenant_id: tenantId,
          client_id: clientId,
          staff_id: staffId,
          created_by_profile_id: profileId, // Required field!
          plan_version: nextVersion,
          is_active: true,
          supersedes_plan_id: activePlan?.id || null,
          ...dbData,
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
  }, [clientId, tenantId, staffId, profileId, activePlan, plans, refetch]);

  // Update an existing treatment plan
  const updatePlan = useCallback(async (planId: string, formData: Partial<TreatmentPlanFormData>) => {
    try {
      // Map form data to database columns
      const dbData: Record<string, unknown> = {};
      
      if (formData.start_date !== undefined) dbData.treatmentplan_startdate = formData.start_date;
      if (formData.plan_length !== undefined) dbData.planlength = formData.plan_length;
      if (formData.treatment_frequency !== undefined) dbData.treatmentfrequency = formData.treatment_frequency;
      if (formData.next_update_date !== undefined) dbData.next_treatmentplan_update = formData.next_update_date || null;
      if (formData.problem_narrative !== undefined) dbData.problem = formData.problem_narrative;
      if (formData.treatment_goal !== undefined) dbData.treatmentgoal = formData.treatment_goal;
      if (formData.primary_objective !== undefined) dbData.primaryobjective = formData.primary_objective;
      if (formData.secondary_objective !== undefined) dbData.secondaryobjective = formData.secondary_objective || null;
      if (formData.tertiary_objective !== undefined) dbData.tertiaryobjective = formData.tertiary_objective || null;
      if (formData.intervention_1 !== undefined) dbData.intervention1 = formData.intervention_1;
      if (formData.intervention_2 !== undefined) dbData.intervention2 = formData.intervention_2;
      if (formData.intervention_3 !== undefined) dbData.intervention3 = formData.intervention_3 || null;
      if (formData.intervention_4 !== undefined) dbData.intervention4 = formData.intervention_4 || null;
      if (formData.intervention_5 !== undefined) dbData.intervention5 = formData.intervention_5 || null;
      if (formData.intervention_6 !== undefined) dbData.intervention6 = formData.intervention_6 || null;

      const { data, error } = await supabase
        .from('client_treatment_plans')
        .update(dbData)
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
