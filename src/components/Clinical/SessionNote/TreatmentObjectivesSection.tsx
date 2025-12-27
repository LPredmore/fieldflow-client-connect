import React, { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Target } from 'lucide-react';
import { TreatmentPlan } from '@/hooks/useTreatmentPlans';

interface TreatmentObjectivesSectionProps {
  activePlan: TreatmentPlan;
  selectedInterventions?: string[];
  onInterventionChange?: (interventions: string[]) => void;
  selectionEnabled?: boolean;
}

export const TreatmentObjectivesSection: React.FC<TreatmentObjectivesSectionProps> = memo(({
  activePlan,
  selectedInterventions = [],
  onInterventionChange,
  selectionEnabled = false,
}) => {
  // Extract all non-null interventions from the plan
  const allInterventions = useMemo(() => {
    const interventions: { key: string; label: string; value: string }[] = [];
    
    if (activePlan.intervention1) {
      interventions.push({ key: 'intervention1', label: 'Intervention 1', value: activePlan.intervention1 });
    }
    if (activePlan.intervention2) {
      interventions.push({ key: 'intervention2', label: 'Intervention 2', value: activePlan.intervention2 });
    }
    if (activePlan.intervention3) {
      interventions.push({ key: 'intervention3', label: 'Intervention 3', value: activePlan.intervention3 });
    }
    if (activePlan.intervention4) {
      interventions.push({ key: 'intervention4', label: 'Intervention 4', value: activePlan.intervention4 });
    }
    if (activePlan.intervention5) {
      interventions.push({ key: 'intervention5', label: 'Intervention 5', value: activePlan.intervention5 });
    }
    if (activePlan.intervention6) {
      interventions.push({ key: 'intervention6', label: 'Intervention 6', value: activePlan.intervention6 });
    }
    
    return interventions;
  }, [activePlan]);

  const handleInterventionToggle = (interventionValue: string, checked: boolean) => {
    if (!onInterventionChange) return;
    
    if (checked) {
      onInterventionChange([...selectedInterventions, interventionValue]);
    } else {
      onInterventionChange(selectedInterventions.filter(i => i !== interventionValue));
    }
  };

  const renderInterventionItem = (intervention: { key: string; label: string; value: string }) => {
    const isSelected = selectedInterventions.includes(intervention.value);
    
    if (selectionEnabled) {
      return (
        <div 
          key={intervention.key}
          className={`flex items-start gap-3 p-2 rounded-md transition-colors ${
            isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'
          }`}
        >
          <Checkbox
            id={intervention.key}
            checked={isSelected}
            onCheckedChange={(checked) => handleInterventionToggle(intervention.value, checked === true)}
            className="mt-0.5"
          />
          <label 
            htmlFor={intervention.key}
            className="text-sm cursor-pointer flex-1"
          >
            <span className="text-xs text-muted-foreground block">{intervention.label}</span>
            <span className={isSelected ? 'font-medium' : ''}>{intervention.value}</span>
          </label>
        </div>
      );
    }
    
    // View-only mode
    return (
      <div key={intervention.key}>
        <Label className="text-xs text-muted-foreground">{intervention.label}</Label>
        <p className="text-sm">{intervention.value}</p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4" />
          Treatment Objectives & Interventions
          {selectionEnabled ? (
            <span className="text-xs text-primary font-normal">(Select interventions used)</span>
          ) : (
            <span className="text-xs text-muted-foreground font-normal">(View Only)</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* Plan metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

        {/* Problem */}
        {activePlan.problem && (
          <div>
            <Label className="text-xs text-muted-foreground">Problem</Label>
            <p className="font-medium mt-1">{activePlan.problem}</p>
          </div>
        )}

        {/* Treatment Goal */}
        {activePlan.treatmentgoal && (
          <div>
            <Label className="text-xs text-muted-foreground">Treatment Goal</Label>
            <p className="font-medium mt-1">{activePlan.treatmentgoal}</p>
          </div>
        )}

        <Separator />

        {/* Primary Objective */}
        {activePlan.primaryobjective && (
          <div>
            <Label className="text-xs text-muted-foreground">Primary Objective</Label>
            <p className="font-medium mt-1">{activePlan.primaryobjective}</p>
          </div>
        )}

        {/* Secondary Objective */}
        {activePlan.secondaryobjective && (
          <div>
            <Label className="text-xs text-muted-foreground">Secondary Objective</Label>
            <p className="font-medium mt-1">{activePlan.secondaryobjective}</p>
          </div>
        )}

        {/* Tertiary Objective */}
        {activePlan.tertiaryobjective && (
          <div>
            <Label className="text-xs text-muted-foreground">Tertiary Objective</Label>
            <p className="font-medium mt-1">{activePlan.tertiaryobjective}</p>
          </div>
        )}

        {/* Interventions Section */}
        {allInterventions.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground block mb-2">
                {selectionEnabled ? 'Select Interventions Used in This Session:' : 'Interventions:'}
              </Label>
              <div className={selectionEnabled ? 'space-y-1' : 'space-y-2 pl-4 border-l-2 border-muted'}>
                {allInterventions.map(renderInterventionItem)}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});

TreatmentObjectivesSection.displayName = 'TreatmentObjectivesSection';
