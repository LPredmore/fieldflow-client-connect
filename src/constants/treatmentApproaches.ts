export const TREATMENT_APPROACHES = [
  'Cognitive Behavioral Therapy (CBT)',
  'Dialectical Behavior Therapy (DBT)',
  'Psychodynamic Therapy',
  'Acceptance and Commitment Therapy (ACT)',
  'Mindfulness-Based Therapy',
  'Solution-Focused Brief Therapy',
  'Trauma-Focused CBT',
  'EMDR (Eye Movement Desensitization and Reprocessing)',
  'Family Systems Therapy',
  'Motivational Interviewing',
  'Play Therapy',
  'Exposure Therapy',
  'Interpersonal Therapy (IPT)',
  'Narrative Therapy',
  'Emotionally Focused Therapy (EFT)',
  'Gestalt Therapy',
  'Existential Therapy',
  'Person-Centered Therapy',
  'Behavioral Therapy',
  'Integrative Therapy',
] as const;

export type TreatmentApproach = typeof TREATMENT_APPROACHES[number];
