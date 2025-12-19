import { useMemo } from 'react';
import { useSupabaseTable } from '@/hooks/data/useSupabaseTable';
import { FormField } from '@/components/Forms/types';

export interface FormFieldData {
  form_template_id: string;
  field_type: string;
  field_key: string;
  label: string;
  placeholder?: string;
  help_text?: string;
  is_required: boolean;
  order_index: number;
  validation_rules?: Record<string, any>;
  options?: Array<{ label: string; value: string }>;
  conditional_logic?: Record<string, any>;
}

export function useFormFieldsData(templateId?: string) {
  // Memoize filters to prevent new object references on every render
  const filters = useMemo(() => 
    templateId ? { form_template_id: templateId } : {},
    [templateId]
  );
  
  return useSupabaseTable<FormField, FormFieldData>({
    table: 'form_template_fields',
    filters,
    orderBy: { column: 'order_index', ascending: true },
    enabled: !!templateId,
    insertOptions: {
      successMessage: 'Form field created successfully',
    },
    updateOptions: {
      successMessage: 'Form field updated successfully',
    },
    deleteOptions: {
      successMessage: 'Form field deleted successfully',
    },
  });
}