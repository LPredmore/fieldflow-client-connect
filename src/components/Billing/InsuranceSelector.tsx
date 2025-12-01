import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface InsuranceSelectorProps {
  customerId: string;
  value: string | null;
  onChange: (value: string) => void;
}

interface InsurancePolicy {
  id: string;
  payer_name: string;
  insurance_type: string;
  verification_status: string | null;
}

export const InsuranceSelector = ({ customerId, value, onChange }: InsuranceSelectorProps) => {
  const [insurancePolicies, setInsurancePolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsurance = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('insurance_information')
        .select('id, payer_name, insurance_type, verification_status')
        .eq('customer_id', customerId)
        .eq('is_active', true)
        .order('insurance_type', { ascending: true });

      if (!error && data) {
        setInsurancePolicies(data);
      }
      setLoading(false);
    };

    fetchInsurance();
  }, [customerId]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading insurance policies...</div>;
  }

  if (insurancePolicies.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No active insurance policies found for this patient
      </div>
    );
  }

  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select insurance policy" />
      </SelectTrigger>
      <SelectContent>
        {insurancePolicies.map((policy) => (
          <SelectItem key={policy.id} value={policy.id}>
            <div className="flex items-center gap-2">
              <span>{policy.payer_name}</span>
              <Badge variant="secondary" className="text-xs capitalize">
                {policy.insurance_type}
              </Badge>
              {policy.verification_status === 'verified' && (
                <Badge variant="default" className="text-xs bg-green-600">✓ Verified</Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
