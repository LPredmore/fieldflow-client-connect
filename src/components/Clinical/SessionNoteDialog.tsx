import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Form } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { StaffAppointment } from '@/hooks/useStaffAppointments';
import { TreatmentPlan } from '@/hooks/useTreatmentPlans';
import { useClientDiagnoses } from '@/hooks/useClientDiagnoses';
import { useSessionNote, SessionNoteFormData } from '@/hooks/useSessionNote';
import { useAppointmentPrivateNote } from '@/hooks/useAppointmentPrivateNote';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useEnabledCptCodes, EnabledCptCode } from '@/hooks/useEnabledCptCodes';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FileText } from 'lucide-react';

// Import section components
import {
  ClientInfoSection,
  MentalStatusSection,
  TreatmentObjectivesSection,
  SessionAssessmentSection,
  PHQ9Section,
  PlanSection,
} from './SessionNote';
import { BillingSection } from './SessionNote/BillingSection';

const sessionNoteSchema = z.object({
  // Mental Status Exam
  client_appearance: z.string().min(1, 'Required'),
  client_attitude: z.string().min(1, 'Required'),
  client_behavior: z.string().min(1, 'Required'),
  client_speech: z.string().min(1, 'Required'),
  client_affect: z.string().min(1, 'Required'),
  client_mood: z.string().min(1, 'Required'),
  client_thoughtprocess: z.string().min(1, 'Required'),
  client_perception: z.string().min(1, 'Required'),
  client_orientation: z.string().min(1, 'Required'),
  client_memoryconcentration: z.string().min(1, 'Required'),
  client_insightjudgement: z.string().min(1, 'Required'),
  // Risk Assessment
  client_substanceabuserisk: z.enum(['none', 'low', 'medium', 'high']),
  client_suicidalideation: z.enum(['none', 'passive', 'active']),
  client_homicidalideation: z.enum(['none', 'passive', 'active']),
  // Session Content
  client_personsinattendance: z.string().optional().default(''),
  client_medications: z.string().optional().default(''),
  client_currentsymptoms: z.string().optional().default(''),
  client_sessionnarrative: z.string().min(1, 'Session narrative is required'),
  client_functioning: z.string().optional().default(''),
  client_prognosis: z.string().optional().default(''),
  client_progress: z.string().optional().default(''),
  // Private note is saved separately
  private_note: z.string().optional().default(''),
  // Billing fields
  cpt_code_id: z.string().min(1, 'CPT Code is required'),
  units: z.number().min(1, 'At least 1 unit required').default(1),
});

type SessionNoteFormValues = z.infer<typeof sessionNoteSchema>;

interface SessionNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: StaffAppointment | null;
  activePlan: TreatmentPlan;
  staffId: string;
  onSuccess?: () => void;
}

export function SessionNoteDialog({
  open,
  onOpenChange,
  appointment,
  activePlan,
  staffId,
  onSuccess,
}: SessionNoteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [isAiAssistMode, setIsAiAssistMode] = useState(false);
  const [selectedCptCode, setSelectedCptCode] = useState<EnabledCptCode | null>(null);
  const { toast } = useToast();

  // Toggle AI Assist mode
  const toggleAiAssistMode = () => {
    if (isAiAssistMode) {
      // Exiting AI Assist mode - clear selections
      setSelectedInterventions([]);
    }
    setIsAiAssistMode(!isAiAssistMode);
  };
  
  const { diagnosisCodes, formattedDiagnoses, loading: diagnosesLoading } = useClientDiagnoses(appointment?.client_id);
  const { createSessionNote } = useSessionNote(appointment?.id);
  const { savePrivateNote } = useAppointmentPrivateNote(appointment?.id);
  const { enabledCptCodes, loading: cptCodesLoading } = useEnabledCptCodes();

  // Fetch most recent clinical note for this client (for auto-populating dropdowns)
  const { data: previousNotes } = useSupabaseQuery<{
    client_appearance: string | null;
    client_attitude: string | null;
    client_behavior: string | null;
    client_speech: string | null;
    client_affect: string | null;
    client_thoughtprocess: string | null;
    client_perception: string | null;
    client_orientation: string | null;
    client_memoryconcentration: string | null;
    client_insightjudgement: string | null;
    client_substanceabuserisk: string | null;
    client_suicidalideation: string | null;
    client_homicidalideation: string | null;
    client_functioning: string | null;
    client_prognosis: string | null;
    client_progress: string | null;
  }>({
    table: 'appointment_clinical_notes',
    select: 'client_appearance, client_attitude, client_behavior, client_speech, client_affect, client_thoughtprocess, client_perception, client_orientation, client_memoryconcentration, client_insightjudgement, client_substanceabuserisk, client_suicidalideation, client_homicidalideation, client_functioning, client_prognosis, client_progress',
    filters: {
      tenant_id: 'auto',
      client_id: appointment?.client_id,
    },
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!appointment?.client_id,
  });

  const previousNote = previousNotes?.[0] || null;

  // Fetch most recent PHQ-9 for this client
  const { data: phq9Records, loading: phq9Loading } = useSupabaseQuery<{
    id: string;
    total_score: number;
    severity: string;
    ai_narrative: string | null;
    administered_at: string;
  }>({
    table: 'client_phq9_assessments',
    select: 'id, total_score, severity, ai_narrative, administered_at',
    filters: {
      tenant_id: 'auto',
      client_id: appointment?.client_id,
    },
    orderBy: { column: 'administered_at', ascending: false },
    enabled: !!appointment?.client_id,
  });

  const recentPhq9 = phq9Records?.[0] || null;

  const form = useForm<SessionNoteFormValues>({
    resolver: zodResolver(sessionNoteSchema),
    defaultValues: {
      client_appearance: '',
      client_attitude: '',
      client_behavior: '',
      client_speech: '',
      client_affect: '',
      client_mood: '',
      client_thoughtprocess: '',
      client_perception: '',
      client_orientation: '',
      client_memoryconcentration: '',
      client_insightjudgement: '',
      client_substanceabuserisk: 'none',
      client_suicidalideation: 'none',
      client_homicidalideation: 'none',
      client_personsinattendance: '',
      client_medications: '',
      client_currentsymptoms: '',
      client_sessionnarrative: '',
      client_functioning: '',
      client_prognosis: '',
      client_progress: '',
      private_note: '',
      cpt_code_id: '',
      units: 1,
    },
  });

  // Reset form and auto-populate dropdowns when dialog opens
  useEffect(() => {
    if (open) {
      form.reset();
      setSelectedInterventions([]);
      setIsAiAssistMode(false);
      setSelectedCptCode(null);

      // Auto-populate dropdown fields from most recent note
      if (previousNote) {
        const dropdownFields = [
          'client_appearance', 'client_attitude', 'client_behavior',
          'client_speech', 'client_affect', 'client_thoughtprocess',
          'client_perception', 'client_orientation', 'client_memoryconcentration',
          'client_insightjudgement', 'client_functioning', 'client_prognosis', 'client_progress',
        ] as const;

        dropdownFields.forEach((field) => {
          const value = previousNote[field];
          if (value) {
            form.setValue(field, value);
          }
        });

        // Risk enum fields
        if (previousNote.client_substanceabuserisk) {
          form.setValue('client_substanceabuserisk', previousNote.client_substanceabuserisk as any);
        }
        if (previousNote.client_suicidalideation) {
          form.setValue('client_suicidalideation', previousNote.client_suicidalideation as any);
        }
        if (previousNote.client_homicidalideation) {
          form.setValue('client_homicidalideation', previousNote.client_homicidalideation as any);
        }
      }
    }
  }, [open, form, previousNote]);

  // AI Assist handler - requires interventions selected
  const handleAiAssist = async () => {
    const currentSymptoms = form.getValues('client_currentsymptoms');
    const sessionNarrative = form.getValues('client_sessionnarrative');
    
    // Validate: need session notes
    if (!sessionNarrative?.trim()) {
      toast({
        title: "Missing Information",
        description: "Please add session notes before using AI Assist",
        variant: "destructive",
      });
      return;
    }
    
    // Validate: need at least 1 intervention selected
    if (selectedInterventions.length === 0) {
      toast({
        title: "Missing Interventions",
        description: "Please select at least one intervention used in this session",
        variant: "destructive",
      });
      return;
    }
    
    setIsGeneratingNote(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-clinical-note', {
        body: {
          currentSymptoms,
          sessionNarrative,
          selectedInterventions,
        }
      });
      
      if (error) {
        console.error('AI Assist error:', error);
        throw error;
      }
      
      if (data?.generatedNarrative) {
        form.setValue('client_sessionnarrative', data.generatedNarrative);
        // Exit AI Assist mode and clear selections after successful generation
setIsAiAssistMode(false);
        toast({
          title: "Note Generated",
          description: "AI-generated clinical narrative applied. Please review before saving.",
        });
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('AI Assist error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate clinical note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingNote(false);
    }
  };

  const onSubmit = async (data: SessionNoteFormValues) => {
    if (!appointment) return;

    setIsSubmitting(true);
    try {
      // Extract fields that go to separate tables or aren't part of clinical note
      const { private_note, client_currentsymptoms, cpt_code_id, units, ...clinicalData } = data;
      
      // Calculate charge based on selected CPT code and units
      const chargeAmount = selectedCptCode?.custom_rate != null 
        ? units * selectedCptCode.custom_rate 
        : 0;
      
      // Build billing data
      const billingData = selectedCptCode ? {
        procCode: selectedCptCode.code,
        units: units,
        chargeAmount: chargeAmount,
      } : undefined;
      
      const result = await createSessionNote(
        appointment.id,
        appointment.client_id,
        staffId,
        diagnosisCodes,
        activePlan,
        clinicalData as SessionNoteFormData,
        billingData
      );

      if (!result.error) {
        // Save private note to separate table if provided
        if (private_note && private_note.trim()) {
          await savePrivateNote(private_note);
        }
        
        onOpenChange(false);
        onSuccess?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!appointment) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Session Note
          </SheetTitle>
          <SheetDescription>
            {appointment.client_name} • {appointment.display_date} at {appointment.display_time}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
              
              {/* 1. Client Information Section */}
              <ClientInfoSection
                form={form}
                appointment={appointment}
                diagnosisCodes={diagnosisCodes}
                formattedDiagnoses={formattedDiagnoses}
                diagnosesLoading={diagnosesLoading}
              />

              {/* 2. Treatment Objectives Section (with intervention selection) */}
              <TreatmentObjectivesSection 
                activePlan={activePlan}
                selectedInterventions={selectedInterventions}
                onInterventionChange={setSelectedInterventions}
                selectionEnabled={true}
                isAiAssistMode={isAiAssistMode}
              />

              <Separator />

              {/* 3. Mental Status Examination */}
              <MentalStatusSection form={form} />

              <Separator />

              {/* 4. Session Assessment with AI Assist */}
              <SessionAssessmentSection 
                form={form}
                onAiAssist={handleAiAssist}
                isGeneratingNote={isGeneratingNote}
                isAiAssistMode={isAiAssistMode}
                toggleAiAssistMode={toggleAiAssistMode}
                selectedInterventions={selectedInterventions}
              />

              <Separator />

              {/* 5. PHQ-9 Assessment */}
              <PHQ9Section 
                phq9Data={recentPhq9} 
                loading={phq9Loading} 
              />

              <Separator />

              {/* 6. Plan & Private Notes */}
              <PlanSection 
                form={form} 
                activePlan={activePlan} 
              />

              <Separator />

              {/* 7. Billing Information */}
              <BillingSection
                form={form}
                enabledCptCodes={enabledCptCodes}
                loading={cptCodesLoading}
                selectedCptCode={selectedCptCode}
                onCptCodeChange={setSelectedCptCode}
              />

              {/* Submit Button */}
              <div className="sticky bottom-0 bg-background pt-4 pb-2 border-t">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Session Note'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
