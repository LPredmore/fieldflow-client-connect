/**
 * useStaffLicenses Hook
 * CRUD operations for staff_licenses table - the single source of truth for all license data
 */

import { useMemo, useCallback } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';

type StateCodeEnum = Database['public']['Enums']['state_code_enum'];

export interface StaffLicense {
  id: string;
  tenant_id: string;
  staff_id: string;
  license_type: string;
  license_number: string;
  license_state: StateCodeEnum;
  issue_date: string | null;
  expiration_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateLicenseData {
  staff_id: string;
  license_type: string;
  license_number: string;
  license_state: StateCodeEnum;
  issue_date?: string | null;
  expiration_date?: string | null;
  is_active?: boolean;
}

export interface UpdateLicenseData {
  license_type?: string;
  license_number?: string;
  license_state?: StateCodeEnum;
  issue_date?: string | null;
  expiration_date?: string | null;
  is_active?: boolean;
}

interface UseStaffLicensesOptions {
  staffId?: string;
  enabled?: boolean;
}

export function useStaffLicenses(options: UseStaffLicensesOptions = {}) {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { staffId, enabled = true } = options;

  const {
    data: licenses,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<StaffLicense>({
    table: 'staff_licenses',
    filters: staffId ? { staff_id: staffId } : undefined,
    enabled: enabled && !!staffId,
    orderBy: { column: 'license_state', ascending: true },
    onError: (err) => {
      console.error('Error loading staff licenses:', err);
    },
  });

  const createLicense = useCallback(async (data: CreateLicenseData) => {
    if (!tenantId) {
      return { error: 'No tenant ID found' };
    }

    try {
      const { data: newLicense, error: insertError } = await supabase
        .from('staff_licenses')
        .insert({
          tenant_id: tenantId,
          staff_id: data.staff_id,
          license_type: data.license_type,
          license_number: data.license_number,
          license_state: data.license_state,
          issue_date: data.issue_date || null,
          expiration_date: data.expiration_date || null,
          is_active: data.is_active ?? true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ['staff_licenses'] });
      
      toast({
        title: 'License added',
        description: `License for ${data.license_state} has been added successfully.`,
      });

      return { data: newLicense };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create license';
      toast({
        title: 'Error adding license',
        description: errorMessage,
        variant: 'destructive',
      });
      return { error: errorMessage };
    }
  }, [tenantId, queryClient, toast]);

  const createMultipleLicenses = useCallback(async (licenses: CreateLicenseData[]) => {
    if (!tenantId) {
      return { error: 'No tenant ID found' };
    }

    try {
      const licensesToInsert = licenses.map(lic => ({
        tenant_id: tenantId,
        staff_id: lic.staff_id,
        license_type: lic.license_type,
        license_number: lic.license_number,
        license_state: lic.license_state,
        issue_date: lic.issue_date || null,
        expiration_date: lic.expiration_date || null,
        is_active: lic.is_active ?? true,
      }));

      const { data: newLicenses, error: insertError } = await supabase
        .from('staff_licenses')
        .insert(licensesToInsert)
        .select();

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ['staff_licenses'] });

      return { data: newLicenses };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create licenses';
      return { error: errorMessage };
    }
  }, [tenantId, queryClient]);

  const updateLicense = useCallback(async (licenseId: string, data: UpdateLicenseData) => {
    try {
      const { data: updatedLicense, error: updateError } = await supabase
        .from('staff_licenses')
        .update(data)
        .eq('id', licenseId)
        .select()
        .single();

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['staff_licenses'] });
      
      toast({
        title: 'License updated',
        description: 'License information has been updated successfully.',
      });

      return { data: updatedLicense };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update license';
      toast({
        title: 'Error updating license',
        description: errorMessage,
        variant: 'destructive',
      });
      return { error: errorMessage };
    }
  }, [queryClient, toast]);

  const deleteLicense = useCallback(async (licenseId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('staff_licenses')
        .delete()
        .eq('id', licenseId);

      if (deleteError) throw deleteError;

      queryClient.invalidateQueries({ queryKey: ['staff_licenses'] });
      
      toast({
        title: 'License removed',
        description: 'License has been removed successfully.',
      });

      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete license';
      toast({
        title: 'Error removing license',
        description: errorMessage,
        variant: 'destructive',
      });
      return { error: errorMessage };
    }
  }, [queryClient, toast]);

  const memoizedLicenses = useMemo(() => licenses ?? [], [licenses]);

  return {
    licenses: memoizedLicenses,
    loading,
    error,
    refetch,
    createLicense,
    createMultipleLicenses,
    updateLicense,
    deleteLicense,
  };
}
