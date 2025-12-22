import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addMonths } from 'date-fns';
import { CalendarIcon, Plus, X, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';

import { DiagnosisSelector } from './DiagnosisSelector';
import { useTreatmentPlans, TreatmentPlan } from '@/hooks/useTreatmentPlans';
import { useClientDiagnoses } from '@/hooks/useClientDiagnoses';
import { useManageClientDiagnoses } from '@/hooks/useDiagnosisCodes';
import { useTreatmentPlanPrivateNote } from '@/hooks/useTreatmentPlanPrivateNote';
import { useAuth } from '@/hooks/useAuth';
import { Client } from '@/hooks/useClients';
import { getClientDisplayName } from '@/utils/clientDisplayName';
import { supabase } from '@/integrations/supabase/client';

// Form validation schema
const treatmentPlanSchema = z.object({
  start_date: z.date({
    required_error: "Start date is required",
  }),
  plan_length: z.string().min(1, "Plan length is required"),
  treatment_frequency: z.string().min(1, "Treatment frequency is required"),
  problem_narrative: z.string().min(1, "Problem narrative is required"),
  treatment_goal: z.string().min(1, "Treatment goal is required"),
  primary_objective: z.string().min(1, "Primary objective is required"),
  intervention_1: z.string().min(1, "At least one intervention is required"),
  intervention_2: z.string().min(1, "Second intervention is required"),
  secondary_objective: z.string().optional(),
  intervention_3: z.string().optional(),
  intervention_4: z.string().optional(),
  tertiary_objective: z.string().optional(),
  intervention_5: z.string().optional(),
  intervention_6: z.string().optional(),
});

type TreatmentPlanFormValues = z.infer<typeof treatmentPlanSchema>;

interface TreatmentPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  existingPlan?: TreatmentPlan | null;
  clinicianName?: string;
}

const PLAN_LENGTH_OPTIONS = [
  { value: '1month', label: '1 month' },
  { value: '3month', label: '3 months' },
  { value: '6month', label: '6 months' },
  { value: '9month', label: '9 months' },
  { value: '12month', label: '12 months' },
];

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'asneeded', label: 'As Needed' },
];

export function TreatmentPlanDialog({
  open,
  onOpenChange,
  clientId,
  existingPlan,
  clinicianName = '',
}: TreatmentPlanDialogProps) {
  const [showSecondaryObjective, setShowSecondaryObjective] = useState(false);
  const [showTertiaryObjective, setShowTertiaryObjective] = useState(false);
  const [selectedDiagnosisIds, setSelectedDiagnosisIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [privateNoteContent, setPrivateNoteContent] = useState('');
  
  // Fetch full client data when dialog opens
  const [clientData, setClientData] = useState<Client | null>(null);
  const [clientLoading, setClientLoading] = useState(false);
  
  const { user, tenantId } = useAuth();
  
  useEffect(() => {
    if (open && clientId) {
      setClientLoading(true);
      supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data) {
            setClientData(data as Client);
          }
          setClientLoading(false);
        });
    } else if (!open) {
      setClientData(null);
    }
  }, [open, clientId]);

  const { createPlan, updatePlan, loading: plansLoading } = useTreatmentPlans(clientId);
  const { diagnoses, refetch: refetchDiagnoses } = useClientDiagnoses(clientId);
  const { addDiagnosis, removeDiagnosis } = useManageClientDiagnoses(clientId);

  const isEditing = !!existingPlan;
  
  // Private note hook - only used when editing an existing plan
  const { 
    noteContent: existingNoteContent, 
    savePrivateNote,
    loading: privateNoteLoading 
  } = useTreatmentPlanPrivateNote(isEditing ? existingPlan?.id : undefined);

  const form = useForm<TreatmentPlanFormValues>({
    resolver: zodResolver(treatmentPlanSchema),
    defaultValues: {
      start_date: new Date(),
      plan_length: '',
      treatment_frequency: '',
      problem_narrative: '',
      treatment_goal: '',
      primary_objective: '',
      intervention_1: '',
      intervention_2: '',
      secondary_objective: '',
      intervention_3: '',
      intervention_4: '',
      tertiary_objective: '',
      intervention_5: '',
      intervention_6: '',
    },
  });

  // Load existing plan data when editing
  useEffect(() => {
    if (existingPlan && open) {
      form.reset({
        start_date: existingPlan.treatmentplan_startdate ? new Date(existingPlan.treatmentplan_startdate) : new Date(),
        plan_length: existingPlan.planlength || '',
        treatment_frequency: existingPlan.treatmentfrequency || '',
        problem_narrative: existingPlan.problem || '',
        treatment_goal: existingPlan.treatmentgoal || '',
        primary_objective: existingPlan.primaryobjective || '',
        intervention_1: existingPlan.intervention1 || '',
        intervention_2: existingPlan.intervention2 || '',
        secondary_objective: existingPlan.secondaryobjective || '',
        intervention_3: existingPlan.intervention3 || '',
        intervention_4: existingPlan.intervention4 || '',
        tertiary_objective: existingPlan.tertiaryobjective || '',
        intervention_5: existingPlan.intervention5 || '',
        intervention_6: existingPlan.intervention6 || '',
      });

      setShowSecondaryObjective(!!existingPlan.secondaryobjective);
      setShowTertiaryObjective(!!existingPlan.tertiaryobjective);
    }
  }, [existingPlan, open, form]);

  // Load existing diagnoses when opening
  useEffect(() => {
    if (open && diagnoses) {
      setSelectedDiagnosisIds(diagnoses.map(d => d.diagnosis_code_id));
    }
  }, [open, diagnoses]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setShowSecondaryObjective(false);
      setShowTertiaryObjective(false);
      setSelectedDiagnosisIds([]);
      setPrivateNoteContent('');
    }
  }, [open, form]);
  
  // Load existing private note when editing
  useEffect(() => {
    if (isEditing && existingNoteContent) {
      setPrivateNoteContent(existingNoteContent);
    }
  }, [isEditing, existingNoteContent]);

  // Calculate next update date based on start date and plan length
  const calculateNextUpdateDate = (startDate: Date, planLength: string): string => {
    const monthsMap: Record<string, number> = {
      '1month': 1,
      '3month': 3,
      '6month': 6,
      '9month': 9,
      '12month': 12,
    };
    const months = monthsMap[planLength];
    if (!months) return '';
    return format(addMonths(startDate, months), 'yyyy-MM-dd');
  };

  const handleDiagnosisChange = async (newIds: string[]) => {
    const existingIds = diagnoses?.map(d => d.diagnosis_code_id) || [];
    
    // Find added diagnoses
    const addedIds = newIds.filter(id => !existingIds.includes(id));
    // Find removed diagnoses
    const removedIds = existingIds.filter(id => !newIds.includes(id));

    // Add new diagnoses
    for (const id of addedIds) {
      await addDiagnosis(id, addedIds.length === 1 && existingIds.length === 0);
    }

    // Remove diagnoses
    for (const id of removedIds) {
      const diagnosis = diagnoses?.find(d => d.diagnosis_code_id === id);
      if (diagnosis) {
        await removeDiagnosis(diagnosis.id);
      }
    }

    await refetchDiagnoses();
    setSelectedDiagnosisIds(newIds);
  };

  // Save private note for newly created plans (direct insert)
  const savePrivateNoteForNewPlan = async (planId: string, content: string): Promise<boolean> => {
    if (!tenantId || !user?.id) return false;
    
    try {
      const { error } = await supabase
        .from('treatment_plan_private_notes')
        .insert({
          tenant_id: tenantId,
          treatment_plan_id: planId,
          created_by_profile_id: user.id,
          note_content: content,
        });
      
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error saving private note for new plan:', err);
      return false;
    }
  };

  const onSubmit = async (values: TreatmentPlanFormValues) => {
    if (!clientId) return;

    setIsSaving(true);

    try {
      const nextUpdateDate = calculateNextUpdateDate(values.start_date, values.plan_length);

      const planData = {
        start_date: format(values.start_date, 'yyyy-MM-dd'),
        plan_length: values.plan_length,
        treatment_frequency: values.treatment_frequency,
        next_update_date: nextUpdateDate,
        problem_narrative: values.problem_narrative,
        treatment_goal: values.treatment_goal,
        primary_objective: values.primary_objective,
        secondary_objective: values.secondary_objective || null,
        tertiary_objective: values.tertiary_objective || null,
        intervention_1: values.intervention_1,
        intervention_2: values.intervention_2,
        intervention_3: values.intervention_3 || null,
        intervention_4: values.intervention_4 || null,
        intervention_5: values.intervention_5 || null,
        intervention_6: values.intervention_6 || null,
      };

      if (isEditing && existingPlan) {
        // Phase 1: Update the treatment plan
        await updatePlan(existingPlan.id, planData);
        
        // Phase 2: Save private note if content exists
        if (privateNoteContent.trim()) {
          const { error } = await savePrivateNote(privateNoteContent.trim());
          if (error) {
            toast({
              title: "Note",
              description: "Treatment plan updated, but private note could not be saved.",
              variant: "default",
            });
          }
        }
      } else {
        // Phase 1: Create the treatment plan
        const { data: newPlan } = await createPlan(planData);
        const savedPlanId = newPlan?.id;
        
        // Phase 2: Save private note if content exists and we have a plan ID
        if (savedPlanId && privateNoteContent.trim()) {
          const noteSuccess = await savePrivateNoteForNewPlan(savedPlanId, privateNoteContent.trim());
          if (!noteSuccess) {
            toast({
              title: "Note",
              description: "Treatment plan created, but private note could not be saved. You can add it by editing the plan.",
              variant: "default",
            });
          }
        }
      }

      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddObjective = () => {
    if (!showSecondaryObjective) {
      setShowSecondaryObjective(true);
    } else if (!showTertiaryObjective) {
      setShowTertiaryObjective(true);
    }
  };

  if (!clientId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5" />
            {isEditing ? 'Edit Treatment Plan' : 'Create Treatment Plan'}
          </SheetTitle>
          <SheetDescription>
            {isEditing 
              ? 'Update the treatment plan for this client'
              : 'Create a new treatment plan for this client'
            }
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Client Info - Read Only */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Client Information</CardTitle>
              </CardHeader>
              <CardContent>
                {clientLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading client data...
                  </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Client Name</Label>
                    <p className="font-medium">{clientData ? getClientDisplayName(clientData) : 'Loading...'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Date of Birth</Label>
                    <p className="font-medium">
                      {clientData?.pat_dob 
                        ? format(new Date(clientData.pat_dob), 'MMM d, yyyy')
                        : 'Not set'
                      }
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Clinician</Label>
                    <p className="font-medium">{clinicianName || 'Not assigned'}</p>
                  </div>
                </div>
                )}
              </CardContent>
            </Card>

            {/* Plan Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Plan Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Start Date */}
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Plan Length */}
                  <FormField
                    control={form.control}
                    name="plan_length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan Length</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select length" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PLAN_LENGTH_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Treatment Frequency */}
                  <FormField
                    control={form.control}
                    name="treatment_frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Treatment Frequency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FREQUENCY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Diagnosis Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Diagnosis</CardTitle>
              </CardHeader>
              <CardContent>
                <DiagnosisSelector
                  selectedIds={selectedDiagnosisIds}
                  onChange={handleDiagnosisChange}
                  placeholder="Search and select diagnoses..."
                />
                {selectedDiagnosisIds.length === 0 && (
                  <Alert className="mt-3">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      At least one diagnosis is required for the treatment plan.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Problem & Goal */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Problem & Goal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="problem_narrative"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Problem Narrative</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the presenting problem..."
                          className="min-h-[100px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="treatment_goal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Treatment Goal</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the treatment goals..."
                          className="min-h-[100px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Primary Objective */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Primary Objective</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="primary_objective"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Objective</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the primary objective..."
                          className="min-h-[80px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="intervention_1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Intervention 1</FormLabel>
                        <FormControl>
                          <Input placeholder="Describe intervention" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="intervention_2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Intervention 2</FormLabel>
                        <FormControl>
                          <Input placeholder="Describe intervention" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Secondary Objective */}
            {showSecondaryObjective && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    Secondary Objective
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowSecondaryObjective(false);
                        setShowTertiaryObjective(false);
                        form.setValue('secondary_objective', '');
                        form.setValue('intervention_3', '');
                        form.setValue('intervention_4', '');
                        form.setValue('tertiary_objective', '');
                        form.setValue('intervention_5', '');
                        form.setValue('intervention_6', '');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="secondary_objective"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Objective</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the secondary objective..."
                            className="min-h-[80px] resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="intervention_3"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Intervention 3</FormLabel>
                          <FormControl>
                            <Input placeholder="Describe intervention" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="intervention_4"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Intervention 4</FormLabel>
                          <FormControl>
                            <Input placeholder="Describe intervention" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tertiary Objective */}
            {showTertiaryObjective && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    Tertiary Objective
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowTertiaryObjective(false);
                        form.setValue('tertiary_objective', '');
                        form.setValue('intervention_5', '');
                        form.setValue('intervention_6', '');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="tertiary_objective"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Objective</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the tertiary objective..."
                            className="min-h-[80px] resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="intervention_5"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Intervention 5</FormLabel>
                          <FormControl>
                            <Input placeholder="Describe intervention" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="intervention_6"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Intervention 6</FormLabel>
                          <FormControl>
                            <Input placeholder="Describe intervention" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Add Objective Button */}
            {(!showSecondaryObjective || !showTertiaryObjective) && (
              <Button
                type="button"
                variant="outline"
                onClick={handleAddObjective}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Objective
              </Button>
            )}

            {/* Private Notes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  Private Notes
                  <span className="text-xs font-normal text-muted-foreground">
                    (Only visible to you)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Add private clinical observations, reminders, or notes that only you can see..."
                  className="min-h-[100px] resize-none"
                  value={privateNoteContent}
                  onChange={(e) => setPrivateNoteContent(e.target.value)}
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  These notes are personal and won't be visible to other clinicians.
                </p>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || selectedDiagnosisIds.length === 0}
              >
                {isSaving ? 'Saving...' : isEditing ? 'Update Plan' : 'Save Treatment Plan'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
