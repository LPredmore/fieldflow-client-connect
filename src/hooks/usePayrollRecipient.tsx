import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type StateCodeEnum = Database['public']['Enums']['state_code_enum'];

export interface PayrollRecipient {
  id: string;
  tenant_id: string;
  staff_id: string;
  recipient_name: string | null;
  deposit_addr_1: string | null;
  deposit_addr_2: string | null;
  deposit_city: string | null;
  deposit_state: StateCodeEnum | null;
  deposit_zip: string | null;
  routing_number_last4: string | null;
  account_number_last4: string | null;
  account_type: string | null;
  is_active: boolean;
}

export interface PayrollFormData {
  recipient_name: string;
  deposit_addr_1: string;
  deposit_addr_2: string;
  deposit_city: string;
  deposit_state: string;
  deposit_zip: string;
  routing_number: string;
  account_number: string;
  account_type: string;
}

export function usePayrollRecipient(staffId: string | undefined) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payrollRecipient, setPayrollRecipient] = useState<PayrollRecipient | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch payroll recipient data
  useEffect(() => {
    async function fetchPayrollRecipient() {
      if (!staffId || !user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('payroll_recipients')
          .select('id, tenant_id, staff_id, recipient_name, deposit_addr_1, deposit_addr_2, deposit_city, deposit_state, deposit_zip, routing_number_last4, account_number_last4, account_type, is_active')
          .eq('staff_id', staffId)
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          console.error('Error fetching payroll recipient:', error);
        } else {
          setPayrollRecipient(data);
        }
      } catch (err) {
        console.error('Unexpected error fetching payroll recipient:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPayrollRecipient();
  }, [staffId, user]);

  // Upsert payroll recipient
  const upsertPayrollRecipient = async (formData: PayrollFormData, tenantId: string) => {
    if (!staffId || !user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Staff information not available',
      });
      return { error: new Error('Staff information not available') };
    }

    setSaving(true);

    try {
      // Prepare the data for upsert
      const upsertData = {
        staff_id: staffId,
        tenant_id: tenantId,
        recipient_name: formData.recipient_name || null,
        deposit_addr_1: formData.deposit_addr_1 || null,
        deposit_addr_2: formData.deposit_addr_2 || null,
        deposit_city: formData.deposit_city || null,
        deposit_state: (formData.deposit_state || null) as StateCodeEnum | null,
        deposit_zip: formData.deposit_zip || null,
        routing_number_encrypted: formData.routing_number || null,
        account_number_encrypted: formData.account_number || null,
        routing_number_last4: formData.routing_number ? formData.routing_number.slice(-4) : null,
        account_number_last4: formData.account_number ? formData.account_number.slice(-4) : null,
        account_type: formData.account_type || null,
        is_active: true,
      };

      let result;

      if (payrollRecipient?.id) {
        // Update existing record
        result = await supabase
          .from('payroll_recipients')
          .update(upsertData)
          .eq('id', payrollRecipient.id)
          .select('id, tenant_id, staff_id, recipient_name, deposit_addr_1, deposit_addr_2, deposit_city, deposit_state, deposit_zip, routing_number_last4, account_number_last4, account_type, is_active')
          .single();
      } else {
        // Insert new record
        result = await supabase
          .from('payroll_recipients')
          .insert(upsertData)
          .select('id, tenant_id, staff_id, recipient_name, deposit_addr_1, deposit_addr_2, deposit_city, deposit_state, deposit_zip, routing_number_last4, account_number_last4, account_type, is_active')
          .single();
      }

      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Error saving direct deposit information',
          description: result.error.message,
        });
        return { error: result.error };
      }

      setPayrollRecipient(result.data);
      toast({
        title: 'Direct deposit information saved',
        description: 'Your bank account information has been updated successfully.',
      });

      return { data: result.data, error: null };
    } catch (err) {
      const error = err as Error;
      toast({
        variant: 'destructive',
        title: 'Unexpected error',
        description: error.message,
      });
      return { error };
    } finally {
      setSaving(false);
    }
  };

  return {
    payrollRecipient,
    loading,
    saving,
    upsertPayrollRecipient,
  };
}
