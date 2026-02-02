import { UseFormReturn } from "react-hook-form";
import { EnabledCptCode } from "@/hooks/useEnabledCptCodes";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, DollarSign } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface BillingSectionProps {
  form: UseFormReturn<any>;
  enabledCptCodes: EnabledCptCode[];
  loading: boolean;
  selectedCptCode: EnabledCptCode | null;
  onCptCodeChange: (cptCode: EnabledCptCode | null) => void;
}

/**
 * Billing section for SessionNoteDialog.
 * Allows selection of CPT code and units for billing purposes.
 */
export function BillingSection({
  form,
  enabledCptCodes,
  loading,
  selectedCptCode,
  onCptCodeChange,
}: BillingSectionProps) {
  const navigate = useNavigate();
  const units = form.watch("units") || 1;

  // Calculate charge based on selected CPT code and units
  const calculatedCharge =
    selectedCptCode?.custom_rate != null
      ? units * selectedCptCode.custom_rate
      : null;

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Billing</h3>
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    );
  }

  // No enabled CPT codes - show warning with navigation
  if (enabledCptCodes.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Billing</h3>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>No CPT codes available. Please enable codes in Clinical Settings.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/settings?tab=clinical")}
              type="button"
            >
              Go to Settings
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Billing</h3>

      <div className="flex gap-4 items-start">
        {/* CPT Code Selector */}
        <FormField
          control={form.control}
          name="cpt_code_id"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>CPT Code</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  const selected = enabledCptCodes.find((c) => c.id === value);
                  onCptCodeChange(selected || null);
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select CPT code..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {enabledCptCodes.map((cpt) => (
                    <SelectItem key={cpt.id} value={cpt.id}>
                      {cpt.code} - {cpt.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Units Input */}
        <FormField
          control={form.control}
          name="units"
          render={({ field }) => (
            <FormItem className="w-24">
              <FormLabel>Units</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Calculated Charge Display */}
      {selectedCptCode && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
          <DollarSign className="h-4 w-4" />
          {calculatedCharge != null ? (
            <span>
              Charge: <strong className="text-foreground">${calculatedCharge.toFixed(2)}</strong>
              <span className="ml-2">
                ({units} unit{units !== 1 ? "s" : ""} × ${selectedCptCode.custom_rate}/unit)
              </span>
            </span>
          ) : (
            <span className="text-warning">
              Rate not set for this CPT code. Charge will be calculated as $0.00
            </span>
          )}
        </div>
      )}
    </div>
  );
}
