/**
 * Configuration for required consent types.
 * These define which consents are tracked for compliance.
 */

export interface RequiredConsent {
  /** The consent_template_key used in client_telehealth_consents table */
  key: string;
  /** Display label for UI */
  label: string;
  /** Whether this consent is required for all clients */
  required: boolean;
  /** If set, this consent is only required when client has this condition */
  requiredFor?: 'telehealth' | 'in_person';
}

export const REQUIRED_CONSENTS: RequiredConsent[] = [
  { 
    key: 'treatment_consent', 
    label: 'Consent for Treatment', 
    required: true 
  },
  { 
    key: 'telehealth_informed_consent', 
    label: 'Telehealth Informed Consent', 
    required: false,
    requiredFor: 'telehealth'
  },
  { 
    key: 'hipaa_notice', 
    label: 'HIPAA Notice of Privacy Practices', 
    required: true 
  },
  { 
    key: 'financial_agreement', 
    label: 'Financial Agreement', 
    required: true 
  },
] as const;

/**
 * Get all required consent keys for quick lookup
 */
export const REQUIRED_CONSENT_KEYS = REQUIRED_CONSENTS.map(c => c.key);
