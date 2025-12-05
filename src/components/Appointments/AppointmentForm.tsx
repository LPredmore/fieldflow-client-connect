import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserTimezone } from '@/hooks/useUserTimezone';
import { useServices } from '@/hooks/useServices';
import { useClients } from '@/hooks/useClients';
import { combineDateTimeToUTC, splitUTCToLocalDateTime } from '@/lib/timezoneUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClientSelector } from '@/components/Clients/ClientSelector';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Loader2 } from 'lucide-react';

const appointmentSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  service_id: z.string().min(1, 'Service is required'),
  scheduled_date: z.string().min(1, 'Date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  duration_minutes: z.coerce.number().min(15, 'Duration must be at least 15 minutes'),
  status: z.enum(['scheduled', 'completed', 'cancelled']),
  is_telehealth: z.boolean().default(false),
  location_name: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentData {
  id: string;
  client_id: string;
  service_id: string;
  start_at: string;
  end_at: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  is_telehealth: boolean;
  location_name?: string | null;
}

interface AppointmentFormProps {
  appointment?: AppointmentData;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function AppointmentForm({ appointment, onSubmit, onCancel, loading }: AppointmentFormProps) {
  const { user } = useAuth();
  const userTimezone = useUserTimezone();
  const { toast } = useToast();
  const { services, loading: servicesLoading } = useServices();
  const { clients, loading: clientsLoading } = useClients();
  const [selectedClientName, setSelectedClientName] = useState('');

  // Convert existing appointment times to local timezone for display
  const getInitialValues = () => {
    if (appointment?.start_at) {
      const { date, time } = splitUTCToLocalDateTime(appointment.start_at, userTimezone);
      const durationMinutes = Math.round(
        (new Date(appointment.end_at).getTime() - new Date(appointment.start_at).getTime()) / 60000
      );
      return { date, time, durationMinutes };
    }
    return { 
      date: new Date().toISOString().split('T')[0], 
      time: '09:00',
      durationMinutes: 60
    };
  };

  const initialValues = getInitialValues();

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      client_id: appointment?.client_id || '',
      service_id: appointment?.service_id || '',
      scheduled_date: initialValues.date,
      start_time: initialValues.time,
      duration_minutes: initialValues.durationMinutes,
      status: appointment?.status || 'scheduled',
      is_telehealth: appointment?.is_telehealth || false,
      location_name: appointment?.location_name || '',
    },
  });

  // Set default service if there's only one
  useEffect(() => {
    if (!appointment && services && services.length === 1 && !form.getValues('service_id')) {
      form.setValue('service_id', services[0].id);
    }
  }, [services, appointment, form]);

  const handleSubmit = async (data: AppointmentFormData) => {
    try {
      // Convert local date/time to UTC
      const utcStart = combineDateTimeToUTC(data.scheduled_date, data.start_time, userTimezone);
      const utcEnd = new Date(utcStart.getTime() + data.duration_minutes * 60 * 1000);

      const submitData: Record<string, any> = {
        client_id: data.client_id,
        service_id: data.service_id,
        start_at: utcStart.toISOString(),
        end_at: utcEnd.toISOString(),
        status: data.status,
        is_telehealth: data.is_telehealth,
        location_name: data.is_telehealth ? null : (data.location_name || null),
      };

      // Only include time_zone for NEW appointments (not edits)
      // time_zone represents creation context; existing appointments preserve their original timezone
      if (!appointment) {
        submitData.time_zone = userTimezone;
      }

      await onSubmit(submitData);
    } catch (error: any) {
      console.error('Form submission error:', error);
      toast({
        variant: "destructive",
        title: "Error saving appointment",
        description: error.message || "Please check your input and try again.",
      });
    }
  };

  const isLoadingData = servicesLoading || clientsLoading;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Form Validation Errors */}
        {Object.keys(form.formState.errors).length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please fix the following errors:
              <ul className="list-disc list-inside mt-2">
                {Object.entries(form.formState.errors).map(([field, error]) => (
                  <li key={field} className="text-sm">
                    {field}: {error?.message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Client & Service Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Appointment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <FormControl>
                    <ClientSelector
                      value={field.value}
                      onValueChange={(clientId, clientName) => {
                        field.onChange(clientId);
                        setSelectedClientName(clientName);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="service_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={servicesLoading ? "Loading..." : "Select session type"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {services?.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_telehealth"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Telehealth Session</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      This appointment will be conducted via video
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Scheduling */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="scheduled_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(parseInt(val))} 
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="45">45 minutes</SelectItem>
                        <SelectItem value="60">60 minutes</SelectItem>
                        <SelectItem value="90">90 minutes</SelectItem>
                        <SelectItem value="120">120 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Location (if not telehealth) */}
        {!form.watch('is_telehealth') && (
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="location_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Name (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Main Office, Room 101" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || isLoadingData}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {appointment ? 'Update Appointment' : 'Create Appointment'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
