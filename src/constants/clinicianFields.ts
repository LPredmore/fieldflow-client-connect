export const CLINICIAN_FIELDS = [
  'Licensed Clinical Social Worker (LCSW)',
  'Licensed Professional Counselor (LPC)',
  'Licensed Marriage and Family Therapist (LMFT)',
  'Licensed Mental Health Counselor (LMHC)',
  'Psychologist (PhD/PsyD)',
  'Psychiatrist (MD/DO)',
  'Licensed Clinical Psychologist',
  'Licensed Professional Clinical Counselor (LPCC)',
  'Licensed Clinical Mental Health Counselor (LCMHC)',
  'Certified Alcohol and Drug Counselor (CADC)',
  'Board Certified Behavior Analyst (BCBA)',
  'Registered Play Therapist (RPT)',
  'Art Therapist',
  'Music Therapist',
  'Occupational Therapist',
  'School Counselor',
  'Career Counselor',
  'Pastoral Counselor',
] as const;

export type ClinicianField = typeof CLINICIAN_FIELDS[number];
