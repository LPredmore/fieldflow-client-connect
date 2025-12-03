import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useFormTemplatesData, useFormFieldsData } from '@/hooks/forms';
import { useToast } from '@/hooks/use-toast';
import { FormTemplate, FormField, FormType } from '../types';
import { supabase } from '@/integrations/supabase/client';

interface UseFormTemplateReturn {
  template: FormTemplate | null;
  templates: FormTemplate[];
  fields: FormField[];
  loading: boolean;
  error: string | null;
  loadTemplate: (formType: FormType, tenantId?: string) => Promise<void>;
  loadTemplateById: (templateId: string) => Promise<void>;
  saveTemplate: (template: FormTemplate, fields: FormField[]) => Promise<boolean>;
}

export function useFormTemplate(): UseFormTemplateReturn {
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const { toast } = useToast();

  // Use our new generic data hooks with optimized caching
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
    formType: FormType,
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
  }, []); // Empty dependency array - stable function identity

  const loadTemplateById = useCallback(async (templateId: string) => {
    console.group(`🔍 [useFormTemplate] loadTemplateById ${new Date().toISOString()}`);
    console.log('templateId:', templateId);
    
    try {
      const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        const foundTemplate: FormTemplate = {
          id: data.id,
          tenant_id: data.tenant_id,
          form_type: data.form_type as FormType,
          name: data.name,
          description: data.description,
          is_active: data.is_active,
          version: data.version,
          created_at: data.created_at,
          updated_at: data.updated_at,
          created_by_user_id: data.created_by_user_id,
        };
        setTemplate(foundTemplate);
        setActiveTemplateId(foundTemplate.id!);
        console.log('✅ Template FOUND by ID:', foundTemplate.id);
      }
    } catch (err) {
      console.error('Error loading template by ID:', err);
      setTemplate(null);
      setActiveTemplateId(null);
    }
    console.groupEnd();
  }, []);

  const saveTemplate = useCallback(async (
    templateData: FormTemplate,
    fieldsData: FormField[]
  ): Promise<boolean> => {
    try {
      let savedTemplate;
      
      // Prepare data for database (ensure form_type is set)
      const dataToSave = {
        ...templateData,
        form_type: templateData.form_type || 'custom',
      };
      
      if (templateData.id) {
        // Update existing template
        const result = await updateTemplate({ id: templateData.id, ...dataToSave });
        savedTemplate = result.data;
      } else {
        // Create new template
        const result = await createTemplate(dataToSave);
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
    loadTemplateById,
    saveTemplate,
  }), [template, templates, fields, loading, error, loadTemplate, loadTemplateById, saveTemplate]);
}
