export type FieldType = 
  | 'text' 
  | 'textarea' 
  | 'email' 
  | 'phone' 
  | 'number' 
  | 'date' 
  | 'select' 
  | 'multiselect' 
  | 'radio' 
  | 'checkbox' 
  | 'file';

export interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  fileTypes?: string[];
  maxFileSize?: number;
}

export interface FieldOption {
  label: string;
  value: string;
}

export interface ConditionalLogic {
  show_if: {
    field_key: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
  };
}

export interface FormField {
  id: string;
  form_template_id?: string;
  field_type: FieldType;
  field_key: string;
  label: string;
  placeholder?: string;
  help_text?: string;
  is_required: boolean;
  order_index: number;
  validation_rules?: ValidationRules;
  options?: FieldOption[];
  conditional_logic?: ConditionalLogic;
}

export interface FormTemplate {
  id?: string;
  tenant_id: string;
  form_type: 'signup' | 'intake' | 'session_notes';
  name: string;
  description?: string;
  is_active: boolean;
  version?: number;
  created_at?: string;
  updated_at?: string;
  created_by_user_id?: string;
}

export interface FormResponse {
  id: string;
  form_template_id: string;
  customer_id?: string;
  submitted_by_user_id?: string;
  response_data: Record<string, any>;
  submitted_at: string;
}
