import { useSupabaseTable } from '@/hooks/data/useSupabaseTable';
import { FormResponse } from '@/components/Forms/types';

export interface FormResponseData {
  form_template_id: string;
  customer_id?: string;
  response_data: Record<string, any>;
  submitted_at?: string;
}

export function useFormResponsesData(templateId?: string) {
  return useSupabaseTable<FormResponse, FormResponseData>({
    table: 'form_responses',
    select: `
      *,
      form_template:form_templates(name, form_type),
      customer:customers(name, email)
    `,
    filters: templateId ? {
      form_template_id: templateId,
    } : {
      tenant_id: 'auto',
    },
    orderBy: { column: 'submitted_at', ascending: false },
    insertOptions: {
      successMessage: 'Form response submitted successfully',
    },
    updateOptions: {
      successMessage: 'Form response updated successfully',
    },
    deleteOptions: {
      successMessage: 'Form response deleted successfully',
    },
  });
}