import { useState, useEffect } from 'react';
import { useAppointmentCreation } from '@/hooks/useAppointmentCreation';
import { useAppointmentSeries } from '@/hooks/useAppointmentSeries';
import { useCalendarAppointments } from '@/hooks/useCalendarAppointments';
import { useCustomers } from '@/hooks/useCustomers';
import { useUserTimezone } from '@/hooks/useUserTimezone';
import { getCustomerDisplayName } from '@/utils/customerDisplayName';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { RRuleBuilder } from '@/components/Appointments/RRuleBuilder';
import { Plus, Calendar, Clock, User, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface CreateAppointmentDialogProps {
  prefilledDate?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateAppointmentDialog({ 
  prefilledDate, 
  trigger,
  open: externalOpen,
  onOpenChange: externalOnOpenChange
}: CreateAppointmentDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({
    title: 'Therapy Session',
    date: prefilledDate || format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    duration_minutes: 60,
    priority: 'medium',
    is_recurring: false,
    rrule: 'FREQ=WEEKLY;INTERVAL=1',
  });

  const { createOneTimeAppointment } = useAppointmentCreation();
  const { createJobSeries } = useAppointmentSeries();
  const { refetch: refetchCalendar } = useCalendarAppointments();
  const { customers } = useCustomers();
  const { toast } = useToast();
  const timezone = useUserTimezone();

  // Update date when prefilledDate changes
  useEffect(() => {
    if (prefilledDate) {
      setFormData(prev => ({ ...prev, date: prefilledDate }));
    }
  }, [prefilledDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customer_id || !formData.title || !formData.date || !formData.time) {
      toast({
        variant: 'destructive',
        title: 'Missing required fields',
        description: 'Please fill in all required fields',
      });
      return;
    }

    if (formData.is_recurring && !formData.rrule) {
      toast({
        variant: 'destructive',
        title: 'Missing recurrence pattern',
        description: 'Please configure the recurrence pattern for recurring appointments',
      });
      return;
    }

    try {
      setLoading(true);
      
      if (formData.is_recurring && formData.rrule) {
        // Use rolling horizon for recurring appointments
        await createJobSeries({
          title: formData.title,
          customer_id: formData.customer_id,
          description: formData.description,
          start_date: formData.date,
          local_start_time: formData.time,
          timezone: timezone,
          duration_minutes: formData.duration_minutes || 60,
          priority: formData.priority || 'medium',
          is_recurring: true,
          recurrence_rule: formData.rrule,
          until_date: formData.until_date || null,
          active: true,
          assigned_to_user_id: formData.assigned_to_user_id,
        });
        toast({ 
          title: "Recurring appointment series created",
          description: "Initial appointments are being generated. This may take a moment."
        });
      } else {
        // Create one-time appointment
        await createOneTimeAppointment({
          title: formData.title,
          customer_id: formData.customer_id,
          description: formData.description,
          date: formData.date,
          time: formData.time,
          duration_minutes: formData.duration_minutes || 60,
          priority: formData.priority || 'medium',
          assigned_to_user_id: formData.assigned_to_user_id,
        });
      }
      
      await refetchCalendar();
      setOpen(false);
      setFormData({
        title: 'Therapy Session',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00',
        duration_minutes: 60,
        priority: 'medium',
        is_recurring: false,
      });
    } catch (error) {
      console.error('Failed to create appointment:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Appointment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Create New Appointment
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto pr-2">
          {/* Basic Info */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4" />
                <span className="font-medium">Appointment Details</span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Appointment Title *</Label>
                  <Input
                    id="title"
                    value={formData.title || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter appointment title"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="customer">Customer *</Label>
                  <Select
                    value={formData.customer_id || ''}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, customer_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {getCustomerDisplayName(customer)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Appointment description (optional)"
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4" />
                <span className="font-medium">Schedule</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="time">Time *</Label>
                  <Input
                    id="time"
                    type="time"
                    value={formData.time || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration_minutes || 60}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) }))}
                    min="15"
                    step="15"
                  />
                </div>

                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority || 'medium'}
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Options */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-4 w-4" />
                <span className="font-medium">Additional Options</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="recurring"
                  checked={formData.is_recurring || false}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_recurring: checked }))}
                />
                <Label htmlFor="recurring">Recurring Appointment</Label>
              </div>

              {/* Recurrence Rule Builder */}
              {formData.is_recurring && (
                <div className="mt-4">
                  <RRuleBuilder
                    rrule={formData.rrule || 'FREQ=WEEKLY;INTERVAL=1'}
                    onChange={(newRrule) => setFormData(prev => ({ ...prev, rrule: newRrule }))}
                    startDate={formData.date}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Appointment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}