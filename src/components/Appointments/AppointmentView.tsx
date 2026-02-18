import { useState, useCallback, useMemo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, Edit, Video, MapPin, Repeat, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AppointmentForm from './AppointmentForm';
import { RecurringEditDialog } from './RecurringEditDialog';
import { DeleteAppointmentDialog } from './DeleteAppointmentDialog';
import { useRecurringAppointmentActions, type EditScope, type DeleteScope } from '@/hooks/useRecurringAppointmentActions';

/**
 * Appointment interface with server-side formatted display strings
 * This now expects data from useStaffAppointments which provides pre-formatted strings
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
  status: string;
  is_telehealth: boolean;
  videoroom_url?: string | null;
  location_name?: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  service_name?: string;
  clinician_name?: string;
  // Server-side formatted display strings (from useStaffAppointments)
  display_date?: string;
  display_time?: string;
  display_end_time?: string;
  display_timezone?: string;
  // Server-resolved time components (from RPC, for edit form prepopulation)
  start_year?: number;
  start_month?: number;
  start_day?: number;
  start_hour?: number;
  start_minute?: number;
}

interface AppointmentViewProps {
  job: AppointmentData; // Keep 'job' prop name for backward compatibility
  onUpdate?: (appointmentId: string, data: Partial<AppointmentData>) => Promise<any>;
  onDelete?: () => void; // Callback after successful delete
  onRefresh?: () => void; // Callback to refresh data
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

export default function AppointmentView({ 
  job: appointment, 
  onUpdate, 
  onDelete,
  onRefresh 
}: AppointmentViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<any>(null);
  const [showEditScopeDialog, setShowEditScopeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // The appointment's display timezone (from server-side resolution)
  const appointmentTimezone = appointment.display_timezone || appointment.time_zone;

  // Use server-side pre-formatted strings for main display (from useStaffAppointments)
  const displayDate = appointment.display_date || '';
  const displayStartTime = appointment.display_time || '';
  const displayEndTime = appointment.display_end_time || '';

  // Format metadata timestamps using server-side RPC (no client-side TZ conversion)
  const [displayCreatedAt, setDisplayCreatedAt] = useState('');
  const [displayUpdatedAt, setDisplayUpdatedAt] = useState('');

  useEffect(() => {
    const formatTimestamps = async () => {
      const tz = appointmentTimezone || 'America/New_York';
      const fmt = 'FMMonth DD, YYYY HH12:MI AM';
      
      const [createdRes, updatedRes] = await Promise.all([
        appointment.created_at
          ? supabase.rpc('format_timestamp_in_timezone', { p_timestamp: appointment.created_at, p_timezone: tz, p_format: fmt })
          : Promise.resolve({ data: null }),
        appointment.updated_at
          ? supabase.rpc('format_timestamp_in_timezone', { p_timestamp: appointment.updated_at, p_timezone: tz, p_format: fmt })
          : Promise.resolve({ data: null }),
      ]);
      
      if (createdRes.data) setDisplayCreatedAt(createdRes.data);
      if (updatedRes.data) setDisplayUpdatedAt(updatedRes.data);
    };
    
    formatTimestamps();
  }, [appointment.created_at, appointment.updated_at, appointmentTimezone]);

  const {
    editSingleOccurrence,
    editThisAndFuture,
    updateAppointment,
    deleteSingleOccurrence,
    deleteThisAndFuture,
    deleteEntireSeries,
    deleteAppointment,
  } = useRecurringAppointmentActions();

  const isRecurring = Boolean(appointment.series_id);

  const handleEdit = () => setIsEditing(true);
  const handleCancelEdit = () => {
    setIsEditing(false);
    setPendingFormData(null);
  };

  const handleSaveEdit = useCallback(async (formData: any) => {
    if (isRecurring) {
      // Store form data and show scope dialog
      setPendingFormData(formData);
      setShowEditScopeDialog(true);
    } else {
      // Direct update for non-recurring appointments
      setIsLoading(true);
      try {
        if (onUpdate) {
          await onUpdate(appointment.id, formData);
        } else {
          await updateAppointment(appointment.id, formData);
        }
        setIsEditing(false);
        onRefresh?.();
      } catch (error) {
        console.error('Failed to update appointment:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [isRecurring, appointment.id, onUpdate, updateAppointment, onRefresh]);

  const handleEditScopeSelect = useCallback(async (scope: EditScope) => {
    if (!pendingFormData) return;
    
    setIsLoading(true);
    try {
      if (scope === 'this_only') {
        await editSingleOccurrence(appointment.id, pendingFormData);
      } else {
        await editThisAndFuture(appointment.id, pendingFormData);
      }
      setShowEditScopeDialog(false);
      setIsEditing(false);
      setPendingFormData(null);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to update appointment:', error);
    } finally {
      setIsLoading(false);
    }
  }, [pendingFormData, appointment.id, editSingleOccurrence, editThisAndFuture, onRefresh]);

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = useCallback(async (scope: DeleteScope) => {
    setIsLoading(true);
    try {
      if (!isRecurring || scope === 'this_only') {
        if (isRecurring) {
          await deleteSingleOccurrence(appointment.id);
        } else {
          await deleteAppointment(appointment.id);
        }
      } else if (scope === 'this_and_future') {
        await deleteThisAndFuture(appointment.id);
      } else if (scope === 'entire_series' && appointment.series_id) {
        await deleteEntireSeries(appointment.series_id);
      }
      setShowDeleteDialog(false);
      onDelete?.();
      onRefresh?.();
    } catch (error) {
      console.error('Failed to delete appointment:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isRecurring, appointment.id, appointment.series_id, deleteSingleOccurrence, deleteAppointment, deleteThisAndFuture, deleteEntireSeries, onDelete, onRefresh]);

  // Calculate duration in minutes
  const durationMinutes = Math.round(
    (new Date(appointment.end_at).getTime() - new Date(appointment.start_at).getTime()) / 60000
  );

  // Build server-resolved local date/time from RPC time components
  // These are integers from get_staff_calendar_appointments, no client-side TZ conversion needed
  const serverLocalDate = useMemo(() => {
    const appt = appointment as any;
    if (appt.start_year && appt.start_month && appt.start_day) {
      const y = appt.start_year;
      const m = String(appt.start_month).padStart(2, '0');
      const d = String(appt.start_day).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return undefined;
  }, [appointment]);

  const serverLocalTime = useMemo(() => {
    const appt = appointment as any;
    if (appt.start_hour !== undefined && appt.start_minute !== undefined) {
      const h = String(appt.start_hour).padStart(2, '0');
      const min = String(appt.start_minute).padStart(2, '0');
      return `${h}:${min}`;
    }
    return undefined;
  }, [appointment]);

  if (isEditing) {
    const formAppointment = {
      id: appointment.id,
      client_id: appointment.client_id,
      service_id: appointment.service_id,
      start_at: appointment.start_at,
      end_at: appointment.end_at,
      status: appointment.status as 'scheduled' | 'completed' | 'cancelled',
      is_telehealth: appointment.is_telehealth,
      location_name: appointment.location_name,
      server_local_date: serverLocalDate,
      server_local_time: serverLocalTime,
    };
    
    return (
      <>
        <AppointmentForm
          appointment={formAppointment}
          onSubmit={handleSaveEdit}
          onCancel={handleCancelEdit}
          loading={isLoading}
        />
        <RecurringEditDialog
          open={showEditScopeDialog}
          onOpenChange={setShowEditScopeDialog}
          onSelect={handleEditScopeSelect}
          isLoading={isLoading}
        />
      </>
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
            {isRecurring && (
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
        <div className="flex gap-2">
          {appointment.status !== 'cancelled' && (
            <>
              {onUpdate && (
                <Button onClick={handleEdit} variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              <Button onClick={handleDeleteClick} variant="outline" className="text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
        </div>
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
            <p className="font-medium">{displayDate}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Start Time:</span>
              <p className="font-medium">{displayStartTime}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">End Time:</span>
              <p className="font-medium">{displayEndTime}</p>
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
            <div className="space-y-3">
              {appointment.videoroom_url ? (
                <a 
                  href={appointment.videoroom_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  <Video className="h-4 w-4" />
                  Join Video Call
                </a>
              ) : (
                <p className="text-muted-foreground">
                  Video room is being set up...
                </p>
              )}
            </div>
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
            <p className="font-medium">{displayCreatedAt}</p>
          </div>
          {appointment.updated_at && displayUpdatedAt && (
            <div>
              <span className="text-sm text-muted-foreground">Last Updated:</span>
              <p className="font-medium">{displayUpdatedAt}</p>
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

      {/* Delete Dialog */}
      <DeleteAppointmentDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteConfirm}
        isRecurring={isRecurring}
        isLoading={isLoading}
      />
    </div>
  );
}
