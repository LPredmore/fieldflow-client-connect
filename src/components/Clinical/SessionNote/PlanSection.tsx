import React, { memo } from 'react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, FileCheck } from 'lucide-react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';
import { TreatmentPlan } from '@/hooks/useTreatmentPlans';
interface PlanSectionProps {
  form: UseFormReturn<any>;
  activePlan: TreatmentPlan | null;
}
export const PlanSection: React.FC<PlanSectionProps> = memo(({
  form,
  activePlan
}) => {
  return <div className="space-y-6">
      {/* Plan & Signature Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activePlan ? (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Next Treatment Plan Update</label>
              <Input value={activePlan.next_treatmentplan_update || 'N/A'} readOnly className="bg-muted/50" />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No active treatment plan</p>
          )}
        </CardContent>
      </Card>

      {/* Private Notes Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Private Notes
            <span className="text-xs text-muted-foreground font-normal">(Only visible to you)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FormField control={form.control} name="private_note" render={({
          field
        }) => <FormItem>
                <FormControl>
                  <Textarea placeholder="Add a private note that only clinicians can see..." className="min-h-[100px] resize-y" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>} />
        </CardContent>
      </Card>
    </div>;
});
PlanSection.displayName = 'PlanSection';