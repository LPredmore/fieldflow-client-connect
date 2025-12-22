import { useCallback } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { TreatmentPlan } from '@/hooks/useTreatmentPlans';

export interface SessionNote {
  id: string;
  tenant_id: string;
  appointment_id: string;
  client_id: string;
  staff_id: string;
  client_diagnosis: string[];
  // Treatment plan snapshot
  client_treatmentplan_startdate: string | null;
  client_planlength: string | null;
  client_treatmentfrequency: string | null;
  client_nexttreatmentplanupdate: string | null;
  client_problem: string | null;
  client_treatmentgoal: string | null;
  client_primaryobjective: string | null;
  client_secondaryobjective: string | null;
  client_tertiaryobjective: string | null;
  client_intervention1: string | null;
  client_intervention2: string | null;
  client_intervention3: string | null;
  client_intervention4: string | null;
  client_intervention5: string | null;
  client_intervention6: string | null;
  // Mental Status Exam
  client_appearance: string | null;
  client_attitude: string | null;
  client_behavior: string | null;
  client_speech: string | null;
  client_affect: string | null;
  client_mood: string | null;
  client_thoughtprocess: string | null;
  client_perception: string | null;
  client_orientation: string | null;
  client_memoryconcentration: string | null;
  client_insightjudgement: string | null;
  // Risk Assessment
  client_substanceabuserisk: 'none' | 'low' | 'medium' | 'high' | null;
  client_suicidalideation: 'none' | 'passive' | 'active' | null;
  client_homicidalideation: 'none' | 'passive' | 'active' | null;
  // Session Content
  client_personsinattendance: string | null;
  client_medications: string | null;
  client_sessionnarrative: string | null;
  client_functioning: string | null;
  client_prognosis: string | null;
  client_progress: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionNoteFormData {
  // Mental Status Exam
  client_appearance: string;
  client_attitude: string;
  client_behavior: string;
  client_speech: string;
  client_affect: string;
  client_mood: string;
  client_thoughtprocess: string;
  client_perception: string;
  client_orientation: string;
  client_memoryconcentration: string;
  client_insightjudgement: string;
  // Risk Assessment
  client_substanceabuserisk: 'none' | 'low' | 'medium' | 'high';
  client_suicidalideation: 'none' | 'passive' | 'active';
  client_homicidalideation: 'none' | 'passive' | 'active';
  // Session Content
  client_personsinattendance: string;
  client_medications: string;
  client_sessionnarrative: string;
  client_functioning: string;
  client_prognosis: string;
  client_progress: string;
}

export function useSessionNote(appointmentId: string | undefined) {
  const { tenantId } = useAuth();

  const {
    data: notes,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<SessionNote>({
    table: 'appointment_clinical_notes',
    select: '*',
    filters: {
      tenant_id: 'auto',
      appointment_id: appointmentId,
    },
    enabled: !!appointmentId && !!tenantId,
  });

  const existingNote = notes?.[0] || null;

  const createSessionNote = useCallback(async (
    appointmentId: string,
    clientId: string,
    staffId: string,
    diagnosisCodes: string[],
    activePlan: TreatmentPlan,
    formData: SessionNoteFormData
  ) => {
    if (!tenantId) {
      toast({
        title: "Error",
        description: "Missing tenant information.",
        variant: "destructive",
      });
      return { data: null, error: new Error("Missing tenant") };
    }

    try {
      // Build the session note with treatment plan snapshot
      // Map from TreatmentPlan (DB column names) to appointment_clinical_notes columns
      const sessionNoteData = {
        tenant_id: tenantId,
        appointment_id: appointmentId,
        client_id: clientId,
        staff_id: staffId,
        client_diagnosis: diagnosisCodes,
        // Treatment plan snapshot - map from TreatmentPlan DB columns
        client_treatmentplan_startdate: activePlan.treatmentplan_startdate,
        client_planlength: activePlan.planlength,
        client_treatmentfrequency: activePlan.treatmentfrequency,
        client_nexttreatmentplanupdate: activePlan.next_treatmentplan_update,
        client_problem: activePlan.problem,
        client_treatmentgoal: activePlan.treatmentgoal,
        client_primaryobjective: activePlan.primaryobjective,
        client_secondaryobjective: activePlan.secondaryobjective,
        client_tertiaryobjective: activePlan.tertiaryobjective,
        client_intervention1: activePlan.intervention1,
        client_intervention2: activePlan.intervention2,
        client_intervention3: activePlan.intervention3,
        client_intervention4: activePlan.intervention4,
        client_intervention5: activePlan.intervention5,
        client_intervention6: activePlan.intervention6,
        // Form data (MSE, Risk Assessment, Session Content)
        ...formData,
      };

      // Insert session note
      const { data, error: insertError } = await supabase
        .from('appointment_clinical_notes')
        .insert(sessionNoteData)
        .select()
        .single();

      if (insertError) throw insertError;

      // Update appointment status to documented
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'documented' })
        .eq('id', appointmentId);

      if (updateError) throw updateError;

      await refetch();

      toast({
        title: "Success",
        description: "Session note saved successfully",
      });

      return { data, error: null };
    } catch (err) {
      console.error('Error creating session note:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save session note",
        variant: "destructive",
      });
      return { data: null, error: err };
    }
  }, [tenantId, refetch]);

  const updateSessionNote = useCallback(async (
    noteId: string,
    formData: Partial<SessionNoteFormData>
  ) => {
    try {
      const { data, error } = await supabase
        .from('appointment_clinical_notes')
        .update(formData)
        .eq('id', noteId)
        .select()
        .single();

      if (error) throw error;

      await refetch();

      toast({
        title: "Success",
        description: "Session note updated successfully",
      });

      return { data, error: null };
    } catch (err) {
      console.error('Error updating session note:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update session note",
        variant: "destructive",
      });
      return { data: null, error: err };
    }
  }, [refetch]);

  return {
    existingNote,
    loading,
    error,
    createSessionNote,
    updateSessionNote,
    refetch,
  };
}
