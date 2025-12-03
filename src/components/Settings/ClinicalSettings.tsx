import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Save, ChevronUp, ChevronDown, ChevronsUpDown, Trash2 } from "lucide-react";
import { useCptCodes } from "@/hooks/useCptCodes";
import { useTenantCptCodes } from "@/hooks/useTenantCptCodes";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CptCodeState {
  cpt_code_id: string;
  code: string;
  description: string;
  category: string | null;
  is_enabled: boolean;
  custom_rate: number | null;
  original_is_enabled: boolean;
  original_custom_rate: number | null;
  has_existing_record: boolean;
  existing_record_id: string | null;
}

type SortColumn = 'code' | 'description' | 'custom_rate';
type SortDirection = 'asc' | 'desc';

export default function ClinicalSettings() {
  const { cptCodes, loading: cptLoading } = useCptCodes();
  const { tenantCptCodes, loading: tenantLoading, refetch, tenantId } = useTenantCptCodes();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [localState, setLocalState] = useState<CptCodeState[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Merge master CPT codes with tenant configurations
  const mergedState = useMemo(() => {
    if (!cptCodes) return null;
    
    const tenantMap = new Map(
      (tenantCptCodes ?? []).map(t => [t.cpt_code_id, t])
    );

    return cptCodes.map(cpt => {
      const tenantConfig = tenantMap.get(cpt.id);
      return {
        cpt_code_id: cpt.id,
        code: cpt.code,
        description: cpt.description,
        category: cpt.category,
        is_enabled: tenantConfig?.is_enabled ?? false,
        custom_rate: tenantConfig?.custom_rate ?? null,
        original_is_enabled: tenantConfig?.is_enabled ?? false,
        original_custom_rate: tenantConfig?.custom_rate ?? null,
        has_existing_record: !!tenantConfig,
        existing_record_id: tenantConfig?.id ?? null,
      };
    });
  }, [cptCodes, tenantCptCodes]);

  // Use local state if user has made changes, otherwise use merged state
  const currentState = localState ?? mergedState;

  // Available codes (not enabled) - filtered by search
  const availableCodes = useMemo(() => {
    const notEnabled = currentState?.filter(item => !item.is_enabled) ?? [];
    if (!searchTerm.trim()) return notEnabled;
    
    const term = searchTerm.toLowerCase();
    return notEnabled.filter(
      item => item.code.toLowerCase().includes(term) || 
              item.description.toLowerCase().includes(term)
    );
  }, [currentState, searchTerm]);

  // Selected codes (enabled) - sorted
  const selectedCodes = useMemo(() => {
    const enabled = currentState?.filter(item => item.is_enabled) ?? [];
    return [...enabled].sort((a, b) => {
      let comparison = 0;
      if (sortColumn === 'code') {
        comparison = a.code.localeCompare(b.code);
      } else if (sortColumn === 'description') {
        comparison = a.description.localeCompare(b.description);
      } else if (sortColumn === 'custom_rate') {
        comparison = (a.custom_rate ?? 0) - (b.custom_rate ?? 0);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [currentState, sortColumn, sortDirection]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!currentState) return false;
    return currentState.some(
      item => item.is_enabled !== item.original_is_enabled ||
              item.custom_rate !== item.original_custom_rate
    );
  }, [currentState]);

  // Initialize local state when merged state is ready
  useMemo(() => {
    if (mergedState && !localState) {
      setLocalState(mergedState);
    }
  }, [mergedState, localState]);

  const handleToggle = useCallback((cptCodeId: string, checked: boolean) => {
    setLocalState(prev => {
      if (!prev) return prev;
      return prev.map(item => 
        item.cpt_code_id === cptCodeId 
          ? { ...item, is_enabled: checked }
          : item
      );
    });
  }, []);

  const handleRemove = useCallback((cptCodeId: string) => {
    setLocalState(prev => {
      if (!prev) return prev;
      return prev.map(item => 
        item.cpt_code_id === cptCodeId 
          ? { ...item, is_enabled: false }
          : item
      );
    });
  }, []);

  const handlePriceChange = useCallback((cptCodeId: string, value: string) => {
    const numValue = value === "" ? null : parseInt(value, 10);
    if (value !== "" && (isNaN(numValue!) || numValue! < 0)) return;
    
    setLocalState(prev => {
      if (!prev) return prev;
      return prev.map(item => 
        item.cpt_code_id === cptCodeId 
          ? { ...item, custom_rate: numValue }
          : item
      );
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const availableIds = new Set(availableCodes.map(item => item.cpt_code_id));
    
    setLocalState(prev => {
      if (!prev) return prev;
      return prev.map(item => 
        availableIds.has(item.cpt_code_id)
          ? { ...item, is_enabled: true }
          : item
      );
    });
  }, [availableCodes]);

  const handleSave = useCallback(async () => {
    if (!currentState || !tenantId) return;
    
    setIsSaving(true);
    
    try {
      const changedItems = currentState.filter(
        item => item.is_enabled !== item.original_is_enabled ||
                item.custom_rate !== item.original_custom_rate
      );

      const updates = changedItems.filter(item => item.has_existing_record);
      const inserts = changedItems.filter(item => !item.has_existing_record && (item.is_enabled || item.custom_rate !== null));

      // Process updates
      for (const item of updates) {
        await supabase
          .from("tenant_cpt_codes")
          .update({ 
            is_enabled: item.is_enabled, 
            custom_rate: item.custom_rate 
          })
          .eq("id", item.existing_record_id!);
      }

      // Process inserts
      for (const item of inserts) {
        await supabase
          .from("tenant_cpt_codes")
          .insert({
            tenant_id: tenantId,
            cpt_code_id: item.cpt_code_id,
            is_enabled: item.is_enabled,
            custom_rate: item.custom_rate,
          });
      }
      
      // Reset local state to trigger re-merge with fresh data
      setLocalState(null);
      await refetch();
      
      toast({
        title: "Settings saved",
        description: `Updated ${changedItems.length} CPT code configuration(s).`,
      });
    } catch (error) {
      console.error("Error saving CPT code settings:", error);
      toast({
        title: "Error saving settings",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [currentState, tenantId, refetch, toast]);

  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  const SortableHeader = ({ column, label, className }: { 
    column: SortColumn; 
    label: string;
    className?: string;
  }) => {
    const isActive = sortColumn === column;
    return (
      <TableHead 
        className={cn("cursor-pointer select-none hover:bg-muted/50 transition-colors", className)}
        onClick={() => handleSort(column)}
      >
        <div className="flex items-center gap-1">
          {label}
          {isActive ? (
            sortDirection === 'asc' 
              ? <ChevronUp className="h-4 w-4" />
              : <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />
          )}
        </div>
      </TableHead>
    );
  };

  const isLoading = cptLoading || tenantLoading;

  if (isLoading && !currentState) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>CPT Code Management</CardTitle>
        <CardDescription>
          Configure which CPT codes your clinic uses and set custom pricing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Available CPT Codes Section */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <h3 className="text-lg font-medium">Available CPT Codes</h3>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={availableCodes.length === 0}
              >
                Select All
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {availableCodes.length} available codes
          </div>

          <div className="border rounded-lg max-h-[300px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableCodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "No CPT codes match your search." : "All codes have been selected."}
                    </TableCell>
                  </TableRow>
                ) : (
                  availableCodes.map((item) => (
                    <TableRow key={item.cpt_code_id}>
                      <TableCell>
                        <Checkbox
                          checked={false}
                          onCheckedChange={() => handleToggle(item.cpt_code_id, true)}
                          aria-label={`Select ${item.code}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono font-medium">{item.code}</TableCell>
                      <TableCell className="max-w-md truncate" title={item.description}>
                        {item.description}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Selected CPT Codes Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-medium">Selected CPT Codes</h3>
            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {selectedCodes.length} codes
            </span>
          </div>

          <div className="border rounded-lg max-h-[400px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <SortableHeader column="code" label="Code" className="w-24" />
                  <SortableHeader column="description" label="Description" />
                  <SortableHeader column="custom_rate" label="Price" className="w-40" />
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedCodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No CPT codes selected. Select codes from the list above.
                    </TableCell>
                  </TableRow>
                ) : (
                  selectedCodes.map((item) => (
                    <TableRow key={item.cpt_code_id}>
                      <TableCell className="font-mono font-medium">{item.code}</TableCell>
                      <TableCell className="max-w-md truncate" title={item.description}>
                        {item.description}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={item.custom_rate ?? ""}
                            onChange={(e) => handlePriceChange(item.cpt_code_id, e.target.value)}
                            className="w-28 text-right h-8"
                            placeholder="0"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemove(item.cpt_code_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          {hasUnsavedChanges ? (
            <div className="text-sm text-amber-600 dark:text-amber-400">
              You have unsaved changes.
            </div>
          ) : (
            <div />
          )}
          
          <Button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
