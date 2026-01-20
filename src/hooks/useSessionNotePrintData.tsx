import { useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';

// Types for print data
export interface SessionNotePrintData {
  // Session note data
  note: {
    id: string;
    created_at: string;
    client_diagnosis: string[];
    client_treatmentplan_startdate: string | null;
    client_planlength: string | null;
    client_treatmentfrequency: string | null;
    client_nexttreatmentplanupdate: string | null;
    client_problem: string | null;
    client_treatmentgoal: string | null;
    client_primaryobjective: string | null;
    client_secondaryobjective: string | null;
    client_tertiaryobjective: string | null;
    client_intervention1: string | null;
    client_intervention2: string | null;
    client_intervention3: string | null;
    client_intervention4: string | null;
    client_intervention5: string | null;
    client_intervention6: string | null;
    client_appearance: string | null;
    client_attitude: string | null;
    client_behavior: string | null;
    client_speech: string | null;
    client_affect: string | null;
    client_mood: string | null;
    client_thoughtprocess: string | null;
    client_perception: string | null;
    client_orientation: string | null;
    client_memoryconcentration: string | null;
    client_insightjudgement: string | null;
    client_substanceabuserisk: string | null;
    client_suicidalideation: string | null;
    client_homicidalideation: string | null;
    client_personsinattendance: string | null;
    client_medications: string | null;
    client_sessionnarrative: string | null;
    client_functioning: string | null;
    client_prognosis: string | null;
    client_progress: string | null;
    appointment?: {
      start_at: string;
    };
  };
  
  // Client demographics
  client: {
    full_name: string;
    legal_name: string;
    pat_dob: string | null;
    address: string;
    phone: string | null;
  };
  
  // Provider credentials
  provider: {
    full_name: string;
    credentials: string | null;
    npi: string | null;
    license_type: string | null;
    license_number: string | null;
  };
  
  // Practice letterhead
  practice: {
    name: string;
    logo_url: string | null;
    address: string;
    phone: string | null;
    email: string | null;
    npi: string | null;
  };
  
  // Resolved diagnosis descriptions
  diagnoses: Array<{
    code: string;
    description: string;
  }>;
}

interface SessionNoteRow {
  id: string;
  tenant_id: string;
  appointment_id: string;
  client_id: string;
  staff_id: string;
  client_diagnosis: string[];
  client_treatmentplan_startdate: string | null;
  client_planlength: string | null;
  client_treatmentfrequency: string | null;
  client_nexttreatmentplanupdate: string | null;
  client_problem: string | null;
  client_treatmentgoal: string | null;
  client_primaryobjective: string | null;
  client_secondaryobjective: string | null;
  client_tertiaryobjective: string | null;
  client_intervention1: string | null;
  client_intervention2: string | null;
  client_intervention3: string | null;
  client_intervention4: string | null;
  client_intervention5: string | null;
  client_intervention6: string | null;
  client_appearance: string | null;
  client_attitude: string | null;
  client_behavior: string | null;
  client_speech: string | null;
  client_affect: string | null;
  client_mood: string | null;
  client_thoughtprocess: string | null;
  client_perception: string | null;
  client_orientation: string | null;
  client_memoryconcentration: string | null;
  client_insightjudgement: string | null;
  client_substanceabuserisk: string | null;
  client_suicidalideation: string | null;
  client_homicidalideation: string | null;
  client_personsinattendance: string | null;
  client_medications: string | null;
  client_sessionnarrative: string | null;
  client_functioning: string | null;
  client_prognosis: string | null;
  client_progress: string | null;
  created_at: string;
  updated_at: string;
  staff?: {
    prov_name_f: string | null;
    prov_name_l: string | null;
    prov_npi: string | null;
    prov_license_type: string | null;
    prov_license_number: string | null;
  };
  appointment?: {
    start_at: string;
  };
}

interface ClientRow {
  id: string;
  pat_name_f: string | null;
  pat_name_m: string | null;
  pat_name_l: string | null;
  pat_name_preferred: string | null;
  pat_dob: string | null;
  pat_addr_1: string | null;
  pat_addr_2: string | null;
  pat_city: string | null;
  pat_state: string | null;
  pat_zip: string | null;
  phone: string | null;
}

interface TenantRow {
  id: string;
  display_name: string | null;
  name: string;
  logo_url: string | null;
}

interface PracticeInfoRow {
  id: string;
  tenant_id: string;
  bill_name: string | null;
  bill_npi: string | null;
  bill_addr_1: string | null;
  bill_addr_2: string | null;
  bill_city: string | null;
  bill_state: string | null;
  bill_zip: string | null;
  bill_phone: string | null;
  bill_email: string | null;
  is_default: boolean;
}

interface DiagnosisCodeRow {
  id: string;
  code: string;
  description: string;
}

interface UseSessionNotePrintDataOptions {
  noteId: string | null;
  clientId: string | null;
}

export function useSessionNotePrintData({ noteId, clientId }: UseSessionNotePrintDataOptions) {
  const { tenantId } = useAuth();
  const enabled = !!noteId && !!clientId && !!tenantId;

  // Fetch session note with expanded staff join
  const {
    data: noteData,
    loading: noteLoading,
    error: noteError,
  } = useSupabaseQuery<SessionNoteRow>({
    table: 'appointment_clinical_notes',
    select: `
      *,
      staff:staff!staff_id(prov_name_f, prov_name_l, prov_npi, prov_license_type, prov_license_number),
      appointment:appointments!appointment_id(start_at)
    `,
    filters: { id: noteId },
    enabled,
  });

  // Fetch client demographics
  const {
    data: clientData,
    loading: clientLoading,
    error: clientError,
  } = useSupabaseQuery<ClientRow>({
    table: 'clients',
    select: 'id, pat_name_f, pat_name_m, pat_name_l, pat_name_preferred, pat_dob, pat_addr_1, pat_addr_2, pat_city, pat_state, pat_zip, phone',
    filters: { id: clientId },
    enabled,
  });

  // Fetch tenant info for practice name/logo
  const {
    data: tenantData,
    loading: tenantLoading,
    error: tenantError,
  } = useSupabaseQuery<TenantRow>({
    table: 'tenants',
    select: 'id, display_name, name, logo_url',
    filters: { id: tenantId },
    enabled,
  });

  // Fetch practice info for billing/letterhead
  const {
    data: practiceData,
    loading: practiceLoading,
    error: practiceError,
  } = useSupabaseQuery<PracticeInfoRow>({
    table: 'practice_info',
    select: 'id, tenant_id, bill_name, bill_npi, bill_addr_1, bill_addr_2, bill_city, bill_state, bill_zip, bill_phone, bill_email, is_default',
    filters: { tenant_id: tenantId, is_default: true },
    enabled,
  });

  // Get diagnosis codes from the note to resolve
  const diagnosisCodes = noteData?.[0]?.client_diagnosis || [];

  // Fetch diagnosis descriptions
  const {
    data: diagnosisData,
    loading: diagnosisLoading,
    error: diagnosisError,
  } = useSupabaseQuery<DiagnosisCodeRow>({
    table: 'diagnosis_codes',
    select: 'id, code, description',
    filters: diagnosisCodes.length > 0 ? undefined : { code: '__never_match__' },
    enabled: enabled && diagnosisCodes.length > 0,
  });

  // Filter diagnosis data to only matching codes
  const matchedDiagnoses = useMemo(() => {
    if (!diagnosisData || diagnosisCodes.length === 0) return [];
    
    return diagnosisCodes.map(code => {
      const found = diagnosisData.find(d => d.code === code);
      return {
        code,
        description: found?.description || 'Unknown diagnosis',
      };
    });
  }, [diagnosisData, diagnosisCodes]);

  // Build formatted address helper
  const formatAddress = (
    addr1: string | null,
    addr2: string | null,
    city: string | null,
    state: string | null,
    zip: string | null
  ): string => {
    const parts = [];
    if (addr1) parts.push(addr1);
    if (addr2) parts.push(addr2);
    
    const cityStateZip = [city, state].filter(Boolean).join(', ');
    const withZip = zip ? `${cityStateZip} ${zip}` : cityStateZip;
    if (withZip) parts.push(withZip);
    
    return parts.join(', ') || 'Address not on file';
  };

  // Assemble print data
  const printData = useMemo<SessionNotePrintData | null>(() => {
    const note = noteData?.[0];
    const client = clientData?.[0];
    const tenant = tenantData?.[0];
    const practice = practiceData?.[0];

    if (!note || !client) return null;

    // Build client name variants
    const legalName = [client.pat_name_f, client.pat_name_l].filter(Boolean).join(' ') || 'Unknown Client';
    const fullName = [client.pat_name_f, client.pat_name_m, client.pat_name_l]
      .filter(Boolean)
      .join(' ') || client.pat_name_preferred || 'Unknown Client';

    // Build provider info
    const providerName = note.staff 
      ? [note.staff.prov_name_f, note.staff.prov_name_l].filter(Boolean).join(' ')
      : 'Unknown Provider';

    return {
      note: {
        id: note.id,
        created_at: note.created_at,
        client_diagnosis: note.client_diagnosis || [],
        client_treatmentplan_startdate: note.client_treatmentplan_startdate,
        client_planlength: note.client_planlength,
        client_treatmentfrequency: note.client_treatmentfrequency,
        client_nexttreatmentplanupdate: note.client_nexttreatmentplanupdate,
        client_problem: note.client_problem,
        client_treatmentgoal: note.client_treatmentgoal,
        client_primaryobjective: note.client_primaryobjective,
        client_secondaryobjective: note.client_secondaryobjective,
        client_tertiaryobjective: note.client_tertiaryobjective,
        client_intervention1: note.client_intervention1,
        client_intervention2: note.client_intervention2,
        client_intervention3: note.client_intervention3,
        client_intervention4: note.client_intervention4,
        client_intervention5: note.client_intervention5,
        client_intervention6: note.client_intervention6,
        client_appearance: note.client_appearance,
        client_attitude: note.client_attitude,
        client_behavior: note.client_behavior,
        client_speech: note.client_speech,
        client_affect: note.client_affect,
        client_mood: note.client_mood,
        client_thoughtprocess: note.client_thoughtprocess,
        client_perception: note.client_perception,
        client_orientation: note.client_orientation,
        client_memoryconcentration: note.client_memoryconcentration,
        client_insightjudgement: note.client_insightjudgement,
        client_substanceabuserisk: note.client_substanceabuserisk,
        client_suicidalideation: note.client_suicidalideation,
        client_homicidalideation: note.client_homicidalideation,
        client_personsinattendance: note.client_personsinattendance,
        client_medications: note.client_medications,
        client_sessionnarrative: note.client_sessionnarrative,
        client_functioning: note.client_functioning,
        client_prognosis: note.client_prognosis,
        client_progress: note.client_progress,
        appointment: note.appointment,
      },
      client: {
        full_name: fullName,
        legal_name: legalName,
        pat_dob: client.pat_dob,
        address: formatAddress(
          client.pat_addr_1,
          client.pat_addr_2,
          client.pat_city,
          client.pat_state,
          client.pat_zip
        ),
        phone: client.phone,
      },
      provider: {
        full_name: providerName,
        credentials: note.staff?.prov_license_type || null,
        npi: note.staff?.prov_npi || null,
        license_type: note.staff?.prov_license_type || null,
        license_number: note.staff?.prov_license_number || null,
      },
      practice: {
        name: tenant?.display_name || tenant?.name || practice?.bill_name || 'Practice',
        logo_url: tenant?.logo_url || null,
        address: practice 
          ? formatAddress(
              practice.bill_addr_1,
              practice.bill_addr_2,
              practice.bill_city,
              practice.bill_state,
              practice.bill_zip
            )
          : 'Address not on file',
        phone: practice?.bill_phone || null,
        email: practice?.bill_email || null,
        npi: practice?.bill_npi || null,
      },
      diagnoses: matchedDiagnoses,
    };
  }, [noteData, clientData, tenantData, practiceData, matchedDiagnoses]);

  const loading = noteLoading || clientLoading || tenantLoading || practiceLoading || diagnosisLoading;
  const error = noteError || clientError || tenantError || practiceError || diagnosisError;

  return {
    printData,
    loading,
    error,
  };
}
