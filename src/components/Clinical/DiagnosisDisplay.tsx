import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';
import { useClientDiagnoses, ClientDiagnosis } from '@/hooks/useClientDiagnoses';
import { Skeleton } from '@/components/ui/skeleton';

interface DiagnosisDisplayProps {
  clientId: string | undefined;
  showPrimaryIndicator?: boolean;
  className?: string;
}

export function DiagnosisDisplay({
  clientId,
  showPrimaryIndicator = true,
  className = '',
}: DiagnosisDisplayProps) {
  const { diagnoses, loading, error } = useClientDiagnoses(clientId);

  if (loading) {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-40" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">Unable to load diagnoses</p>
    );
  }

  if (diagnoses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No diagnoses assigned</p>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {diagnoses.map((diagnosis) => (
        <Badge
          key={diagnosis.id}
          variant={diagnosis.is_primary ? "default" : "secondary"}
          className="flex items-center gap-1.5 py-1 px-2"
        >
          {showPrimaryIndicator && diagnosis.is_primary && (
            <Star className="h-3 w-3 fill-current" />
          )}
          <span className="font-medium">
            {diagnosis.diagnosis_code?.code || 'Unknown'}
          </span>
          <span className="text-xs opacity-80">
            - {diagnosis.diagnosis_code?.description || 'Unknown diagnosis'}
          </span>
        </Badge>
      ))}
    </div>
  );
}

// Simpler inline display for compact spaces
interface DiagnosisListProps {
  diagnoses: ClientDiagnosis[];
  variant?: 'badges' | 'text';
}

export function DiagnosisList({ diagnoses, variant = 'badges' }: DiagnosisListProps) {
  if (diagnoses.length === 0) {
    return <span className="text-muted-foreground">No diagnoses</span>;
  }

  if (variant === 'text') {
    return (
      <span>
        {diagnoses.map((d, i) => (
          <span key={d.id}>
            {d.diagnosis_code?.code}
            {i < diagnoses.length - 1 && ', '}
          </span>
        ))}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {diagnoses.map((diagnosis) => (
        <Badge
          key={diagnosis.id}
          variant={diagnosis.is_primary ? "default" : "outline"}
          className="text-xs"
        >
          {diagnosis.diagnosis_code?.code}
        </Badge>
      ))}
    </div>
  );
}
