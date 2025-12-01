import { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { FormTemplate, FormField, FormResponse } from '@/components/Forms/types';
import { useFormTemplatesData, useFormFieldsData, useFormResponsesData } from '@/hooks/forms';

interface FormContextType {
  // Templates
  templates: FormTemplate[];
  templatesLoading: boolean;
  createTemplate: (data: any) => Promise<any>;
  updateTemplate: (data: any) => Promise<any>;
  deleteTemplate: (id: string) => Promise<any>;
  
  // Fields
  fields: FormField[];
  fieldsLoading: boolean;
  createField: (data: any) => Promise<any>;
  updateField: (data: any) => Promise<any>;
  deleteField: (id: string) => Promise<any>;
  
  // Responses
  responses: FormResponse[];
  responsesLoading: boolean;
  createResponse: (data: any) => Promise<any>;
  
  // Active template management
  activeTemplateId: string | null;
  setActiveTemplateId: (id: string | null) => void;
  
  // Utility functions
  getTemplateByType: (type: 'signup' | 'intake' | 'session_notes') => FormTemplate | undefined;
  getFieldsByTemplate: (templateId: string) => FormField[];
  refetchAll: () => Promise<void>;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

interface FormProviderProps {
  children: ReactNode;
}

export function FormProvider({ children }: FormProviderProps) {
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  
  // Templates data
  const {
    data: templates,
    loading: templatesLoading,
    create: createTemplate,
    update: updateTemplate,
    remove: deleteTemplate,
    refetch: refetchTemplates,
  } = useFormTemplatesData();
  
  // Fields data (for active template)
  const {
    data: fields,
    loading: fieldsLoading,
    create: createField,
    update: updateField,
    remove: deleteField,
    refetch: refetchFields,
  } = useFormFieldsData(activeTemplateId || undefined);
  
  // Responses data
  const {
    data: responses,
    loading: responsesLoading,
    create: createResponse,
    refetch: refetchResponses,
  } = useFormResponsesData();
  
  // Utility functions
  const getTemplateByType = useCallback((type: 'signup' | 'intake' | 'session_notes') => {
    return templates.find(template => template.form_type === type && template.is_active);
  }, [templates]);
  
  const getFieldsByTemplate = useCallback((templateId: string) => {
    return activeTemplateId === templateId ? fields : [];
  }, [activeTemplateId, fields]);
  
  const refetchAll = useCallback(async () => {
    await Promise.all([
      refetchTemplates(),
      refetchFields(),
      refetchResponses(),
    ]);
  }, [refetchTemplates, refetchFields, refetchResponses]);
  
  const value: FormContextType = {
    // Templates
    templates,
    templatesLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    
    // Fields
    fields,
    fieldsLoading,
    createField,
    updateField,
    deleteField,
    
    // Responses
    responses,
    responsesLoading,
    createResponse,
    
    // Active template management
    activeTemplateId,
    setActiveTemplateId,
    
    // Utility functions
    getTemplateByType,
    getFieldsByTemplate,
    refetchAll,
  };
  
  return (
    <FormContext.Provider value={value}>
      {children}
    </FormContext.Provider>
  );
}

export function useFormContext() {
  const context = useContext(FormContext);
  if (context === undefined) {
    throw new Error('useFormContext must be used within a FormProvider');
  }
  return context;
}