// Unified form data hooks
export { useFormTemplatesData } from './useFormTemplatesData';
export { useFormFieldsData } from './useFormFieldsData';
export { useFormResponsesData } from './useFormResponsesData';
export { useConsentTemplatesData } from './useConsentTemplatesData';

// Re-export form types for convenience
export type { 
  FormTemplate, 
  FormField, 
  FormResponse, 
  FieldType,
  ConsentTemplate,
  ConsentContent,
  ConsentSection,
  ConsentType 
} from '@/components/Forms/types';