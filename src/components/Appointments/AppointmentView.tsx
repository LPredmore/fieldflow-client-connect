import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, FileText, Edit, Video, MapPin, Repeat } from 'lucide-react';
import { formatInUserTimezone } from '@/lib/timezoneUtils';
import { useUserTimezone } from '@/hooks/useUserTimezone';
import AppointmentForm from './AppointmentForm';

/**
 * Appointment interface matching the actual database schema
 */
interface AppointmentData {
  id: string;
  client_id: string;
  staff_id: string;
  service_id: string;
  series_id?: string | null;
  start_at: string;
  end_at: string;
  time_zone: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  is_telehealth: boolean;
  location_name?: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  service_name?: string;
  clinician_name?: string;
}

interface AppointmentViewProps {
  job: AppointmentData; // Keep 'job' prop name for backward compatibility
  onUpdate?: (appointmentId: string, data: Partial<AppointmentData>) => Promise<any>;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-success text-success-foreground';
    case 'scheduled':
      return 'bg-primary text-primary-foreground';
    case 'cancelled':
      return 'bg-destructive text-destructive-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'scheduled':
      return 'Scheduled';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
};

export default function AppointmentView({ job: appointment, onUpdate }: AppointmentViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const userTimezone = useUserTimezone();

  const handleEdit = () => setIsEditing(true);
  const handleCancelEdit = () => setIsEditing(false);

  const handleSaveEdit = async (formData: any) => {
    if (!onUpdate) return;
    
    setIsLoading(true);
    try {
      await onUpdate(appointment.id, formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update appointment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate duration in minutes
  const durationMinutes = Math.round(
    (new Date(appointment.end_at).getTime() - new Date(appointment.start_at).getTime()) / 60000
  );

  if (isEditing) {
    return (
      <AppointmentForm
        appointment={appointment}
        onSubmit={handleSaveEdit}
        onCancel={handleCancelEdit}
        loading={isLoading}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-2xl font-bold text-foreground">
              {appointment.service_name || 'Appointment'}
            </h2>
            {appointment.series_id && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Repeat className="h-3 w-3" />
                Recurring
              </Badge>
            )}
            {appointment.is_telehealth && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Video className="h-3 w-3" />
                Telehealth
              </Badge>
            )}
          </div>
          <Badge className={getStatusColor(appointment.status)}>
            {getStatusLabel(appointment.status)}
          </Badge>
        </div>
        {onUpdate && (
          <Button onClick={handleEdit} variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        )}
      </div>

      {/* Client Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-4 w-4" />
            Client Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-sm text-muted-foreground">Name:</span>
            <p className="font-medium">{appointment.client_name || 'Unknown Client'}</p>
          </div>
          {appointment.client_email && (
            <div>
              <span className="text-sm text-muted-foreground">Email:</span>
              <p className="font-medium">{appointment.client_email}</p>
            </div>
          )}
          {appointment.client_phone && (
            <div>
              <span className="text-sm text-muted-foreground">Phone:</span>
              <p className="font-medium">{appointment.client_phone}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduling */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-sm text-muted-foreground">Date:</span>
            <p className="font-medium">
              {formatInUserTimezone(appointment.start_at, userTimezone, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Start Time:</span>
              <p className="font-medium">
                {formatInUserTimezone(appointment.start_at, userTimezone, 'h:mm a')}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">End Time:</span>
              <p className="font-medium">
                {formatInUserTimezone(appointment.end_at, userTimezone, 'h:mm a')}
              </p>
            </div>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Duration:</span>
            <p className="font-medium">{durationMinutes} minutes</p>
          </div>
        </CardContent>
      </Card>

      {/* Location / Telehealth */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {appointment.is_telehealth ? (
              <Video className="h-4 w-4" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            {appointment.is_telehealth ? 'Telehealth Session' : 'Location'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appointment.is_telehealth ? (
            <p className="text-muted-foreground">
              This is a telehealth appointment. Video link will be provided.
            </p>
          ) : (
            <p className="font-medium">
              {appointment.location_name || 'No location specified'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Clinician */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-4 w-4" />
            Clinician
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium">{appointment.clinician_name || 'Unassigned'}</p>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-sm text-muted-foreground">Created:</span>
            <p className="font-medium">
              {formatInUserTimezone(appointment.created_at, userTimezone, 'MMM d, yyyy h:mm a')}
            </p>
          </div>
          {appointment.updated_at && (
            <div>
              <span className="text-sm text-muted-foreground">Last Updated:</span>
              <p className="font-medium">
                {formatInUserTimezone(appointment.updated_at, userTimezone, 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          )}
          <div>
            <span className="text-sm text-muted-foreground">Appointment ID:</span>
            <p className="font-mono text-xs text-muted-foreground">{appointment.id}</p>
          </div>
          {appointment.series_id && (
            <div>
              <span className="text-sm text-muted-foreground">Series ID:</span>
              <p className="font-mono text-xs text-muted-foreground">{appointment.series_id}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
