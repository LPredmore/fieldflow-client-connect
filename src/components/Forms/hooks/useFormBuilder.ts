import { useState, useCallback } from 'react';
import { FormField, FieldType } from '../types';
import { FIELD_TYPE_CONFIGS } from '../constants';

interface UseFormBuilderReturn {
  fields: FormField[];
  selectedFieldId: string | null;
  addField: (type: FieldType) => void;
  updateField: (id: string, updates: Partial<FormField>) => void;
  deleteField: (id: string) => void;
  duplicateField: (id: string) => void;
  reorderFields: (startIndex: number, endIndex: number) => void;
  selectField: (id: string | null) => void;
  setFields: (fields: FormField[]) => void;
  getSelectedField: () => FormField | undefined;
}

const generateFieldKey = (label: string): string => {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const generateUniqueId = (): string => {
  return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export function useFormBuilder(initialFields: FormField[] = []): UseFormBuilderReturn {
  const [fields, setFieldsState] = useState<FormField[]>(initialFields);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  const setFields = useCallback((newFields: FormField[]) => {
    setFieldsState(newFields);
  }, []);

  const addField = useCallback((type: FieldType) => {
    const config = FIELD_TYPE_CONFIGS[type];
    const newField: FormField = {
      id: generateUniqueId(),
      field_type: type,
      field_key: `new_field_${fields.length + 1}`,
      label: config.label,
      placeholder: 'defaultPlaceholder' in config ? config.defaultPlaceholder : '',
      is_required: false,
      order_index: fields.length,
      validation_rules: {},
      options: ['select', 'multiselect', 'radio', 'checkbox'].includes(type)
        ? [
            { label: 'Option 1', value: 'option_1' },
            { label: 'Option 2', value: 'option_2' },
          ]
        : undefined,
    };

    setFieldsState((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
  }, [fields.length]);

  const updateField = useCallback((id: string, updates: Partial<FormField>) => {
    setFieldsState((prev) =>
      prev.map((field) => {
        if (field.id === id) {
          const updatedField = { ...field, ...updates };
          
          // Auto-generate field_key if label changes
          if (updates.label && updates.label !== field.label) {
            updatedField.field_key = generateFieldKey(updates.label);
          }
          
          return updatedField;
        }
        return field;
      })
    );
  }, []);

  const deleteField = useCallback((id: string) => {
    setFieldsState((prev) => {
      const filtered = prev.filter((field) => field.id !== id);
      // Reorder indices
      return filtered.map((field, index) => ({
        ...field,
        order_index: index,
      }));
    });
    
    if (selectedFieldId === id) {
      setSelectedFieldId(null);
    }
  }, [selectedFieldId]);

  const duplicateField = useCallback((id: string) => {
    setFieldsState((prev) => {
      const fieldToDuplicate = prev.find((field) => field.id === id);
      if (!fieldToDuplicate) return prev;

      const duplicatedField: FormField = {
        ...fieldToDuplicate,
        id: generateUniqueId(),
        field_key: `${fieldToDuplicate.field_key}_copy`,
        label: `${fieldToDuplicate.label} (Copy)`,
        order_index: prev.length,
      };

      return [...prev, duplicatedField];
    });
  }, []);

  const reorderFields = useCallback((startIndex: number, endIndex: number) => {
    setFieldsState((prev) => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);

      // Update order indices
      return result.map((field, index) => ({
        ...field,
        order_index: index,
      }));
    });
  }, []);

  const selectField = useCallback((id: string | null) => {
    setSelectedFieldId(id);
  }, []);

  const getSelectedField = useCallback(() => {
    return fields.find((field) => field.id === selectedFieldId);
  }, [fields, selectedFieldId]);

  return {
    fields,
    selectedFieldId,
    addField,
    updateField,
    deleteField,
    duplicateField,
    reorderFields,
    selectField,
    setFields,
    getSelectedField,
  };
}
