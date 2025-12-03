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
import { Loader2, Search, Save } from "lucide-react";
import { useCptCodes } from "@/hooks/useCptCodes";
import { useTenantCptCodes } from "@/hooks/useTenantCptCodes";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

export default function ClinicalSettings() {
  const { cptCodes, loading: cptLoading } = useCptCodes();
  const { tenantCptCodes, loading: tenantLoading, refetch, tenantId } = useTenantCptCodes();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [localState, setLocalState] = useState<CptCodeState[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  // Filter by search term
  const filteredState = useMemo(() => {
    if (!currentState) return [];
    if (!searchTerm.trim()) return currentState;
    
    const term = searchTerm.toLowerCase();
    return currentState.filter(
      item => item.code.toLowerCase().includes(term) || 
              item.description.toLowerCase().includes(term)
    );
  }, [currentState, searchTerm]);

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
    const allVisibleEnabled = filteredState.every(item => item.is_enabled);
    const newValue = !allVisibleEnabled;
    
    const visibleIds = new Set(filteredState.map(item => item.cpt_code_id));
    
    setLocalState(prev => {
      if (!prev) return prev;
      return prev.map(item => 
        visibleIds.has(item.cpt_code_id)
          ? { ...item, is_enabled: newValue }
          : item
      );
    });
  }, [filteredState]);

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

  const isLoading = cptLoading || tenantLoading;
  const allVisibleEnabled = filteredState.length > 0 && filteredState.every(item => item.is_enabled);
  const someVisibleEnabled = filteredState.some(item => item.is_enabled);

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
          Configure which CPT codes your clinic uses and set default pricing (in whole dollars)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={filteredState.length === 0}
            >
              {allVisibleEnabled ? "Deselect All" : "Select All"}
            </Button>
            
            <Button
              size="sm"
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
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredState.length} of {currentState?.length ?? 0} CPT codes
          {someVisibleEnabled && ` • ${filteredState.filter(i => i.is_enabled).length} enabled in view`}
        </div>

        {/* CPT Codes Table */}
        <div className="border rounded-lg max-h-[500px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allVisibleEnabled}
                    onCheckedChange={() => handleSelectAll()}
                    disabled={filteredState.length === 0}
                    aria-label="Select all visible"
                  />
                </TableHead>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-32">Category</TableHead>
                <TableHead className="w-32 text-right">Default Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredState.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "No CPT codes match your search." : "No CPT codes available."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredState.map((item) => (
                  <TableRow key={item.cpt_code_id}>
                    <TableCell>
                      <Checkbox
                        checked={item.is_enabled}
                        onCheckedChange={(checked) => handleToggle(item.cpt_code_id, !!checked)}
                        aria-label={`Enable ${item.code}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono font-medium">{item.code}</TableCell>
                    <TableCell className="max-w-md truncate" title={item.description}>
                      {item.description}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.category ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-muted-foreground">$</span>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={item.custom_rate ?? ""}
                          onChange={(e) => handlePriceChange(item.cpt_code_id, e.target.value)}
                          disabled={!item.is_enabled}
                          className="w-20 text-right h-8"
                          placeholder="0"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {hasUnsavedChanges && (
          <div className="text-sm text-amber-600 dark:text-amber-400">
            You have unsaved changes.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
