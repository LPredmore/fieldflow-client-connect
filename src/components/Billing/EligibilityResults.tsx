import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import { EligibilityResponse } from '@/hooks/data/useInsuranceEligibility';

interface EligibilityResultsProps {
  results: EligibilityResponse;
}

export const EligibilityResults = ({ results }: EligibilityResultsProps) => {
  const getStatusIcon = () => {
    switch (results.status) {
      case 'active':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'inactive':
        return <XCircle className="h-6 w-6 text-red-500" />;
      case 'pending':
        return <Clock className="h-6 w-6 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-6 w-6 text-red-500" />;
    }
  };

  const getStatusBadge = () => {
    const config = {
      active: { variant: 'default' as const, className: 'bg-green-600' },
      inactive: { variant: 'destructive' as const, className: '' },
      pending: { variant: 'secondary' as const, className: 'bg-yellow-600' },
      error: { variant: 'destructive' as const, className: '' },
    };
    const { variant, className } = config[results.status];
    return (
      <Badge variant={variant} className={className}>
        {results.status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Eligibility Verification Results
          </CardTitle>
          {getStatusBadge()}
        </div>
        <p className="text-sm text-muted-foreground">
          Verified at: {new Date(results.verified_at).toLocaleString()}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {results.status === 'active' && results.coverage_details && (
          <>
            <div>
              <h3 className="font-semibold mb-2">Coverage Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Plan Name:</span>
                  <p className="font-medium">{results.coverage_details.plan_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Effective Date:</span>
                  <p className="font-medium">{results.coverage_details.effective_date}</p>
                </div>
                {results.coverage_details.termination_date && (
                  <div>
                    <span className="text-muted-foreground">Termination Date:</span>
                    <p className="font-medium">{results.coverage_details.termination_date}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Financial Responsibility</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {results.coverage_details.copay !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Copay:</span>
                    <p className="font-medium">${results.coverage_details.copay}</p>
                  </div>
                )}
                {results.coverage_details.deductible !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Deductible:</span>
                    <p className="font-medium">
                      ${results.coverage_details.deductible_met || 0} / ${results.coverage_details.deductible}
                    </p>
                  </div>
                )}
                {results.coverage_details.out_of_pocket_max !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Out-of-Pocket Max:</span>
                    <p className="font-medium">
                      ${results.coverage_details.out_of_pocket_met || 0} / ${results.coverage_details.out_of_pocket_max}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {results.benefits && results.benefits.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Covered Benefits</h3>
                  <div className="space-y-2">
                    {results.benefits.map((benefit, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">{benefit.service_type}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{benefit.coverage_level}</Badge>
                          {benefit.authorization_required && (
                            <Badge variant="secondary" className="bg-yellow-600">Auth Required</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {results.status === 'error' && (
          <div className="p-4 bg-destructive/10 rounded text-destructive">
            <p className="font-semibold">Error:</p>
            <p className="text-sm">{results.error_message}</p>
          </div>
        )}

        {results.status === 'inactive' && (
          <div className="p-4 bg-yellow-500/10 rounded text-yellow-700 dark:text-yellow-300">
            <p className="font-semibold">Coverage Inactive</p>
            <p className="text-sm">This insurance policy is not currently active. Please verify with the patient.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
