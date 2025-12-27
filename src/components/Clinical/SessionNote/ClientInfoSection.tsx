import React, { memo } from 'react';
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, User } from 'lucide-react';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';
import { StaffAppointment } from '@/hooks/useStaffAppointments';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { parseISO, format } from 'date-fns';

interface ClientInfoSectionProps {
  form: UseFormReturn<any>;
  appointment: StaffAppointment;
  diagnosisCodes: string[];
  formattedDiagnoses: string[];
  diagnosesLoading: boolean;
}

export const ClientInfoSection: React.FC<ClientInfoSectionProps> = memo(({
  form,
  appointment,
  diagnosisCodes,
  formattedDiagnoses,
  diagnosesLoading
}) => {
  // Fetch client's first and last name
  const { data: clientData, loading: clientLoading } = useSupabaseQuery<{
    id: string;
    pat_name_f: string | null;
    pat_name_l: string | null;
  }>({
    table: 'clients',
    select: 'id, pat_name_f, pat_name_l',
    filters: { id: appointment.client_id },
    enabled: !!appointment.client_id,
  });

  const client = clientData?.[0];
  
  // Format client name from first + last
  const clientFullName = clientLoading 
    ? 'Loading...' 
    : client 
      ? `${client.pat_name_f || ''} ${client.pat_name_l || ''}`.trim() 
      : appointment.client_name || '';

  // Format session date as YYYY-MM-DD from start_at timestamp
  const formattedSessionDate = appointment.start_at 
    ? format(parseISO(appointment.start_at), 'yyyy-MM-dd')
    : appointment.display_date || '';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <User className="h-4 w-4" />
          Client Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Row 1: Client Name, Session Date, Clinician */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Client Name</label>
            <Input
              value={clientFullName}
              readOnly
              className="bg-muted/50"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Session Date</label>
            <Input
              value={formattedSessionDate}
              readOnly
              className="bg-muted/50"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Time</label>
            <Input
              value={`${appointment.display_time} - ${appointment.display_end_time}`}
              readOnly
              className="bg-muted/50"
            />
          </div>
        </div>

        {/* Row 2: Diagnoses (read-only) */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Client Diagnoses</label>
          {diagnosesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading diagnoses...
            </div>
          ) : diagnosisCodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No diagnoses on file</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {formattedDiagnoses.map((diagnosis, idx) => (
                <Badge key={idx} variant="secondary">
                  {diagnosis}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Row 3: Medications, Persons in Attendance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="client_medications"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Current Medications</FormLabel>
                <FormControl>
                  <Input placeholder="List current medications..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="client_personsinattendance"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Persons in Attendance</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Client only" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
});

ClientInfoSection.displayName = 'ClientInfoSection';
