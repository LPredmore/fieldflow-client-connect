import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '../types';
import { DynamicForm } from '../DynamicForm/DynamicForm';
import { toast } from 'sonner';

interface FormPreviewProps {
  fields: FormField[];
  formName: string;
}

export function FormPreview({ fields, formName }: FormPreviewProps) {
  const handlePreviewSubmit = (data: Record<string, any>) => {
    console.log('Preview form data:', data);
    toast.success('Form preview submitted successfully!');
    return Promise.resolve();
  };

  // Create a mock template for the preview
  const mockTemplate = {
    id: 'preview',
    tenant_id: 'preview',
    form_type: 'intake' as const,
    name: formName || 'Form Preview',
    is_active: true,
  };

  return (
    <Card className="h-full overflow-auto">
      <CardHeader>
        <CardTitle className="text-lg">Live Preview</CardTitle>
        <CardDescription>
          See how your form will look to users
        </CardDescription>
      </CardHeader>
      <CardContent>
        {fields.length === 0 ? (
          <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">No fields to preview</p>
              <p className="text-sm text-muted-foreground">
                Add fields to see the preview
              </p>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg p-6 bg-background">
            <DynamicForm
              template={mockTemplate}
              fields={fields}
              onSubmit={handlePreviewSubmit}
              submitButtonText="Submit (Preview)"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
