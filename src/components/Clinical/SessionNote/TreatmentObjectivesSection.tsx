import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Target } from 'lucide-react';
import { TreatmentPlan } from '@/hooks/useTreatmentPlans';

interface TreatmentObjectivesSectionProps {
  activePlan: TreatmentPlan;
}

export const TreatmentObjectivesSection: React.FC<TreatmentObjectivesSectionProps> = memo(({
  activePlan
}) => {
  // Check if there are any interventions at all
  const hasInterventions = activePlan.intervention1 || activePlan.intervention2 || 
    activePlan.intervention3 || activePlan.intervention4 || 
    activePlan.intervention5 || activePlan.intervention6;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4" />
          Treatment Objectives & Interventions
          <span className="text-xs text-muted-foreground font-normal">(View Only)</span>
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

        {/* Primary Objective + Interventions 1-2 */}
        {activePlan.primaryobjective && (
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">Primary Objective</Label>
              <p className="font-medium mt-1">{activePlan.primaryobjective}</p>
            </div>
            {(activePlan.intervention1 || activePlan.intervention2) && (
              <div className="pl-4 border-l-2 border-muted space-y-1">
                {activePlan.intervention1 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Intervention 1</Label>
                    <p className="text-sm">{activePlan.intervention1}</p>
                  </div>
                )}
                {activePlan.intervention2 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Intervention 2</Label>
                    <p className="text-sm">{activePlan.intervention2}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Secondary Objective + Interventions 3-4 */}
        {activePlan.secondaryobjective && (
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">Secondary Objective</Label>
              <p className="font-medium mt-1">{activePlan.secondaryobjective}</p>
            </div>
            {(activePlan.intervention3 || activePlan.intervention4) && (
              <div className="pl-4 border-l-2 border-muted space-y-1">
                {activePlan.intervention3 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Intervention 3</Label>
                    <p className="text-sm">{activePlan.intervention3}</p>
                  </div>
                )}
                {activePlan.intervention4 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Intervention 4</Label>
                    <p className="text-sm">{activePlan.intervention4}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tertiary Objective + Interventions 5-6 */}
        {activePlan.tertiaryobjective && (
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">Tertiary Objective</Label>
              <p className="font-medium mt-1">{activePlan.tertiaryobjective}</p>
            </div>
            {(activePlan.intervention5 || activePlan.intervention6) && (
              <div className="pl-4 border-l-2 border-muted space-y-1">
                {activePlan.intervention5 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Intervention 5</Label>
                    <p className="text-sm">{activePlan.intervention5}</p>
                  </div>
                )}
                {activePlan.intervention6 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Intervention 6</Label>
                    <p className="text-sm">{activePlan.intervention6}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

TreatmentObjectivesSection.displayName = 'TreatmentObjectivesSection';
