import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useFormTemplatesData, useFormFieldsData } from '@/hooks/forms';
import { useToast } from '@/hooks/use-toast';
import { FormTemplate, FormField } from '../types';

interface UseFormTemplateReturn {
  template: FormTemplate | null;
  templates: FormTemplate[];
  fields: FormField[];
  loading: boolean;
  error: string | null;
  loadTemplate: (formType: 'signup' | 'intake' | 'session_notes', tenantId?: string) => Promise<void>;
  saveTemplate: (template: FormTemplate, fields: FormField[]) => Promise<boolean>;
}

export function useFormTemplate(): UseFormTemplateReturn {
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const { toast } = useToast();

  // Use our new generic data hooks with optimized caching
  // ✅ Phase 3 Optimization: useFormTemplatesData uses enhanced query cache with table-specific config
  const {
    data: templates,
    loading: templatesLoading,
    create: createTemplate,
    update: updateTemplate,
  } = useFormTemplatesData();

  // Use refs to prevent function recreations and stabilize dependencies
  const templatesRef = useRef<FormTemplate[]>([]);
  const templateRef = useRef<FormTemplate | null>(null);
  const fieldsRef = useRef<FormField[]>([]);

  // ✅ Phase 3 Optimization: Fields query is disabled when no template selected
  // This prevents unnecessary queries and reduces database load
  // The 'enabled' flag in useFormFieldsData ensures query only runs when activeTemplateId exists
  const {
    data: fields,
    loading: fieldsLoading,
    create: createField,
    update: updateField,
    remove: deleteField,
  } = useFormFieldsData(activeTemplateId || undefined);

  // Update refs whenever data changes
  useEffect(() => {
    templatesRef.current = templates;
    templateRef.current = template;
    fieldsRef.current = fields;
  }, [templates, template, fields]);

  const loading = templatesLoading || fieldsLoading;
  const error = null; // Generic hooks handle errors internally

  const loadTemplate = useCallback(async (
    formType: 'signup' | 'intake' | 'session_notes',
    tenantId?: string
  ) => {
    console.group(`🔍 [useFormTemplate] loadTemplate ${new Date().toISOString()}`);
    console.log('Parameters:', { formType, tenantId });
    
    // Use ref instead of direct templates reference to keep function stable
    const currentTemplates = templatesRef.current;
    console.log('Templates array:', currentTemplates.map(t => ({ 
      id: t.id, 
      form_type: t.form_type, 
      is_active: t.is_active, 
      tenant_id: t.tenant_id 
    })));
    
    // Find template by type
    const foundTemplate = currentTemplates.find(t => 
      t.form_type === formType && 
      t.is_active &&
      (!tenantId || t.tenant_id === tenantId)
    );

    if (foundTemplate) {
      console.log('✅ Template FOUND:', { 
        id: foundTemplate.id, 
        name: foundTemplate.name, 
        is_active: foundTemplate.is_active 
      });
      setTemplate(foundTemplate);
      setActiveTemplateId(foundTemplate.id!);
      console.log('✅ setActiveTemplateId:', foundTemplate.id);
    } else {
      console.log('⚠️ Template NOT FOUND');
      setTemplate(null);
      setActiveTemplateId(null);
      console.log('✅ setActiveTemplateId: null');
    }
    console.groupEnd();
  }, []); // ✅ Empty dependency array - stable function identity

  const saveTemplate = useCallback(async (
    templateData: FormTemplate,
    fieldsData: FormField[]
  ): Promise<boolean> => {
    try {
      let savedTemplate;
      
      if (templateData.id) {
        // Update existing template
        const result = await updateTemplate({ id: templateData.id, ...templateData });
        savedTemplate = result.data;
      } else {
        // Create new template
        const result = await createTemplate(templateData);
        savedTemplate = result.data;
      }

      if (!savedTemplate) {
        throw new Error('Failed to save template');
      }

      // Use refs to get current values without adding them as dependencies
      const currentTemplate = templateRef.current;
      const currentFields = fieldsRef.current;

      // Handle fields - delete existing and recreate for simplicity
      if (currentTemplate?.id) {
        for (const field of currentFields) {
          await deleteField(field.id);
        }
      }

      // Create new fields
      for (const field of fieldsData) {
        const fieldData = {
          form_template_id: savedTemplate.id,
          field_type: field.field_type,
          field_key: field.field_key,
          label: field.label,
          placeholder: field.placeholder,
          help_text: field.help_text,
          is_required: field.is_required,
          order_index: field.order_index,
          validation_rules: field.validation_rules,
          options: field.options,
          conditional_logic: field.conditional_logic,
        };
        await createField(fieldData);
      }

      setTemplate(savedTemplate);
      setActiveTemplateId(savedTemplate.id);

      toast({
        title: 'Success',
        description: templateData.is_active 
          ? 'Form published successfully' 
          : 'Form saved as draft',
      });

      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to save form template';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
      console.error('Error saving form template:', err);
      return false;
    }
  }, [createTemplate, updateTemplate, createField, deleteField, toast]);

  // Memoize return value to prevent new object references on every render
  return useMemo(() => ({
    template,
    templates,
    fields,
    loading,
    error,
    loadTemplate,
    saveTemplate,
  }), [template, templates, fields, loading, error, loadTemplate, saveTemplate]);
}
