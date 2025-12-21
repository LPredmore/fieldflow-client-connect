import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';

export interface ClientDiagnosis {
  id: string;
  tenant_id: string;
  client_id: string;
  diagnosis_code_id: string;
  is_active: boolean;
  is_primary: boolean;
  added_at: string;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined from diagnosis_codes
  diagnosis_code?: {
    id: string;
    code: string;
    description: string;
    system: string;
    is_active: boolean;
    is_billable: boolean;
  };
}

export function useClientDiagnoses(clientId: string | undefined) {
  const { tenantId } = useAuth();

  const {
    data: diagnoses,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<ClientDiagnosis>({
    table: 'client_diagnoses',
    select: '*, diagnosis_code:diagnosis_codes(id, code, description, system, is_active, is_billable)',
    filters: {
      tenant_id: 'auto',
      client_id: clientId,
      is_active: true,
    },
    orderBy: { column: 'is_primary', ascending: false },
    enabled: !!clientId && !!tenantId,
  });

  // Get diagnoses as formatted strings for display
  const formattedDiagnoses = diagnoses?.map(d => {
    if (d.diagnosis_code) {
      return `${d.diagnosis_code.code} - ${d.diagnosis_code.description}`;
    }
    return 'Unknown diagnosis';
  }) || [];

  // Get diagnosis codes as array of strings (for snapshot in session notes)
  const diagnosisCodes = diagnoses?.map(d => d.diagnosis_code?.code).filter(Boolean) as string[] || [];

  // Get primary diagnosis
  const primaryDiagnosis = diagnoses?.find(d => d.is_primary) || null;

  return {
    diagnoses: diagnoses || [],
    formattedDiagnoses,
    diagnosisCodes,
    primaryDiagnosis,
    loading,
    error,
    refetch,
  };
}
