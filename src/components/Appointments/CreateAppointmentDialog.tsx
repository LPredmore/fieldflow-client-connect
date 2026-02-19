import { useState, useEffect } from 'react';
import { useAppointmentCreation } from '@/hooks/useAppointmentCreation';
import { useAppointmentSeries } from '@/hooks/useAppointmentSeries';
import { useServices } from '@/hooks/useServices';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { RRuleBuilder } from '@/components/Appointments/RRuleBuilder';
import { ClientSelector } from '@/components/Clients/ClientSelector';
import { Plus, Calendar, Clock, User, Settings, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface CreateAppointmentDialogProps {
  prefilledDate?: string;
  prefilledTime?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onAppointmentCreated?: () => void | Promise<void>;
}

export function CreateAppointmentDialog({ 
  prefilledDate, 
  prefilledTime,
  trigger,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  onAppointmentCreated
}: CreateAppointmentDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;
  const [loading, setLoading] = useState(false);
  
  const { createAppointment } = useAppointmentCreation();
  const { createSeries } = useAppointmentSeries();
  const { services, defaultService, loading: servicesLoading } = useServices();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    client_id: '',
    service_id: '',
    date: prefilledDate || format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    duration_minutes: 60,
    is_telehealth: true,
    is_recurring: false,
    rrule: 'FREQ=WEEKLY;INTERVAL=1',
  });

  // Set default service when loaded
  useEffect(() => {
    if (defaultService && !formData.service_id) {
      setFormData(prev => ({ ...prev, service_id: defaultService.id }));
    }
  }, [defaultService]);

  // Update date when prefilledDate changes
  useEffect(() => {
    if (prefilledDate) {
      setFormData(prev => ({ ...prev, date: prefilledDate }));
    }
  }, [prefilledDate]);

  // Update time when prefilledTime changes
  useEffect(() => {
    if (prefilledTime) {
      setFormData(prev => ({ ...prev, time: prefilledTime }));
    }
  }, [prefilledTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.client_id || !formData.service_id || !formData.date || !formData.time) {
      toast({
        variant: 'destructive',
        title: 'Missing required fields',
        description: 'Please select a client, session type, date and time',
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
      
      if (formData.is_recurring) {
        // Create recurring series
        await createSeries({
          client_id: formData.client_id,
          service_id: formData.service_id,
          start_date: formData.date,
          start_time: formData.time,
          duration_minutes: formData.duration_minutes,
          rrule: formData.rrule,
          is_telehealth: formData.is_telehealth,
        });
      } else {
        // Create single appointment
        await createAppointment({
          client_id: formData.client_id,
          service_id: formData.service_id,
          date: formData.date,
          time: formData.time,
          duration_minutes: formData.duration_minutes,
          is_telehealth: formData.is_telehealth,
        });
      }
      
      // Notify parent to refresh calendar and wait for it to complete
      if (onAppointmentCreated) {
        if (formData.is_recurring) {
          // Recurring: edge function generates rows asynchronously, wait before refresh
          console.log('[CreateAppointmentDialog] Waiting for recurring occurrences to generate...');
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        console.log('[CreateAppointmentDialog] Calling onAppointmentCreated callback');
        await onAppointmentCreated();
        console.log('[CreateAppointmentDialog] Callback completed');
      }
      setOpen(false);
      
      // Reset form
      setFormData({
        client_id: '',
        service_id: defaultService?.id || '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00',
        duration_minutes: 60,
        is_telehealth: true,
        is_recurring: false,
        rrule: 'FREQ=WEEKLY;INTERVAL=1',
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
                  <Label htmlFor="session_type">Session Type *</Label>
                  {servicesLoading ? (
                    <div className="flex items-center gap-2 p-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground text-sm">Loading session types...</span>
                    </div>
                  ) : (
                    <Select
                      value={formData.service_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, service_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select session type" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map(service => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <Label htmlFor="client">Client *</Label>
                  <ClientSelector
                    value={formData.client_id}
                    onValueChange={(clientId) => setFormData(prev => ({ ...prev, client_id: clientId }))}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="telehealth"
                    checked={formData.is_telehealth}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_telehealth: checked }))}
                  />
                  <Label htmlFor="telehealth">Telehealth Session</Label>
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
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="time">Time *</Label>
                  <Input
                    id="time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Select
                  value={String(formData.duration_minutes)}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, duration_minutes: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                    <SelectItem value="90">90 minutes</SelectItem>
                    <SelectItem value="120">120 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Recurring Options */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-4 w-4" />
                <span className="font-medium">Recurrence</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="recurring"
                  checked={formData.is_recurring}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_recurring: checked }))}
                />
                <Label htmlFor="recurring">Recurring Appointment</Label>
              </div>

              {formData.is_recurring && (
                <div className="mt-4">
                  <RRuleBuilder
                    rrule={formData.rrule}
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
