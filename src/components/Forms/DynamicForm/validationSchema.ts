import { z } from 'zod';
import { FormField } from '../types';

export const generateValidationSchema = (fields: FormField[]) => {
  const shape: Record<string, any> = {};
  
  fields.forEach(field => {
    let validator: any;
    
    // Base validators by type
    switch (field.field_type) {
      case 'email':
        validator = z.string().email('Invalid email address');
        break;
      case 'number':
        validator = z.coerce.number({ invalid_type_error: 'Must be a number' });
        break;
      case 'date':
        validator = z.string().min(1, 'Date is required');
        break;
      case 'phone':
        validator = z.string();
        break;
      case 'select':
      case 'radio':
        validator = z.string().min(1, 'Please select an option');
        break;
      case 'multiselect':
      case 'checkbox':
        validator = z.array(z.string()).min(0);
        break;
      case 'file':
        validator = z.any();
        break;
      default:
        validator = z.string();
    }
    
    // Apply validation rules
    if (field.validation_rules && validator) {
      const rules = field.validation_rules;
      
      if (field.field_type === 'text' || field.field_type === 'textarea' || field.field_type === 'email') {
        if (rules.minLength) {
          validator = validator.min(rules.minLength, `Minimum ${rules.minLength} characters required`);
        }
        if (rules.maxLength) {
          validator = validator.max(rules.maxLength, `Maximum ${rules.maxLength} characters allowed`);
        }
        if (rules.pattern) {
          try {
            validator = validator.regex(new RegExp(rules.pattern), 'Invalid format');
          } catch (e) {
            console.warn('Invalid regex pattern:', rules.pattern);
          }
        }
      }
      
      if (field.field_type === 'number') {
        if (rules.min !== undefined) {
          validator = validator.gte(rules.min, `Minimum value is ${rules.min}`);
        }
        if (rules.max !== undefined) {
          validator = validator.lte(rules.max, `Maximum value is ${rules.max}`);
        }
      }
    }
    
    // Make optional if not required
    if (!field.is_required) {
      validator = validator.optional().or(z.literal(''));
    } else {
      // Add required message for empty strings
      if (field.field_type === 'text' || field.field_type === 'textarea' || field.field_type === 'email') {
        validator = validator.min(1, `${field.label} is required`);
      }
    }
    
    shape[field.field_key] = validator;
  });
  
  return z.object(shape);
};
