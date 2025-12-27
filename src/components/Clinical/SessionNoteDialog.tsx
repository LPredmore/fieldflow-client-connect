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
import { StaffAppointment } from '@/hooks/useStaffAppointments';
import { TreatmentPlan } from '@/hooks/useTreatmentPlans';
import { useClientDiagnoses } from '@/hooks/useClientDiagnoses';
import { useSessionNote, SessionNoteFormData } from '@/hooks/useSessionNote';
import { useAppointmentPrivateNote } from '@/hooks/useAppointmentPrivateNote';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
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
  
  const { diagnosisCodes, formattedDiagnoses, loading: diagnosesLoading } = useClientDiagnoses(appointment?.client_id);
  const { createSessionNote } = useSessionNote(appointment?.id);
  const { savePrivateNote } = useAppointmentPrivateNote(appointment?.id);

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
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset();
    }
  }, [open, form]);

  const onSubmit = async (data: SessionNoteFormValues) => {
    if (!appointment) return;

    setIsSubmitting(true);
    try {
      // Extract private note from form data (it goes to separate table)
      const { private_note, client_currentsymptoms, ...clinicalData } = data;
      
      // Map client_currentsymptoms to session narrative if needed (or handle separately)
      // For now we'll include it in the clinical data but it won't be saved since column doesn't exist
      const result = await createSessionNote(
        appointment.id,
        appointment.client_id,
        staffId,
        diagnosisCodes,
        activePlan,
        clinicalData as SessionNoteFormData
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

              {/* 2. Treatment Objectives Section (View Only) */}
              <TreatmentObjectivesSection activePlan={activePlan} />

              <Separator />

              {/* 3. Mental Status Examination */}
              <MentalStatusSection form={form} />

              <Separator />

              {/* 4. Session Assessment */}
              <SessionAssessmentSection 
                form={form}
                // AI Assist will be implemented in Phase 2
                // onAiAssist={() => {}}
                // isGeneratingNote={false}
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
