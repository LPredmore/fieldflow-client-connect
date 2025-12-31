import React, { memo } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ClipboardList, Sparkles, Check, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';

// Clinical dropdown options matching the template
const FUNCTIONING_OPTIONS = [
  { value: "Excellent - Fully capable in all areas of life", label: "Excellent - Fully capable in all areas of life" },
  { value: "Good - Managing well with minimal impairment", label: "Good - Managing well with minimal impairment" },
  { value: "Satisfactory - Some challenges but maintaining essential functions", label: "Satisfactory - Some challenges but maintaining essential functions" },
  { value: "Fair - Moderate impairment in one or more areas", label: "Fair - Moderate impairment in one or more areas" },
  { value: "Limited - Significant impairment in multiple areas", label: "Limited - Significant impairment in multiple areas" },
  { value: "Poor - Severe impairment in daily functioning", label: "Poor - Severe impairment in daily functioning" },
  { value: "Very poor - Unable to function independently in most areas", label: "Very poor - Unable to function independently in most areas" },
  { value: "Crisis - Immediate intervention needed", label: "Crisis - Immediate intervention needed" }
];

const PROGNOSIS_OPTIONS = [
  { value: "Excellent - Highly likely to achieve all treatment goals", label: "Excellent - Highly likely to achieve all treatment goals" },
  { value: "Very Good - Strong likelihood of achieving most treatment goals", label: "Very Good - Strong likelihood of achieving most treatment goals" },
  { value: "Good - Likely to achieve primary treatment goals", label: "Good - Likely to achieve primary treatment goals" },
  { value: "Fair - May achieve some treatment goals with consistent effort", label: "Fair - May achieve some treatment goals with consistent effort" },
  { value: "Guarded - Limited expectation of achieving treatment goals", label: "Guarded - Limited expectation of achieving treatment goals" },
  { value: "Poor - Significant barriers to achieving treatment goals", label: "Poor - Significant barriers to achieving treatment goals" },
  { value: "Uncertain - Unable to determine likelihood at this time", label: "Uncertain - Unable to determine likelihood at this time" }
];

const PROGRESS_OPTIONS = [
  { value: "Exceptional - Exceeding expectations in all goal areas", label: "Exceptional - Exceeding expectations in all goal areas" },
  { value: "Substantial - Significant improvement toward most goals", label: "Substantial - Significant improvement toward most goals" },
  { value: "Steady - Consistent improvement at expected pace", label: "Steady - Consistent improvement at expected pace" },
  { value: "Moderate - Some improvement in key areas", label: "Moderate - Some improvement in key areas" },
  { value: "Minimal - Slight improvements noted", label: "Minimal - Slight improvements noted" },
  { value: "Fluctuating - Inconsistent progress with periods of improvement and regression", label: "Fluctuating - Inconsistent progress" },
  { value: "Stalled - No significant changes since last assessment", label: "Stalled - No significant changes since last assessment" },
  { value: "Early stage - Too early in treatment to evaluate progress", label: "Early stage - Too early in treatment to evaluate progress" },
  { value: "Regression - Decline in functioning or symptoms worsening", label: "Regression - Decline in functioning or symptoms worsening" }
];

interface SessionAssessmentSectionProps {
  form: UseFormReturn<any>;
  onAiAssist?: () => void;
  isGeneratingNote?: boolean;
  isAiAssistMode?: boolean;
  toggleAiAssistMode?: () => void;
  selectedInterventions?: string[];
}

export const SessionAssessmentSection: React.FC<SessionAssessmentSectionProps> = memo(({
  form,
  onAiAssist,
  isGeneratingNote = false,
  isAiAssistMode = false,
  toggleAiAssistMode,
  selectedInterventions = [],
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">Session Assessment</h3>
      </div>

      {/* Current Symptoms - Textarea */}
      <FormField
        control={form.control}
        name="client_currentsymptoms"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Current Symptoms</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Describe current symptoms..."
                className="min-h-[100px] resize-y"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Functioning - Dropdown */}
      <FormField
        control={form.control}
        name="client_functioning"
        render={({ field }) => (
          <FormItem className="min-h-[80px]">
            <FormLabel>Functioning</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder="Select client's level of functioning" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="bg-background border border-border shadow-lg z-50">
                {FUNCTIONING_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Prognosis - Dropdown */}
      <FormField
        control={form.control}
        name="client_prognosis"
        render={({ field }) => (
          <FormItem className="min-h-[80px]">
            <FormLabel>Prognosis</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder="Select client's prognosis" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="bg-background border border-border shadow-lg z-50">
                {PROGNOSIS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Progress - Dropdown */}
      <FormField
        control={form.control}
        name="client_progress"
        render={({ field }) => (
          <FormItem className="min-h-[80px]">
            <FormLabel>Progress</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder="Select client's progress level" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="bg-background border border-border shadow-lg z-50">
                {PROGRESS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Session Narrative - Textarea with AI Assist button */}
      <FormField
        control={form.control}
        name="client_sessionnarrative"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-2">
              <FormLabel>Session Narrative *</FormLabel>
              
              {/* Step 1: Enter AI Assist Mode */}
              {toggleAiAssistMode && !isAiAssistMode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleAiAssistMode}
                  className="h-6 px-2 text-xs"
                  disabled={isGeneratingNote}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Assist
                </Button>
              )}
              
              {/* Step 2: Cancel or Confirm AI Assist */}
              {isAiAssistMode && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={toggleAiAssistMode}
                    className="h-6 px-2 text-xs"
                    disabled={isGeneratingNote}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={onAiAssist}
                    disabled={isGeneratingNote || selectedInterventions.length === 0}
                    className="h-6 px-2 text-xs"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    {isGeneratingNote ? 'Generating...' : 'Confirm AI Assist'}
                  </Button>
                </>
              )}
            </div>
            <FormControl>
              <Textarea
                placeholder="Provide a detailed narrative of the session..."
                className="min-h-[120px] resize-y"
                disabled={isGeneratingNote}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
});

SessionAssessmentSection.displayName = 'SessionAssessmentSection';
