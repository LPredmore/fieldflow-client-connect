import { useEffect } from 'react';
import { useClientData } from '@/contexts/ClientDataContext';
import { Clinician } from './useClinician';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

interface AvailableClinicianWithProfile extends Clinician {
  profiles?: {
    first_name: string | null;
    last_name: string | null;
  };
  licenses?: Array<{
    state: string;
    license_type: string;
    license_number: string;
    expiration_date: string;
  }>;
}

export function useAvailableClinicians() {
  const { profile } = useClientData();
  const clientState = profile?.state;
  const [clinicians, setClinicians] = useState<AvailableClinicianWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchClinicians = async () => {
    if (!clientState) {
      setClinicians([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Query clinicians with JOIN to clinician_licenses for state filtering
      const { data, error: queryError } = await supabase
        .from('clinicians')
        .select(`
          *,
          profiles!inner(first_name, last_name),
          clinician_licenses!inner(
            state,
            license_type,
            license_number,
            expiration_date,
            is_active
          )
        `)
        .eq('clinician_accepting_new_clients', 'Yes')
        .eq('clinician_status', 'Active')
        .eq('clinician_licenses.state', clientState)
        .eq('clinician_licenses.is_active', true)
        .gte('clinician_licenses.expiration_date', new Date().toISOString().split('T')[0]);

      if (queryError) throw queryError;

      // Transform data to group licenses per clinician
      const cliniciansMap = new Map<string, AvailableClinicianWithProfile>();
      
      data?.forEach((row: any) => {
        const clinicianId = row.id;
        
        if (!cliniciansMap.has(clinicianId)) {
          cliniciansMap.set(clinicianId, {
            ...row,
            licenses: []
          });
        }
        
        const clinician = cliniciansMap.get(clinicianId)!;
        if (row.clinician_licenses) {
          clinician.licenses?.push({
            state: row.clinician_licenses.state,
            license_type: row.clinician_licenses.license_type,
            license_number: row.clinician_licenses.license_number,
            expiration_date: row.clinician_licenses.expiration_date,
          });
        }
      });

      setClinicians(Array.from(cliniciansMap.values()));
    } catch (err) {
      console.error('Error loading available clinicians:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinicians();
  }, [clientState]);

  return {
    clinicians,
    loading,
    error,
    hasClientState: !!clientState,
    clientState,
    refetch: fetchClinicians,
  };
}
