import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { CustomerSelector } from '@/components/Customers/CustomerSelector';
import { FormTemplate } from '../types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface AssignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: FormTemplate;
  tenantId: string;
}

export function AssignFormDialog({ open, onOpenChange, template, tenantId }: AssignFormDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a customer',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('form_assignments')
        .insert({
          tenant_id: tenantId,
          form_template_id: template.id,
          customer_id: customerId,
          assigned_by_user_id: user?.id,
          due_date: dueDate || null,
          notes: notes || null,
          notify_customer: notifyCustomer,
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Form assigned successfully',
      });

      // Reset form
      setCustomerId('');
      setDueDate('');
      setNotes('');
      setNotifyCustomer(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error assigning form:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to assign form',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Form: {template.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer">Customer *</Label>
            <CustomerSelector
              value={customerId}
              onValueChange={(id) => setCustomerId(id)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-date">Due Date (Optional)</Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any instructions or notes for the customer..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="notify">Notify Customer</Label>
            <Switch
              id="notify"
              checked={notifyCustomer}
              onCheckedChange={setNotifyCustomer}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Form'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
