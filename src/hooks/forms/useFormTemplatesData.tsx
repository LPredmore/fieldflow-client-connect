import { useSupabaseTable } from '@/hooks/data/useSupabaseTable';
import { FormTemplate, FormType } from '@/components/Forms/types';

export interface FormTemplateData {
  tenant_id: string;
  form_type?: FormType;
  name: string;
  description?: string;
  is_active: boolean;
  version?: number;
}

export function useFormTemplatesData() {
  return useSupabaseTable<FormTemplate, FormTemplateData>({
    table: 'form_templates',
    filters: {
      tenant_id: 'auto', // Auto-apply tenant filter
    },
    orderBy: { column: 'created_at', ascending: false },
    insertOptions: {
      successMessage: 'Form template created successfully',
    },
    updateOptions: {
      successMessage: 'Form template updated successfully',
    },
    deleteOptions: {
      successMessage: 'Form template deleted successfully',
    },
  });
}
