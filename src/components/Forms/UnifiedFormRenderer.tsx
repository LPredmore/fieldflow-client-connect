import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { FormField as FormFieldType, FormTemplate } from './types';
import { FieldRenderer } from './DynamicForm/FieldRenderer';
import { generateValidationSchema } from './DynamicForm/validationSchema';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface UnifiedFormRendererProps {
  template: FormTemplate;
  fields: FormFieldType[];
  onSubmit: (data: Record<string, any>) => Promise<void>;
  defaultValues?: Record<string, any>;
  submitButtonText?: string;
  onBack?: () => void;
  showCard?: boolean;
  className?: string;
}

export function UnifiedFormRenderer({
  template,
  fields,
  onSubmit,
  defaultValues = {},
  submitButtonText = 'Submit',
  onBack,
  showCard = true,
  className = '',
}: UnifiedFormRendererProps) {
  // Generate validation schema from fields
  const schema = generateValidationSchema(fields);

  // Initialize form with react-hook-form
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const { handleSubmit, formState, watch } = form;
  const { isSubmitting, isSubmitSuccessful } = formState;
  
  // Watch all form values for conditional logic
  const watchedValues = watch();

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

    const { show_if } = field.conditional_logic;
    const fieldValue = watchedValues[show_if.field_key];

    switch (show_if.operator) {
      case 'equals':
        return fieldValue === show_if.value;
      case 'not_equals':
        return fieldValue !== show_if.value;
      case 'contains':
        return Array.isArray(fieldValue) 
          ? fieldValue.includes(show_if.value)
          : String(fieldValue || '').includes(String(show_if.value));
      case 'greater_than':
        return Number(fieldValue) > Number(show_if.value);
      case 'less_than':
        return Number(fieldValue) < Number(show_if.value);
      default:
        return true;
    }
  };

  // Sort fields by order_index
  const sortedFields = [...fields].sort((a, b) => a.order_index - b.order_index);
  const visibleFields = sortedFields.filter(isFieldVisible);

  const formContent = (
    <>
      {isSubmitSuccessful && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Form submitted successfully!
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {visibleFields.map((field) => (
            <FieldRenderer
              key={field.id}
              field={field}
              control={form.control}
            />
          ))}

          <div className="flex items-center justify-between pt-4">
            {onBack && (
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                disabled={isSubmitting}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            
            <Button
              type="submit"
              disabled={isSubmitting}
              className={onBack ? '' : 'w-full'}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitButtonText}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );

  if (showCard) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{template.name}</CardTitle>
          {template.description && (
            <CardDescription>{template.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {formContent}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {formContent}
    </div>
  );
}