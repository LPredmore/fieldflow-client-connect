import { FieldType } from './types';
import { 
  Type, 
  Mail, 
  Phone, 
  Hash, 
  Calendar, 
  List, 
  CheckSquare, 
  Circle, 
  Upload, 
  AlignLeft 
} from 'lucide-react';

export const FIELD_TYPE_CONFIGS = {
  text: {
    label: 'Text Input',
    icon: Type,
    description: 'Single line text input',
    defaultPlaceholder: 'Enter text...',
  },
  textarea: {
    label: 'Text Area',
    icon: AlignLeft,
    description: 'Multi-line text input',
    defaultPlaceholder: 'Enter detailed text...',
  },
  email: {
    label: 'Email',
    icon: Mail,
    description: 'Email address input',
    defaultPlaceholder: 'email@example.com',
  },
  phone: {
    label: 'Phone',
    icon: Phone,
    description: 'Phone number input',
    defaultPlaceholder: '(555) 555-5555',
  },
  number: {
    label: 'Number',
    icon: Hash,
    description: 'Numeric input',
    defaultPlaceholder: '0',
  },
  date: {
    label: 'Date',
    icon: Calendar,
    description: 'Date picker',
    defaultPlaceholder: 'Select date...',
  },
  select: {
    label: 'Dropdown',
    icon: List,
    description: 'Single select dropdown',
    defaultPlaceholder: 'Select option...',
  },
  multiselect: {
    label: 'Multi-Select',
    icon: CheckSquare,
    description: 'Multiple selection',
    defaultPlaceholder: 'Select options...',
  },
  radio: {
    label: 'Radio Group',
    icon: Circle,
    description: 'Single choice radio buttons',
  },
  checkbox: {
    label: 'Checkbox',
    icon: CheckSquare,
    description: 'Multiple choice checkboxes',
  },
  file: {
    label: 'File Upload',
    icon: Upload,
    description: 'File upload field',
  },
} as const;

export const FIELD_TYPES: FieldType[] = [
  'text',
  'textarea',
  'email',
  'phone',
  'number',
  'date',
  'select',
  'radio',
  'checkbox',
  'file',
];
