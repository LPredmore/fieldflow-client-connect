import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { FormField as FormFieldType, FormTemplate } from '../types';
import { FieldRenderer } from './FieldRenderer';
import { generateValidationSchema } from './validationSchema';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2 } from 'lucide-react';

interface DynamicFormProps {
  template: FormTemplate;
  fields: FormFieldType[];
  onSubmit: (data: Record<string, any>) => Promise<void>;
  defaultValues?: Record<string, any>;
  submitButtonText?: string;
  onBack?: () => void;
}

export function DynamicForm({
  template,
  fields,
  onSubmit,
  defaultValues = {},
  submitButtonText = 'Submit',
  onBack,
}: DynamicFormProps) {
  // Generate validation schema from fields
  const schema = generateValidationSchema(fields);

  // Initialize form with react-hook-form
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const { handleSubmit, formState } = form;
  const { isSubmitting, isSubmitSuccessful } = formState;

  const handleFormSubmit = async (data: Record<string, any>) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  // Check conditional logic for field visibility
  const isFieldVisible = (field: FormFieldType): boolean => {
    if (!field.conditional_logic) return true;

    const condition = field.conditional_logic.show_if;
    const watchedValue = form.watch(condition.field_key);

    switch (condition.operator) {
      case 'equals':
        return watchedValue === condition.value;
      case 'not_equals':
        return watchedValue !== condition.value;
      case 'contains':
        return String(watchedValue).includes(String(condition.value));
      case 'greater_than':
        return Number(watchedValue) > Number(condition.value);
      case 'less_than':
        return Number(watchedValue) < Number(condition.value);
      default:
        return true;
    }
  };

  if (isSubmitSuccessful) {
    return (
      <Alert className="border-green-500">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <AlertDescription>
          Form submitted successfully! Thank you for your response.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {fields
          .sort((a, b) => a.order_index - b.order_index)
          .filter(isFieldVisible)
          .map((field) => (
            <FieldRenderer key={field.id} field={field} control={form.control} />
          ))}

        <div className="flex gap-3 pt-4">
          {onBack && (
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={isSubmitting}
              className="flex-1"
            >
              Back
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitButtonText}
          </Button>
        </div>
      </form>
    </Form>
  );
}
