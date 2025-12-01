import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EligibilityRequest {
  customer_id: string;
  insurance_id: string;
  service_date?: string;
  service_type?: string;
}

export interface EligibilityResponse {
  status: 'active' | 'inactive' | 'pending' | 'error';
  coverage_details?: {
    plan_name: string;
    effective_date: string;
    termination_date?: string;
    copay?: number;
    deductible?: number;
    deductible_met?: number;
    out_of_pocket_max?: number;
    out_of_pocket_met?: number;
  };
  benefits?: Array<{
    service_type: string;
    coverage_level: string;
    authorization_required: boolean;
  }>;
  error_message?: string;
  verified_at: string;
}

export function useInsuranceEligibility() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const checkEligibility = async (request: EligibilityRequest): Promise<EligibilityResponse | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-insurance-eligibility', {
        body: request,
      });

      if (error) throw error;

      await supabase
        .from('insurance_information')
        .update({
          verified_date: new Date().toISOString(),
          verification_status: data.status === 'active' ? 'verified' : 'failed',
          verification_notes: data.error_message || 'Eligibility verified successfully',
        })
        .eq('id', request.insurance_id);

      toast({
        title: 'Eligibility Check Complete',
        description: `Status: ${data.status}`,
      });

      return data;
    } catch (error: any) {
      console.error('Eligibility check failed:', error);
      toast({
        title: 'Eligibility Check Failed',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    checkEligibility,
    loading,
  };
}
