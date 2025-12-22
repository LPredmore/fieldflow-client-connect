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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { StaffAppointment } from '@/hooks/useStaffAppointments';
import { TreatmentPlan } from '@/hooks/useTreatmentPlans';
import { useClientDiagnoses } from '@/hooks/useClientDiagnoses';
import { useSessionNote, SessionNoteFormData } from '@/hooks/useSessionNote';
import { useAppointmentPrivateNote } from '@/hooks/useAppointmentPrivateNote';
import { Loader2, FileText, Brain, AlertTriangle, ClipboardList, Lock } from 'lucide-react';

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
  client_sessionnarrative: z.string().min(1, 'Session narrative is required'),
  client_functioning: z.string().optional().default(''),
  client_prognosis: z.string().optional().default(''),
  client_progress: z.string().optional().default(''),
  // Private note is saved separately
  private_note: z.string().optional().default(''),
});

type SessionNoteFormValues = z.infer<typeof sessionNoteSchema>;

// MSE Options
const MSE_OPTIONS = {
  appearance: ['Well-groomed', 'Casually dressed', 'Disheveled', 'Bizarre', 'Inappropriate for weather'],
  attitude: ['Cooperative', 'Friendly', 'Guarded', 'Hostile', 'Suspicious', 'Withdrawn'],
  behavior: ['Calm', 'Restless', 'Agitated', 'Psychomotor retardation', 'Tremor', 'Tics'],
  speech: ['Normal rate/volume', 'Slow', 'Rapid', 'Pressured', 'Soft', 'Loud', 'Slurred'],
  affect: ['Full range', 'Constricted', 'Blunted', 'Flat', 'Labile', 'Inappropriate'],
  mood: ['Euthymic', 'Depressed', 'Anxious', 'Irritable', 'Euphoric', 'Angry'],
  thoughtProcess: ['Logical', 'Tangential', 'Circumstantial', 'Loose associations', 'Flight of ideas', 'Perseveration'],
  perception: ['No abnormalities', 'Auditory hallucinations', 'Visual hallucinations', 'Illusions', 'Derealization', 'Depersonalization'],
  orientation: ['Oriented x4', 'Oriented x3', 'Oriented x2', 'Oriented x1', 'Disoriented'],
  memoryConcentration: ['Intact', 'Mildly impaired', 'Moderately impaired', 'Severely impaired'],
  insightJudgement: ['Good', 'Fair', 'Limited', 'Poor'],
};

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
      const { private_note, ...clinicalData } = data;
      
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
              {/* Diagnoses (Read-Only) */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Client Diagnoses</CardTitle>
                </CardHeader>
                <CardContent>
                  {diagnosesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading diagnoses...
                    </div>
                  ) : diagnosisCodes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No diagnoses on file</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {formattedDiagnoses.map((diagnosis, idx) => (
                        <Badge key={idx} variant="secondary">
                          {diagnosis}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Treatment Plan Snapshot (Read-Only) */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Treatment Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Start Date</Label>
                      <p className="font-medium">{activePlan.treatmentplan_startdate || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Plan Length</Label>
                      <p className="font-medium">{activePlan.planlength || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Frequency</Label>
                      <p className="font-medium">{activePlan.treatmentfrequency || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Next Update</Label>
                      <p className="font-medium">{activePlan.next_treatmentplan_update || 'N/A'}</p>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground">Problem</Label>
                    <p className="font-medium">{activePlan.problem || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Treatment Goal</Label>
                    <p className="font-medium">{activePlan.treatmentgoal || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Primary Objective</Label>
                    <p className="font-medium">{activePlan.primaryobjective || 'N/A'}</p>
                  </div>
                </CardContent>
              </Card>

              <Separator />

              {/* Mental Status Exam */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Mental Status Exam</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="client_appearance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Appearance</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MSE_OPTIONS.appearance.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="client_attitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Attitude</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MSE_OPTIONS.attitude.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_behavior"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Behavior</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MSE_OPTIONS.behavior.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_speech"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Speech</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MSE_OPTIONS.speech.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_affect"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Affect</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MSE_OPTIONS.affect.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_mood"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mood</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MSE_OPTIONS.mood.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_thoughtprocess"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Thought Process</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MSE_OPTIONS.thoughtProcess.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_perception"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Perception</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MSE_OPTIONS.perception.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_orientation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orientation</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MSE_OPTIONS.orientation.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_memoryconcentration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Memory/Concentration</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MSE_OPTIONS.memoryConcentration.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_insightjudgement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insight/Judgement</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MSE_OPTIONS.insightJudgement.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Risk Assessment */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Risk Assessment</h3>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="client_substanceabuserisk"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Substance Abuse Risk</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_suicidalideation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Suicidal Ideation</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="passive">Passive</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_homicidalideation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Homicidal Ideation</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="passive">Passive</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Session Content */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Session Content</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="client_personsinattendance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Persons in Attendance</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Client only" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_medications"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Medications</FormLabel>
                        <FormControl>
                          <Input placeholder="List medications..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="client_sessionnarrative"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Session Narrative *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what was discussed during the session..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="client_functioning"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Functioning</FormLabel>
                        <FormControl>
                          <Input placeholder="Client functioning..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_prognosis"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prognosis</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Good, Fair, Poor" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_progress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Progress</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Improving" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Private Notes */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Private Notes</h3>
                  <span className="text-xs text-muted-foreground">(Only visible to you and tenant admins)</span>
                </div>
                
                <FormField
                  control={form.control}
                  name="private_note"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Private clinical notes..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
