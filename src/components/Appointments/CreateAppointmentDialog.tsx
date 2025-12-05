import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Calendar, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useClients } from '@/hooks/useClients';
import { useServices } from '@/hooks/useServices';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getClientDisplayName } from '@/utils/clientDisplayName';

interface CreateAppointmentDialogProps {
  prefilledDate?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateAppointmentDialog({ 
  prefilledDate, 
  trigger,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  onSuccess
}: CreateAppointmentDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;
  const [loading, setLoading] = useState(false);
  
  const { clients } = useClients();
  const { services, defaultService, loading: servicesLoading } = useServices();
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const staffId = user?.staffAttributes?.staffData?.id;

  const [formData, setFormData] = useState({
    client_id: '',
    service_id: defaultService?.id || '',
    date: prefilledDate || format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    duration_minutes: 60,
    is_telehealth: false,
  });

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

    if (!user || !tenantId || !staffId) {
      toast({
        variant: 'destructive',
        title: 'Authentication error',
        description: 'Please log in again',
      });
      return;
    }

    try {
      setLoading(true);
      
      // Create start and end timestamps
      const startDateTime = new Date(`${formData.date}T${formData.time}:00`);
      const endDateTime = new Date(startDateTime.getTime() + formData.duration_minutes * 60 * 1000);

      const { error } = await supabase
        .from('appointments')
        .insert({
          tenant_id: tenantId,
          client_id: formData.client_id,
          staff_id: staffId,
          service_id: formData.service_id,
          start_at: startDateTime.toISOString(),
          end_at: endDateTime.toISOString(),
          status: 'scheduled',
          is_telehealth: formData.is_telehealth,
          time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          created_by_profile_id: user.id,
        });

      if (error) throw error;

      toast({
        title: 'Appointment created',
        description: 'Your appointment has been scheduled successfully',
      });
      
      setOpen(false);
      onSuccess?.();
      
      // Reset form
      setFormData({
        client_id: '',
        service_id: defaultService?.id || '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00',
        duration_minutes: 60,
        is_telehealth: false,
      });
    } catch (error: any) {
      console.error('Failed to create appointment:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to create appointment',
        description: error.message,
      });
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Create New Appointment
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4" />
                <span className="font-medium">Details</span>
              </div>
              
              <div>
                <Label>Session Type *</Label>
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
              </div>

              <div>
                <Label>Client *</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, client_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clients || []).map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {getClientDisplayName(client)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_telehealth}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_telehealth: checked }))}
                />
                <Label>Telehealth Session</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4" />
                <span className="font-medium">Schedule</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Time *</Label>
                  <Input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>Duration</Label>
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
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
