// Clinical components for treatment plans and session notes
export { DiagnosisSelector } from './DiagnosisSelector';
export { DiagnosisDisplay, DiagnosisList } from './DiagnosisDisplay';
export { TreatmentPlanDialog } from './TreatmentPlanDialog';
export { SessionNoteDialog } from './SessionNoteDialog';

// Re-export hooks for convenience
export { useTreatmentPlans, type TreatmentPlan, type TreatmentPlanFormData } from '@/hooks/useTreatmentPlans';
export { useSessionNote, type SessionNote, type SessionNoteFormData } from '@/hooks/useSessionNote';
export { useTreatmentPlanPrivateNote, type TreatmentPlanPrivateNote } from '@/hooks/useTreatmentPlanPrivateNote';
export { useAppointmentPrivateNote, type AppointmentPrivateNote } from '@/hooks/useAppointmentPrivateNote';
