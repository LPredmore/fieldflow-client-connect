import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FormTemplate {
  id: string;
  name: string;
  description: string | null;
  form_type: string | null;
}

interface AssignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  pendingTemplateIds: string[];
  onAssign: (data: { form_template_id: string; due_at?: string; notes?: string }) => Promise<boolean>;
}

export function AssignFormDialog({
  open,
  onOpenChange,
  clientId,
  pendingTemplateIds,
  onAssign,
}: AssignFormDialogProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Fetch available templates
  useEffect(() => {
    if (!open) return;

    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('form_templates')
          .select('id, name, description, form_type')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;

        // Filter out templates already pending for this client
        const availableTemplates = (data || []).filter(
          t => !pendingTemplateIds.includes(t.id)
        );

        setTemplates(availableTemplates);
      } catch (err: any) {
        console.error('Error fetching templates:', err);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load form templates',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [open, pendingTemplateIds, toast]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedTemplateId('');
      setDueDate('');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTemplateId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a form to assign',
      });
      return;
    }

    setSubmitting(true);
    const success = await onAssign({
      form_template_id: selectedTemplateId,
      due_at: dueDate || undefined,
      notes: notes || undefined,
    });

    setSubmitting(false);

    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Assign Form to Client
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : templates.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No forms available to assign.</p>
            <p className="text-sm mt-1">
              All active forms are already assigned to this client.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="form-template">Form *</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger id="form-template">
                  <SelectValue placeholder="Select a form to assign" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex flex-col">
                        <span>{template.name}</span>
                        {template.form_type && (
                          <span className="text-xs text-muted-foreground capitalize">
                            {template.form_type.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplateId && (
                <p className="text-xs text-muted-foreground">
                  {templates.find(t => t.id === selectedTemplateId)?.description}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="due-date">Due Date (Optional)</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this assignment..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !selectedTemplateId}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Assign Form
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
