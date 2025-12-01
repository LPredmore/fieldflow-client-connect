import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DynamicForm } from '@/components/Forms/DynamicForm/DynamicForm';
import { FormTemplate, FormField } from '@/components/Forms/types';
import { Loader2, ArrowLeft, Calendar, AlertCircle } from 'lucide-react';
import { format, isPast } from 'date-fns';

interface Assignment {
  id: string;
  form_template_id: string;
  customer_id: string;
  due_date: string | null;
  status: string;
  notes: string | null;
  form_template: {
    id: string;
    name: string;
    description: string | null;
  };
}

export default function CompleteForm() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (assignmentId) {
      fetchAssignment();
    }
  }, [assignmentId]);

  const fetchAssignment = async () => {
    if (!assignmentId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('form_assignments')
        .select(`
          *,
          form_template:form_templates (
            id,
            name,
            description,
            tenant_id,
            form_type,
            is_active,
            version
          )
        `)
        .eq('id', assignmentId)
        .single();

      if (error) throw error;

      if (data.status === 'completed') {
        toast({
          title: 'Form Already Completed',
          description: 'This form has already been submitted.',
        });
        navigate('/client/portal');
        return;
      }

      setAssignment(data);
      setTemplate(data.form_template as FormTemplate);

      // Fetch form fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_template_id', data.form_template_id)
        .order('order_index');

      if (fieldsError) throw fieldsError;
      setFields(fieldsData || []);
    } catch (error: any) {
      console.error('Error fetching assignment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load form assignment',
      });
      navigate('/client/portal');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (data: Record<string, any>) => {
    if (!assignmentId || !assignment || !template) return;

    try {
      // Submit form response
      const { data: responseData, error: submitError } = await supabase
        .from('form_responses')
        .insert({
          form_template_id: template.id,
          customer_id: assignment.customer_id,
          response_data: data,
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (submitError) throw submitError;

      // Update assignment status
      const { error: updateError } = await supabase
        .from('form_assignments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', assignmentId);

      if (updateError) throw updateError;

      toast({
        title: 'Success!',
        description: 'Your form has been submitted successfully.',
      });

      // Navigate back to portal
      setTimeout(() => {
        navigate('/client/portal');
      }, 1500);
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to submit form. Please try again.',
      });
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!assignment || !template || fields.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {loading ? 'Loading form...' : 'Form not found.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOverdue = assignment.due_date && isPast(new Date(assignment.due_date));

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/client/portal')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Portal
          </Button>
        </div>

        {/* Form Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {assignment.form_template.name}
                  {isOverdue && (
                    <Badge variant="destructive" className="text-xs">
                      Overdue
                    </Badge>
                  )}
                </CardTitle>
                {assignment.form_template.description && (
                  <CardDescription className="mt-2">
                    {assignment.form_template.description}
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 text-sm">
              {assignment.due_date && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Due: {format(new Date(assignment.due_date), 'MMMM d, yyyy')}
                  </span>
                  {isOverdue && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
              )}
              {assignment.notes && (
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Instructions:</p>
                  <p className="text-sm text-muted-foreground">{assignment.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Form */}
        <Card>
          <CardHeader>
            <CardTitle>Complete Form</CardTitle>
            <CardDescription>
              Please fill out all required fields below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DynamicForm
              template={template}
              fields={fields}
              onSubmit={handleFormSubmit}
              submitButtonText="Submit Form"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
