import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, FileText, Repeat } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUserTimezone } from '@/hooks/useUserTimezone';
import { formatInUserTimezone } from '@/lib/timezoneUtils';
import { format } from 'date-fns';

/**
 * Appointment Series interface matching the actual database schema
 */
interface AppointmentSeriesData {
  id: string;
  client_id: string;
  staff_id: string;
  service_id: string;
  rrule: string;
  start_at: string;
  duration_minutes: number;
  time_zone: string;
  series_end_date: string | null;
  max_occurrences: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  client_name?: string;
  service_name?: string;
  clinician_name?: string;
  // Computed stats
  total_occurrences?: number;
  completed_occurrences?: number;
  next_occurrence_date?: string;
}

interface AppointmentSeriesViewProps {
  jobSeries: AppointmentSeriesData; // Keep 'jobSeries' prop name for backward compatibility
  onUpdate?: (seriesId: string, data: Partial<AppointmentSeriesData>) => Promise<any>;
}

export default function AppointmentSeriesView({ jobSeries: series, onUpdate }: AppointmentSeriesViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const userTimezone = useUserTimezone();

  const handleToggleActive = async () => {
    if (!onUpdate) return;
    
    setIsLoading(true);
    try {
      const confirmText = series.is_active 
        ? 'Deactivating this series will cancel all future scheduled appointments. Completed appointments will remain unchanged. Do you want to continue?'
        : 'Reactivating this series will resume scheduling future appointments. Do you want to continue?';
      
      const confirmed = window.confirm(confirmText);
      if (!confirmed) {
        setIsLoading(false);
        return;
      }
      
      await onUpdate(series.id, { is_active: !series.is_active });
    } catch (error) {
      console.error('Failed to update series:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Parse RRULE for human-readable display
  const parseRRule = (rrule: string): string => {
    try {
      const parts = rrule.split(';').reduce((acc: Record<string, string>, part) => {
        const [key, value] = part.split('=');
        acc[key] = value;
        return acc;
      }, {});
      
      const freq = parts.FREQ?.toLowerCase() || 'unknown';
      const interval = parseInt(parts.INTERVAL || '1');
      const count = parts.COUNT ? `for ${parts.COUNT} occurrences` : '';
      
      let freqText = freq;
      if (freq === 'daily') freqText = interval === 1 ? 'Daily' : `Every ${interval} days`;
      if (freq === 'weekly') freqText = interval === 1 ? 'Weekly' : `Every ${interval} weeks`;
      if (freq === 'monthly') freqText = interval === 1 ? 'Monthly' : `Every ${interval} months`;
      
      return `${freqText} ${count}`.trim();
    } catch {
      return rrule;
    }
  };

  return (
    <div className="space-y-6">
      {/* Series Alert */}
      <Alert>
        <Repeat className="h-4 w-4" />
        <AlertDescription>
          This is a recurring appointment series. Changes to the series status will affect all future scheduled appointments.
        </AlertDescription>
      </Alert>

      {/* Header with Status Toggle */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-2xl font-bold text-foreground">
              {series.service_name || 'Appointment Series'}
            </h2>
            <Badge variant="secondary">Series</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={series.is_active ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}>
              {series.is_active ? 'Active' : 'Inactive'}
            </Badge>
            {series.total_occurrences !== undefined && (
              <Badge variant="outline">
                {series.completed_occurrences || 0} / {series.total_occurrences} completed
              </Badge>
            )}
          </div>
        </div>
        {onUpdate && (
          <Button 
            onClick={handleToggleActive} 
            variant={series.is_active ? "destructive" : "default"} 
            disabled={isLoading}
          >
            {series.is_active ? 'Deactivate Series' : 'Reactivate Series'}
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
        <CardContent>
          <div>
            <span className="text-sm text-muted-foreground">Client:</span>
            <p className="font-medium">{series.client_name || 'Unknown Client'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-sm text-muted-foreground">Start Date:</span>
            <p className="font-medium">
              {formatInUserTimezone(series.start_at, userTimezone, 'MMMM d, yyyy')}
            </p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Start Time:</span>
            <p className="font-medium">
              {formatInUserTimezone(series.start_at, userTimezone, 'h:mm a')}
            </p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Duration:</span>
            <p className="font-medium">{series.duration_minutes} minutes</p>
          </div>
          {series.series_end_date && (
            <div>
              <span className="text-sm text-muted-foreground">End Date:</span>
              <p className="font-medium">{format(new Date(series.series_end_date), 'MMMM d, yyyy')}</p>
            </div>
          )}
          {series.next_occurrence_date && (
            <div>
              <span className="text-sm text-muted-foreground">Next Appointment:</span>
              <p className="font-medium">
                {formatInUserTimezone(series.next_occurrence_date, userTimezone, 'MMMM d, yyyy h:mm a')}
              </p>
            </div>
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
          <p className="font-medium">{series.clinician_name || 'Unassigned'}</p>
        </CardContent>
      </Card>

      {/* Recurrence Pattern */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            Recurrence Pattern
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-sm text-muted-foreground">Pattern:</span>
            <p className="font-medium">{parseRRule(series.rrule)}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Timezone:</span>
            <p className="font-medium">{series.time_zone}</p>
          </div>
          {series.max_occurrences && (
            <div>
              <span className="text-sm text-muted-foreground">Max Occurrences:</span>
              <p className="font-medium">{series.max_occurrences}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {series.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{series.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Series Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-sm text-muted-foreground">Created:</span>
            <p className="font-medium">
              {formatInUserTimezone(series.created_at, userTimezone, 'MMM d, yyyy h:mm a')}
            </p>
          </div>
          {series.updated_at && (
            <div>
              <span className="text-sm text-muted-foreground">Last Updated:</span>
              <p className="font-medium">
                {formatInUserTimezone(series.updated_at, userTimezone, 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          )}
          <div>
            <span className="text-sm text-muted-foreground">Series ID:</span>
            <p className="font-mono text-xs text-muted-foreground">{series.id}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
