import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, AlertCircle, Calendar, User, Building } from 'lucide-react';
import { ClientInsurance } from '@/hooks/useClientDetail';

interface ClientInsuranceTabProps {
  loading: boolean;
  insurance: ClientInsurance[];
}

export function ClientInsuranceTab({ loading, insurance }: ClientInsuranceTabProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (insurance.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium text-foreground">No Insurance Records</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No insurance information has been added for this client yet.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getPriorityLabel = (order: number) => {
    switch (order) {
      case 1: return 'Primary';
      case 2: return 'Secondary';
      case 3: return 'Tertiary';
      default: return `Priority ${order}`;
    }
  };

  const getPriorityColor = (order: number) => {
    switch (order) {
      case 1: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 2: return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {insurance.map((policy) => (
        <Card key={policy.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                {policy.payer_name || 'Unknown Payer'}
              </CardTitle>
              <div className="flex gap-2">
                <Badge className={getPriorityColor(policy.payer_order)}>
                  {getPriorityLabel(policy.payer_order)}
                </Badge>
                {policy.is_active ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Policy Details */}
              {policy.member_id && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Member ID</p>
                  <p className="font-medium font-mono">{policy.member_id}</p>
                </div>
              )}
              {policy.group_number && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Group Number</p>
                  <p className="font-medium font-mono">{policy.group_number}</p>
                </div>
              )}
              {policy.plan_name && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Plan Name</p>
                  <p className="font-medium">{policy.plan_name}</p>
                </div>
              )}

              {/* Subscriber Info */}
              {policy.subscriber_name && (
                <div className="space-y-1 flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Subscriber</p>
                    <p className="font-medium">{policy.subscriber_name}</p>
                    {policy.subscriber_relationship && (
                      <p className="text-sm text-muted-foreground">
                        ({policy.subscriber_relationship})
                      </p>
                    )}
                  </div>
                </div>
              )}
              {policy.subscriber_dob && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Subscriber DOB</p>
                  <p className="font-medium">
                    {format(new Date(policy.subscriber_dob), 'MMM d, yyyy')}
                  </p>
                </div>
              )}

              {/* Dates */}
              {policy.effective_date && (
                <div className="space-y-1 flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Effective Date</p>
                    <p className="font-medium">
                      {format(new Date(policy.effective_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              )}
              {policy.termination_date && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Termination Date</p>
                  <p className="font-medium">
                    {format(new Date(policy.termination_date), 'MMM d, yyyy')}
                  </p>
                </div>
              )}

              {/* Financial */}
              {policy.copay_amount !== null && policy.copay_amount !== undefined && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Copay</p>
                  <p className="font-medium">${policy.copay_amount.toFixed(2)}</p>
                </div>
              )}
              {policy.deductible_amount !== null && policy.deductible_amount !== undefined && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Deductible</p>
                  <p className="font-medium">${policy.deductible_amount.toFixed(2)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
