import React, { memo, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Brain } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';

// MSE field options with default values matching the template
const MSE_FIELDS = {
  appearance: {
    label: 'Appearance',
    defaultOption: 'Normal Appearance & Grooming',
    options: ['Normal Appearance & Grooming', 'Well-groomed', 'Casually dressed', 'Disheveled', 'Bizarre', 'Inappropriate for weather']
  },
  attitude: {
    label: 'Attitude',
    defaultOption: 'Calm & Cooperative',
    options: ['Calm & Cooperative', 'Cooperative', 'Friendly', 'Guarded', 'Hostile', 'Suspicious', 'Withdrawn']
  },
  behavior: {
    label: 'Behavior',
    defaultOption: 'No unusual behavior or psychomotor changes',
    options: ['No unusual behavior or psychomotor changes', 'Calm', 'Restless', 'Agitated', 'Psychomotor retardation', 'Tremor', 'Tics']
  },
  speech: {
    label: 'Speech',
    defaultOption: 'Normal rate/tone/volume w/out pressure',
    options: ['Normal rate/tone/volume w/out pressure', 'Normal rate/volume', 'Slow', 'Rapid', 'Pressured', 'Soft', 'Loud', 'Slurred']
  },
  affect: {
    label: 'Affect',
    defaultOption: 'Normal range/congruent',
    options: ['Normal range/congruent', 'Full range', 'Constricted', 'Blunted', 'Flat', 'Labile', 'Inappropriate']
  },
  thoughtProcess: {
    label: 'Thought Process',
    defaultOption: 'Goal Oriented/Directed',
    options: ['Goal Oriented/Directed', 'Logical', 'Tangential', 'Circumstantial', 'Loose associations', 'Flight of ideas', 'Perseveration']
  },
  perception: {
    label: 'Perception',
    defaultOption: 'No Hallucinations or Delusions',
    options: ['No Hallucinations or Delusions', 'No abnormalities', 'Auditory hallucinations', 'Visual hallucinations', 'Illusions', 'Derealization', 'Depersonalization']
  },
  orientation: {
    label: 'Orientation',
    defaultOption: 'Oriented x4',
    options: ['Oriented x4', 'Oriented x3', 'Oriented x2', 'Oriented x1', 'Disoriented']
  },
  memoryConcentration: {
    label: 'Memory/Concentration',
    defaultOption: 'Short & Long Term Intact',
    options: ['Short & Long Term Intact', 'Intact', 'Mildly impaired', 'Moderately impaired', 'Severely impaired']
  },
  insightJudgement: {
    label: 'Insight/Judgement',
    defaultOption: 'Good',
    options: ['Good', 'Fair', 'Limited', 'Poor']
  }
} as const;

// Field name mapping from formState to DB columns
const FIELD_TO_DB_MAP: Record<string, string> = {
  appearance: 'client_appearance',
  attitude: 'client_attitude',
  behavior: 'client_behavior',
  speech: 'client_speech',
  affect: 'client_affect',
  thoughtProcess: 'client_thoughtprocess',
  perception: 'client_perception',
  orientation: 'client_orientation',
  memoryConcentration: 'client_memoryconcentration',
  insightJudgement: 'client_insightjudgement'
};

interface MentalStatusSectionProps {
  form: UseFormReturn<any>;
}

interface MentalStatusFieldProps {
  fieldKey: string;
  config: typeof MSE_FIELDS[keyof typeof MSE_FIELDS];
  form: UseFormReturn<any>;
  isEditMode: boolean;
  onToggleEditMode: (isEdit: boolean) => void;
  onClear: () => void;
}

const MentalStatusField = memo(({ 
  fieldKey,
  config,
  form,
  isEditMode,
  onToggleEditMode,
  onClear
}: MentalStatusFieldProps) => {
  const dbFieldName = FIELD_TO_DB_MAP[fieldKey];
  
  return (
    <FormField
      control={form.control}
      name={dbFieldName}
      render={({ field }) => (
        <FormItem className="min-h-[80px]">
          <FormLabel>{config.label}</FormLabel>
          {isEditMode ? (
            <div className="relative">
              <FormControl>
                <Input
                  value={field.value || ''}
                  onChange={field.onChange}
                  placeholder={`Describe ${config.label.toLowerCase()}`}
                  className="w-full pr-8"
                />
              </FormControl>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  onClear();
                  onToggleEditMode(false);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Select
              value={field.value || ''}
              onValueChange={(value) => {
                if (value === 'Other') {
                  onToggleEditMode(true);
                  field.onChange('');
                } else {
                  field.onChange(value);
                }
              }}
            >
              <FormControl>
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder={`Select ${config.label.toLowerCase()}`} />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="bg-background border border-border shadow-lg z-50">
                {config.options.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
                <SelectItem value="Other">Other (Free Text)</SelectItem>
              </SelectContent>
            </Select>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
});

MentalStatusField.displayName = 'MentalStatusField';

export const MentalStatusSection: React.FC<MentalStatusSectionProps> = memo(({ form }) => {
  const [editModes, setEditModes] = useState<Record<string, boolean>>({});

  const toggleEditMode = (field: string, isEdit: boolean) => {
    setEditModes(prev => ({ ...prev, [field]: isEdit }));
  };

  const clearField = (field: string) => {
    const dbField = FIELD_TO_DB_MAP[field];
    form.setValue(dbField, '');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">Mental Status Examination</h3>
      </div>

      {/* Row 1: Appearance, Attitude, Behavior */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['appearance', 'attitude', 'behavior'] as const).map((key) => (
          <MentalStatusField
            key={key}
            fieldKey={key}
            config={MSE_FIELDS[key]}
            form={form}
            isEditMode={editModes[key] || false}
            onToggleEditMode={(isEdit) => toggleEditMode(key, isEdit)}
            onClear={() => clearField(key)}
          />
        ))}
      </div>

      {/* Row 2: Speech, Affect, Thought Process */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['speech', 'affect', 'thoughtProcess'] as const).map((key) => (
          <MentalStatusField
            key={key}
            fieldKey={key}
            config={MSE_FIELDS[key]}
            form={form}
            isEditMode={editModes[key] || false}
            onToggleEditMode={(isEdit) => toggleEditMode(key, isEdit)}
            onClear={() => clearField(key)}
          />
        ))}
      </div>

      {/* Row 3: Perception, Orientation, Memory/Concentration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['perception', 'orientation', 'memoryConcentration'] as const).map((key) => (
          <MentalStatusField
            key={key}
            fieldKey={key}
            config={MSE_FIELDS[key]}
            form={form}
            isEditMode={editModes[key] || false}
            onToggleEditMode={(isEdit) => toggleEditMode(key, isEdit)}
            onClear={() => clearField(key)}
          />
        ))}
      </div>

      {/* Row 4: Insight/Judgement, Mood (free text), Substance Abuse Risk */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MentalStatusField
          fieldKey="insightJudgement"
          config={MSE_FIELDS.insightJudgement}
          form={form}
          isEditMode={editModes.insightJudgement || false}
          onToggleEditMode={(isEdit) => toggleEditMode('insightJudgement', isEdit)}
          onClear={() => clearField('insightJudgement')}
        />
        
        {/* Mood - Always free text */}
        <FormField
          control={form.control}
          name="client_mood"
          render={({ field }) => (
            <FormItem className="min-h-[80px]">
              <FormLabel>Mood</FormLabel>
              <FormControl>
                <Input
                  placeholder="Describe mood"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Substance Abuse Risk */}
        <FormField
          control={form.control}
          name="client_substanceabuserisk"
          render={({ field }) => (
            <FormItem className="min-h-[80px]">
              <FormLabel>Substance Abuse Risk</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-background border-input">
                    <SelectValue placeholder="Select risk level" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-background border border-border shadow-lg z-50">
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
      </div>

      {/* Row 5: Suicidal Ideation, Homicidal Ideation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="client_suicidalideation"
          render={({ field }) => (
            <FormItem className="min-h-[80px]">
              <FormLabel>Suicidal Ideation</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-background border-input">
                    <SelectValue placeholder="Select ideation level" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-background border border-border shadow-lg z-50">
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
            <FormItem className="min-h-[80px]">
              <FormLabel>Homicidal Ideation</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-background border-input">
                    <SelectValue placeholder="Select ideation level" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-background border border-border shadow-lg z-50">
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
  );
});

MentalStatusSection.displayName = 'MentalStatusSection';
