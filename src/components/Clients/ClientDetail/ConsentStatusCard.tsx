import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ConsentStatus } from '@/hooks/useClientConsentStatus';

interface ConsentStatusCardProps {
  consentStatuses: ConsentStatus[];
  loading: boolean;
  signedCount: number;
  requiredCount: number;
  isFullyCompliant: boolean;
}

export function ConsentStatusCard({
  consentStatuses,
  loading,
  signedCount,
  requiredCount,
  isFullyCompliant,
}: ConsentStatusCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Consent Status
          </CardTitle>
          <Badge 
            variant={isFullyCompliant ? 'default' : 'destructive'}
            className={isFullyCompliant 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
              : ''
            }
          >
            {signedCount}/{requiredCount} Required
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {consentStatuses.map((status) => (
            <ConsentStatusRow key={status.consent.key} status={status} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface ConsentStatusRowProps {
  status: ConsentStatus;
}

function ConsentStatusRow({ status }: ConsentStatusRowProps) {
  const { consent, isSigned, signedAt, isRevoked } = status;

  const getStatusIcon = () => {
    if (isRevoked) {
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    }
    if (isSigned) {
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    }
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const getStatusBadge = () => {
    if (isRevoked) {
      return (
        <Badge variant="outline" className="text-warning border-warning/30">
          Revoked
        </Badge>
      );
    }
    if (isSigned && signedAt) {
      return (
        <Badge variant="outline" className="text-success border-success/30">
          Signed {format(new Date(signedAt), 'MMM d, yyyy')}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-destructive border-destructive/30">
        Not Signed
      </Badge>
    );
  };

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-3">
        {getStatusIcon()}
        <div>
          <p className="text-sm font-medium">{consent.label}</p>
          {!consent.required && consent.requiredFor && (
            <p className="text-xs text-muted-foreground">
              Required for {consent.requiredFor}
            </p>
          )}
        </div>
      </div>
      {getStatusBadge()}
    </div>
  );
}
