import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DynamicForm } from '../DynamicForm/DynamicForm';
import { FormTemplate, FormField } from '../types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface SessionNoteQuickFillProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  customerId: string;
  customerName: string;
  appointmentDate: string;
  serviceName?: string;
  tenantId: string;
  onSuccess?: () => void;
}

export function SessionNoteQuickFill({
  open,
  onOpenChange,
  appointmentId,
  customerId,
  customerName,
  appointmentDate,
  serviceName,
  tenantId,
  onSuccess,
}: SessionNoteQuickFillProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, tenantId]);

  useEffect(() => {
    if (selectedTemplateId) {
      fetchFields();
    }
  }, [selectedTemplateId]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('form_type', 'session_notes')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load session note templates',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFields = async () => {
    if (!selectedTemplateId) return;

    try {
      const { data: templateData, error: templateError } = await supabase
        .from('form_templates')
        .select('*')
        .eq('id', selectedTemplateId)
        .single();

      if (templateError) throw templateError;
      setSelectedTemplate(templateData);

      const { data: fieldsData, error: fieldsError } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_template_id', selectedTemplateId)
        .order('order_index');

      if (fieldsError) throw fieldsError;
      setFields(fieldsData || []);
    } catch (error: any) {
      console.error('Error fetching template fields:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load form fields',
      });
    }
  };

  const handleSubmit = async (formData: Record<string, any>) => {
    if (!selectedTemplate) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('form_responses')
        .insert({
          form_template_id: selectedTemplate.id,
          customer_id: customerId,
          appointment_id: appointmentId,
          response_data: formData,
          submitted_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Session note saved successfully',
      });

      // Reset and close
      setSelectedTemplateId('');
      setSelectedTemplate(null);
      setFields([]);
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error saving session note:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save session note',
      });
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Session Note</DialogTitle>
        </DialogHeader>

        {/* Appointment Info */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
          <div>
            <span className="font-medium">Client:</span> {customerName}
          </div>
          <div>
            <span className="font-medium">Date:</span> {appointmentDate}
          </div>
          {serviceName && (
            <div>
              <span className="font-medium">Service:</span> {serviceName}
            </div>
          )}
        </div>

        {/* Template Selection */}
        <div className="space-y-2">
          <Label>Select Template *</Label>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active session note templates available. Create one in the Forms section.
            </p>
          ) : (
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id!}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Dynamic Form */}
        {selectedTemplate && fields.length > 0 && (
          <div className="border-t pt-4">
            <DynamicForm
              template={selectedTemplate}
              fields={fields}
              onSubmit={handleSubmit}
              submitButtonText={submitting ? 'Saving...' : 'Save Session Note'}
            />
          </div>
        )}

        {/* Cancel Button (only show if no form selected) */}
        {!selectedTemplate && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
