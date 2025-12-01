import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { InsuranceFormData, InsurancePolicy } from '@/types/insurance';

// Helper function to upload insurance card image to storage
async function uploadInsuranceCardImage(
  customerId: string,
  file: File,
  side: 'front' | 'back'
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${customerId}/${side}_${Date.now()}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from('insurance-cards')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('insurance-cards')
    .getPublicUrl(data.path);

  return publicUrl;
}

// Helper function to delete insurance card image from storage
async function deleteInsuranceCardImage(url: string): Promise<void> {
  if (!url) return;
  
  const path = url.split('/insurance-cards/')[1];
  if (!path) return;

  await supabase.storage
    .from('insurance-cards')
    .remove([path]);
}

export function useInsuranceManagement(customerId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch insurance policies
  const { data: policies, isLoading, error, refetch } = useQuery({
    queryKey: ['insurance', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('insurance_information')
        .select('*')
        .eq('customer_id', customerId)
        .eq('is_active', true)
        .order('insurance_type', { ascending: true });
      
      if (error) throw error;
      return data as InsurancePolicy[];
    },
    enabled: !!customerId,
  });

  // Add insurance
  const addInsurance = useMutation({
    mutationFn: async (insuranceData: Omit<InsuranceFormData, 'same_as_client'> & { customer_id: string; tenant_id: string }) => {
      const { same_as_client, insurance_card_front, insurance_card_back, ...data } = insuranceData as any;
      
      // Upload insurance card images if provided
      let frontUrl: string | null = null;
      let backUrl: string | null = null;
      
      if (insurance_card_front instanceof File) {
        frontUrl = await uploadInsuranceCardImage(data.customer_id, insurance_card_front, 'front');
      }
      
      if (insurance_card_back instanceof File) {
        backUrl = await uploadInsuranceCardImage(data.customer_id, insurance_card_back, 'back');
      }
      
      const { data: inserted, error } = await supabase
        .from('insurance_information')
        .insert({
          ...data,
          ins_phone: data.ins_phone ? parseFloat(data.ins_phone.replace(/\D/g, '')) : null,
          insurance_card_front_url: frontUrl,
          insurance_card_back_url: backUrl,
        })
        .select()
        .single();
      
      if (error) throw error;
      return inserted;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance', customerId] });
      toast({
        title: 'Insurance Added',
        description: 'Your insurance information has been saved successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save insurance information',
        variant: 'destructive',
      });
    },
  });

  // Update insurance
  const updateInsurance = useMutation({
    mutationFn: async ({ id, data, existingPolicy }: { id: string; data: Partial<InsuranceFormData> & { customer_id: string; tenant_id: string }; existingPolicy?: InsurancePolicy }) => {
      const { same_as_client, insurance_card_front, insurance_card_back, ...updateData } = data as any;
      
      // Upload new insurance card images if provided
      let frontUrl: string | null | undefined = undefined;
      let backUrl: string | null | undefined = undefined;
      
      if (insurance_card_front instanceof File) {
        // Delete old front image if exists
        if (existingPolicy?.insurance_card_front_url) {
          await deleteInsuranceCardImage(existingPolicy.insurance_card_front_url);
        }
        frontUrl = await uploadInsuranceCardImage(updateData.customer_id, insurance_card_front, 'front');
      }
      
      if (insurance_card_back instanceof File) {
        // Delete old back image if exists
        if (existingPolicy?.insurance_card_back_url) {
          await deleteInsuranceCardImage(existingPolicy.insurance_card_back_url);
        }
        backUrl = await uploadInsuranceCardImage(updateData.customer_id, insurance_card_back, 'back');
      }
      
      const { data: updated, error } = await supabase
        .from('insurance_information')
        .update({
          ...updateData,
          ins_phone: updateData.ins_phone ? parseFloat(updateData.ins_phone.replace(/\D/g, '')) : null,
          ...(frontUrl !== undefined && { insurance_card_front_url: frontUrl }),
          ...(backUrl !== undefined && { insurance_card_back_url: backUrl }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance', customerId] });
      toast({
        title: 'Insurance Updated',
        description: 'Your insurance information has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update insurance information',
        variant: 'destructive',
      });
    },
  });

  // Deactivate insurance (soft delete)
  const deactivateInsurance = useMutation({
    mutationFn: async (insuranceId: string) => {
      const { error } = await supabase
        .from('insurance_information')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', insuranceId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance', customerId] });
      toast({
        title: 'Insurance Removed',
        description: 'The insurance policy has been removed.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove insurance',
        variant: 'destructive',
      });
    },
  });

  return {
    policies,
    isLoading,
    error,
    refetch,
    addInsurance: addInsurance.mutateAsync,
    updateInsurance: updateInsurance.mutateAsync,
    deactivateInsurance: deactivateInsurance.mutateAsync,
    isAdding: addInsurance.isPending,
    isUpdating: updateInsurance.isPending,
    isDeactivating: deactivateInsurance.isPending,
  };
}
