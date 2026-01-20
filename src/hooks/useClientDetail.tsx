import { useState, useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { Client } from '@/types/client';

// Types for the different data sections
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
  diagnosis_code?: {
    id: string;
    code: string;
    description: string;
    system: string;
    is_active: boolean;
    is_billable: boolean;
  };
}

export interface TreatmentPlan {
  id: string;
  tenant_id: string;
  client_id: string;
  staff_id: string;
  plan_version: number;
  is_active: boolean;
  supersedes_plan_id: string | null;
  treatmentplan_startdate: string | null;
  planlength: string | null;
  treatmentfrequency: string | null;
  next_treatmentplan_update: string | null;
  problem: string | null;
  treatmentgoal: string | null;
  primaryobjective: string | null;
  secondaryobjective: string | null;
  tertiaryobjective: string | null;
  intervention1: string | null;
  intervention2: string | null;
  intervention3: string | null;
  intervention4: string | null;
  intervention5: string | null;
  intervention6: string | null;
  plan_narrative: string | null;
  created_by_profile_id: string;
  created_at: string;
  updated_at: string;
}

export interface SessionNote {
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
  client_substanceabuserisk: 'none' | 'low' | 'medium' | 'high' | null;
  client_suicidalideation: 'none' | 'passive' | 'active' | null;
  client_homicidalideation: 'none' | 'passive' | 'active' | null;
  client_personsinattendance: string | null;
  client_medications: string | null;
  client_sessionnarrative: string | null;
  client_functioning: string | null;
  client_prognosis: string | null;
  client_progress: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  staff?: {
    prov_name_f: string | null;
    prov_name_l: string | null;
  };
  appointment?: {
    start_at: string;
  };
}

export interface PHQ9Assessment {
  id: string;
  client_id: string;
  tenant_id: string;
  staff_id: string | null;
  appointment_id: string | null;
  assessment_date: string;
  total_score: number;
  severity: string;
  clinician_name_snapshot: string | null;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  q5: number;
  q6: number;
  q7: number;
  q8: number;
  q9: number;
  q10_difficulty: string | null;
  created_at: string;
  updated_at: string;
}

export interface GAD7Assessment {
  id: string;
  client_id: string;
  tenant_id: string;
  staff_id: string | null;
  appointment_id: string | null;
  administered_at: string;
  total_score: number;
  severity: string;
  clinician_name_snapshot: string | null;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  q5: number;
  q6: number;
  q7: number;
  created_at: string;
  updated_at: string;
}

export interface PCL5Assessment {
  id: string;
  client_id: string;
  tenant_id: string;
  staff_id: string | null;
  appointment_id: string | null;
  administered_at: string;
  total_score: number;
  severity: string;
  clinician_name_snapshot: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormResponseWithTemplate {
  id: string;
  form_template_id: string;
  customer_id: string | null;
  submitted_by_user_id: string | null;
  response_data: Record<string, any>;
  submitted_at: string;
  form_template?: {
    id: string;
    name: string;
    description: string | null;
  };
}

export interface ClientInsurance {
  id: string;
  client_id: string;
  tenant_id: string;
  payer_order: number;
  payer_name: string | null;
  payer_id: string | null;
  member_id: string | null;
  group_number: string | null;
  plan_name: string | null;
  subscriber_name: string | null;
  subscriber_dob: string | null;
  subscriber_relationship: string | null;
  effective_date: string | null;
  termination_date: string | null;
  copay_amount: number | null;
  deductible_amount: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmergencyContact {
  id: string;
  client_id: string;
  tenant_id: string;
  name: string;
  phone: string;
  email: string | null;
  relationship: string | null;
  is_primary: boolean;
  is_active: boolean;
  addr_1: string | null;
  addr_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  created_at: string;
  updated_at: string;
}

// Tab names for lazy loading control
export type ClientDetailTab = 'overview' | 'clinical' | 'assessments' | 'forms' | 'insurance' | 'contacts';

interface UseClientDetailOptions {
  clientId: string | null;
  activeTab?: ClientDetailTab;
}

export function useClientDetail({ clientId, activeTab = 'overview' }: UseClientDetailOptions) {
  // Always fetch client data when clientId is available
  const {
    data: clientData,
    loading: clientLoading,
    error: clientError,
  } = useSupabaseQuery<Client>({
    table: 'clients',
    select: '*, assigned_staff:staff!primary_staff_id(prov_name_f, prov_name_l)',
    filters: { id: clientId },
    enabled: !!clientId,
  });

  // Clinical tab data - only fetch when clinical tab is active
  const fetchClinical = activeTab === 'clinical';

  const {
    data: treatmentPlans,
    loading: treatmentPlansLoading,
  } = useSupabaseQuery<TreatmentPlan>({
    table: 'client_treatment_plans',
    select: '*',
    filters: { client_id: clientId, tenant_id: 'auto' },
    enabled: !!clientId && fetchClinical,
    orderBy: { column: 'created_at', ascending: false },
  });

  const {
    data: diagnoses,
    loading: diagnosesLoading,
  } = useSupabaseQuery<ClientDiagnosis>({
    table: 'client_diagnoses',
    select: '*, diagnosis_code:diagnosis_codes(*)',
    filters: { client_id: clientId, tenant_id: 'auto' },
    enabled: !!clientId && fetchClinical,
    orderBy: { column: 'is_primary', ascending: false },
  });

  const {
    data: sessionNotes,
    loading: sessionNotesLoading,
  } = useSupabaseQuery<SessionNote>({
    table: 'appointment_clinical_notes',
    select: '*, staff:staff!staff_id(prov_name_f, prov_name_l), appointment:appointments!appointment_id(start_at)',
    filters: { client_id: clientId, tenant_id: 'auto' },
    enabled: !!clientId && fetchClinical,
    orderBy: { column: 'created_at', ascending: false },
  });

  // Assessments tab data - only fetch when assessments tab is active
  const fetchAssessments = activeTab === 'assessments';

  const {
    data: phq9Assessments,
    loading: phq9Loading,
  } = useSupabaseQuery<PHQ9Assessment>({
    table: 'client_phq9_assessments',
    select: '*',
    filters: { client_id: clientId, tenant_id: 'auto' },
    enabled: !!clientId && fetchAssessments,
    orderBy: { column: 'assessment_date', ascending: false },
  });

  const {
    data: gad7Assessments,
    loading: gad7Loading,
  } = useSupabaseQuery<GAD7Assessment>({
    table: 'client_gad7_assessments',
    select: '*',
    filters: { client_id: clientId, tenant_id: 'auto' },
    enabled: !!clientId && fetchAssessments,
    orderBy: { column: 'administered_at', ascending: false },
  });

  const {
    data: pcl5Assessments,
    loading: pcl5Loading,
  } = useSupabaseQuery<PCL5Assessment>({
    table: 'client_pcl5_assessments',
    select: '*',
    filters: { client_id: clientId, tenant_id: 'auto' },
    enabled: !!clientId && fetchAssessments,
    orderBy: { column: 'administered_at', ascending: false },
  });

  // Forms tab data - only fetch when forms tab is active
  const fetchForms = activeTab === 'forms';

  const {
    data: formResponses,
    loading: formResponsesLoading,
  } = useSupabaseQuery<FormResponseWithTemplate>({
    table: 'form_responses',
    select: '*, form_template:form_templates(id, name, description)',
    filters: { customer_id: clientId, tenant_id: 'auto' },
    enabled: !!clientId && fetchForms,
    orderBy: { column: 'submitted_at', ascending: false },
  });

  // Insurance tab data - only fetch when insurance tab is active
  const fetchInsurance = activeTab === 'insurance';

  const {
    data: insurance,
    loading: insuranceLoading,
  } = useSupabaseQuery<ClientInsurance>({
    table: 'client_insurance',
    select: '*',
    filters: { client_id: clientId, tenant_id: 'auto' },
    enabled: !!clientId && fetchInsurance,
    orderBy: { column: 'payer_order', ascending: true },
  });

  // Contacts tab data - only fetch when contacts tab is active
  const fetchContacts = activeTab === 'contacts';

  const {
    data: emergencyContacts,
    loading: contactsLoading,
  } = useSupabaseQuery<EmergencyContact>({
    table: 'client_emergency_contacts',
    select: '*',
    filters: { client_id: clientId, tenant_id: 'auto' },
    enabled: !!clientId && fetchContacts,
    orderBy: { column: 'is_primary', ascending: false },
  });

  // Transform client data to add computed fields
  const client = useMemo(() => {
    if (!clientData || clientData.length === 0) return null;
    const c = clientData[0] as any;
    
    const patientName = [
      c.pat_name_f,
      c.pat_name_m,
      c.pat_name_l
    ].filter(Boolean).join(' ').trim();
    
    const fullName = patientName || c.pat_name_preferred || c.email || 'Unnamed Client';
    
    const staffName = c.assigned_staff 
      ? `${c.assigned_staff.prov_name_f || ''} ${c.assigned_staff.prov_name_l || ''}`.trim()
      : 'Unassigned';
    
    return {
      ...c,
      full_name: fullName,
      assigned_staff_name: staffName,
    } as Client;
  }, [clientData]);

  // Get current treatment plan (most recent active one)
  const currentTreatmentPlan = useMemo(() => {
    if (!treatmentPlans || treatmentPlans.length === 0) return null;
    const activePlans = treatmentPlans.filter(p => p.is_active);
    return activePlans.length > 0 ? activePlans[0] : treatmentPlans[0];
  }, [treatmentPlans]);

  // Get active diagnoses
  const activeDiagnoses = useMemo(() => {
    if (!diagnoses) return [];
    return diagnoses.filter(d => d.is_active);
  }, [diagnoses]);

  // Calculate loading states for each tab
  const tabLoading = useMemo(() => ({
    overview: clientLoading,
    clinical: treatmentPlansLoading || diagnosesLoading || sessionNotesLoading,
    assessments: phq9Loading || gad7Loading || pcl5Loading,
    forms: formResponsesLoading,
    insurance: insuranceLoading,
    contacts: contactsLoading,
  }), [
    clientLoading, treatmentPlansLoading, diagnosesLoading, sessionNotesLoading,
    phq9Loading, gad7Loading, pcl5Loading, formResponsesLoading, 
    insuranceLoading, contactsLoading
  ]);

  return {
    // Core client data
    client,
    clientLoading,
    clientError,
    
    // Clinical data
    treatmentPlans: treatmentPlans || [],
    currentTreatmentPlan,
    diagnoses: diagnoses || [],
    activeDiagnoses,
    sessionNotes: sessionNotes || [],
    
    // Assessments
    phq9Assessments: phq9Assessments || [],
    gad7Assessments: gad7Assessments || [],
    pcl5Assessments: pcl5Assessments || [],
    
    // Forms
    formResponses: formResponses || [],
    
    // Insurance
    insurance: insurance || [],
    
    // Emergency Contacts
    emergencyContacts: emergencyContacts || [],
    
    // Loading state per tab
    tabLoading,
  };
}
