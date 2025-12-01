import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CustomerSelector } from '@/components/Customers/CustomerSelector';
import { InsuranceSelector } from '@/components/Billing/InsuranceSelector';
import { EligibilityResults } from '@/components/Billing/EligibilityResults';
import { useInsuranceEligibility, EligibilityResponse } from '@/hooks/data/useInsuranceEligibility';
import { CheckCircle } from 'lucide-react';

const EligibilityCheck = () => {
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedInsurance, setSelectedInsurance] = useState<string | null>(null);
  const [results, setResults] = useState<EligibilityResponse | null>(null);
  const { checkEligibility, loading } = useInsuranceEligibility();

  const handleCustomerSelect = (customerId: string, customerName: string) => {
    setSelectedCustomer(customerId);
    setSelectedInsurance(null); // Reset insurance when customer changes
  };

  const handleCheck = async () => {
    if (!selectedCustomer || !selectedInsurance) return;

    const response = await checkEligibility({
      customer_id: selectedCustomer,
      insurance_id: selectedInsurance,
      service_date: new Date().toISOString().split('T')[0],
    });

    setResults(response);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <CheckCircle className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Insurance Eligibility Check</h1>
          <p className="text-muted-foreground">
            Verify patient insurance eligibility in real-time
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Patient & Insurance</CardTitle>
          <CardDescription>
            Choose a patient and their insurance policy to check eligibility
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Patient</label>
            <CustomerSelector
              value={selectedCustomer || undefined}
              onValueChange={handleCustomerSelect}
            />
          </div>

          {selectedCustomer && (
            <div>
              <label className="text-sm font-medium mb-2 block">Insurance Policy</label>
              <InsuranceSelector
                customerId={selectedCustomer}
                value={selectedInsurance}
                onChange={setSelectedInsurance}
              />
            </div>
          )}

          <Button
            onClick={handleCheck}
            disabled={!selectedCustomer || !selectedInsurance || loading}
            size="lg"
            className="w-full"
          >
            {loading ? 'Checking Eligibility...' : 'Check Eligibility'}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <EligibilityResults results={results} />
      )}
    </div>
  );
};

export default EligibilityCheck;
