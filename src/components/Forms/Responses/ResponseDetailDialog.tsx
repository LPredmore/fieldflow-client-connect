import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { FormTemplate, FormField } from '../types';
import { supabase } from '@/integrations/supabase/client';
import { Download, Loader2, Calendar, User, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface ResponseDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  response: {
    id: string;
    response_data: Record<string, any>;
    submitted_at: string;
    customer: {
      pat_name_f: string | null;
      pat_name_l: string | null;
      pat_name_m: string | null;
      preferred_name: string | null;
      email: string | null;
      full_name?: string;
    };
  };
  template: FormTemplate;
}

export function ResponseDetailDialog({
  open,
  onOpenChange,
  response,
  template,
}: ResponseDetailDialogProps) {
  const { toast } = useToast();
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchFields();
    }
  }, [open, template.id]);

  const fetchFields = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('form_template_fields')
        .select('*')
        .eq('form_template_id', template.id)
        .order('order_index');

      if (error) throw error;
      setFields(data || []);
    } catch (error: any) {
      console.error('Error fetching fields:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load form fields',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (field: FormField, value: any): string => {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    switch (field.field_type) {
      case 'checkbox':
        return value === true ? 'Yes' : 'No';
      case 'multiselect':
        return Array.isArray(value) ? value.join(', ') : String(value);
      case 'date':
        try {
          return format(new Date(value), 'MMM d, yyyy');
        } catch {
          return String(value);
        }
      case 'file':
        return value.name || 'File uploaded';
      default:
        return String(value);
    }
  };

  const handleExportPDF = () => {
    // Create formatted HTML content
    let htmlContent = `
      <html>
        <head>
          <title>${template.name} - Response</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
            .meta { background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .meta-item { margin: 5px 0; }
            .field { margin: 20px 0; padding: 15px; border: 1px solid #e0e0e0; border-radius: 5px; }
            .field-label { font-weight: bold; color: #555; margin-bottom: 5px; }
            .field-value { color: #333; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; }
          </style>
        </head>
        <body>
          <h1>${template.name}</h1>
          <div class="meta">
            <div class="meta-item"><strong>Customer:</strong> ${response.customer.full_name || 'Unknown'}</div>
            ${response.customer.email ? `<div class="meta-item"><strong>Email:</strong> ${response.customer.email}</div>` : ''}
            <div class="meta-item"><strong>Submitted:</strong> ${format(new Date(response.submitted_at), 'MMMM d, yyyy h:mm a')}</div>
          </div>
    `;

    fields.forEach((field) => {
      const value = formatValue(field, response.response_data[field.field_key]);
      htmlContent += `
        <div class="field">
          <div class="field-label">${field.label}${field.is_required ? ' *' : ''}</div>
          <div class="field-value">${value}</div>
        </div>
      `;
    });

    htmlContent += `
          <div class="footer">Generated on ${format(new Date(), 'MMMM d, yyyy')}</div>
        </body>
      </html>
    `;

    // Create and download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name}-${response.customer.full_name || 'Unknown'}-${format(new Date(response.submitted_at), 'yyyy-MM-dd')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Success',
      description: 'Response exported successfully',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Form Response Details</DialogTitle>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </DialogHeader>

        {/* Metadata */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Customer:</span>
            <span>{response.customer.full_name || 'Unknown'}</span>
          </div>
          {response.customer.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Email:</span>
              <span>{response.customer.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Submitted:</span>
            <span>{format(new Date(response.submitted_at), 'MMMM d, yyyy h:mm a')}</span>
          </div>
        </div>

        <Separator />

        {/* Form Responses */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map((field) => (
              <div key={field.id} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-sm">
                    {field.label}
                  </span>
                  {field.is_required && (
                    <Badge variant="secondary" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatValue(field, response.response_data[field.field_key])}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
