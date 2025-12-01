/**
 * Assessment Tables Schema
 * Single Source of Truth for all clinical assessment tables
 */

export const ASSESSMENT_TABLES = {
  client_phq9_assessments: {
    name: 'client_phq9_assessments',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', nullable: false },
      client_id: { type: 'uuid', nullable: false },
      staff_id: { type: 'uuid', nullable: true },
      appointment_id: { type: 'uuid', nullable: true },
      assessment_date: { type: 'date', nullable: true },
      administered_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      clinician_name_snapshot: { type: 'text', nullable: true },
      // PHQ-9 Questions (0-3 scale)
      q1: { type: 'smallint', nullable: false },
      q2: { type: 'smallint', nullable: false },
      q3: { type: 'smallint', nullable: false },
      q4: { type: 'smallint', nullable: false },
      q5: { type: 'smallint', nullable: false },
      q6: { type: 'smallint', nullable: false },
      q7: { type: 'smallint', nullable: false },
      q8: { type: 'smallint', nullable: false },
      q9: { type: 'smallint', nullable: false },
      // Results
      total_score: { type: 'smallint', nullable: false },
      severity: { type: 'phq9_severity_enum', nullable: false },
      additional_notes: { type: 'text', nullable: true },
      // AI Generation
      ai_narrative: { type: 'text', nullable: true },
      ai_narrative_generated_at: { type: 'timestamptz', nullable: true },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },

  client_gad7_assessments: {
    name: 'client_gad7_assessments',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', nullable: false },
      client_id: { type: 'uuid', nullable: false },
      staff_id: { type: 'uuid', nullable: true },
      appointment_id: { type: 'uuid', nullable: true },
      administered_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      clinician_name_snapshot: { type: 'text', nullable: true },
      // GAD-7 Questions (0-3 scale)
      q1: { type: 'smallint', nullable: false },
      q2: { type: 'smallint', nullable: false },
      q3: { type: 'smallint', nullable: false },
      q4: { type: 'smallint', nullable: false },
      q5: { type: 'smallint', nullable: false },
      q6: { type: 'smallint', nullable: false },
      q7: { type: 'smallint', nullable: false },
      // Results
      total_score: { type: 'smallint', nullable: false },
      severity: { type: 'gad7_severity_enum', nullable: false },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },

  client_pcl5_assessments: {
    name: 'client_pcl5_assessments',
    columns: {
      id: { type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', nullable: false },
      client_id: { type: 'uuid', nullable: false },
      staff_id: { type: 'uuid', nullable: true },
      appointment_id: { type: 'uuid', nullable: true },
      assessment_date: { type: 'date', nullable: true },
      administered_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      clinician_name_snapshot: { type: 'text', nullable: true },
      event_description: { type: 'text', nullable: true },
      // PCL-5 Questions (0-4 scale)
      q1: { type: 'smallint', nullable: false },
      q2: { type: 'smallint', nullable: false },
      q3: { type: 'smallint', nullable: false },
      q4: { type: 'smallint', nullable: false },
      q5: { type: 'smallint', nullable: false },
      q6: { type: 'smallint', nullable: false },
      q7: { type: 'smallint', nullable: false },
      q8: { type: 'smallint', nullable: false },
      q9: { type: 'smallint', nullable: false },
      q10: { type: 'smallint', nullable: false },
      q11: { type: 'smallint', nullable: false },
      q12: { type: 'smallint', nullable: false },
      q13: { type: 'smallint', nullable: false },
      q14: { type: 'smallint', nullable: false },
      q15: { type: 'smallint', nullable: false },
      q16: { type: 'smallint', nullable: false },
      q17: { type: 'smallint', nullable: false },
      q18: { type: 'smallint', nullable: false },
      q19: { type: 'smallint', nullable: false },
      q20: { type: 'smallint', nullable: false },
      // Results
      total_score: { type: 'smallint', nullable: false },
      cluster_intrusion: { type: 'smallint', nullable: false },
      cluster_avoidance: { type: 'smallint', nullable: false },
      cluster_negative_alterations: { type: 'smallint', nullable: false },
      cluster_arousal: { type: 'smallint', nullable: false },
      meets_ptsd_cutoff: { type: 'boolean', nullable: false },
      clinical_notes: { type: 'text', nullable: true },
      created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
      updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
    },
  },
} as const;

export type AssessmentTable = keyof typeof ASSESSMENT_TABLES;
