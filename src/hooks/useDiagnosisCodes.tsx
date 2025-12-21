import { useState, useMemo, useCallback } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface DiagnosisCode {
  id: string;
  code: string;
  description: string;
  system: string;
  is_active: boolean;
  is_billable: boolean;
  created_at: string;
  updated_at: string;
}

export function useDiagnosisCodes() {
  const [searchTerm, setSearchTerm] = useState('');

  const {
    data: codes,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<DiagnosisCode>({
    table: 'diagnosis_codes',
    select: '*',
    filters: {
      is_active: true,
    },
    orderBy: { column: 'code', ascending: true },
    enabled: true,
  });

  // Filter codes based on search term
  const filteredCodes = useMemo(() => {
    if (!codes) return [];
    if (!searchTerm.trim()) return codes;

    const search = searchTerm.toLowerCase();
    return codes.filter(code => 
      code.code.toLowerCase().includes(search) ||
      code.description.toLowerCase().includes(search)
    );
  }, [codes, searchTerm]);

  return {
    codes: codes || [],
    filteredCodes,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    refetch,
  };
}

// Hook to manage diagnoses for a specific client (add/remove)
export function useManageClientDiagnoses(clientId: string | undefined) {
  const { tenantId } = useAuth();

  const addDiagnosis = useCallback(async (diagnosisCodeId: string, isPrimary: boolean = false) => {
    if (!clientId || !tenantId) {
      toast({
        title: "Error",
        description: "Missing required data",
        variant: "destructive",
      });
      return { error: new Error("Missing required data") };
    }

    try {
      // If setting as primary, first unset any existing primary
      if (isPrimary) {
        await supabase
          .from('client_diagnoses')
          .update({ is_primary: false })
          .eq('client_id', clientId)
          .eq('is_primary', true);
      }

      const { error } = await supabase
        .from('client_diagnoses')
        .insert({
          tenant_id: tenantId,
          client_id: clientId,
          diagnosis_code_id: diagnosisCodeId,
          is_active: true,
          is_primary: isPrimary,
          added_at: new Date().toISOString().split('T')[0],
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Diagnosis added successfully",
      });

      return { error: null };
    } catch (err) {
      console.error('Error adding diagnosis:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to add diagnosis",
        variant: "destructive",
      });
      return { error: err };
    }
  }, [clientId, tenantId]);

  const removeDiagnosis = useCallback(async (diagnosisId: string) => {
    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('client_diagnoses')
        .update({ 
          is_active: false,
          resolved_at: new Date().toISOString().split('T')[0],
        })
        .eq('id', diagnosisId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Diagnosis removed",
      });

      return { error: null };
    } catch (err) {
      console.error('Error removing diagnosis:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to remove diagnosis",
        variant: "destructive",
      });
      return { error: err };
    }
  }, []);

  const setPrimaryDiagnosis = useCallback(async (diagnosisId: string) => {
    if (!clientId) return { error: new Error("No client ID") };

    try {
      // Unset all primary diagnoses for this client
      await supabase
        .from('client_diagnoses')
        .update({ is_primary: false })
        .eq('client_id', clientId)
        .eq('is_primary', true);

      // Set the new primary
      const { error } = await supabase
        .from('client_diagnoses')
        .update({ is_primary: true })
        .eq('id', diagnosisId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Primary diagnosis updated",
      });

      return { error: null };
    } catch (err) {
      console.error('Error setting primary diagnosis:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update primary diagnosis",
        variant: "destructive",
      });
      return { error: err };
    }
  }, [clientId]);

  return {
    addDiagnosis,
    removeDiagnosis,
    setPrimaryDiagnosis,
  };
}
