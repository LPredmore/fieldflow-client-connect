import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useCalendarConnection } from '@/hooks/useCalendarConnection';
import { Calendar, CheckCircle2, AlertTriangle, Loader2, Unplug, RefreshCw } from 'lucide-react';

export default function CalendarSettings() {
  const {
    connection,
    isLoading,
    isConnecting,
    calendars,
    isLoadingCalendars,
    startOAuth,
    selectCalendar,
    disconnect,
    fetchCalendars,
  } = useCalendarConnection();

  const status = connection?.connection_status;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar Integration
          </CardTitle>
          <CardDescription>
            Connect your Google Calendar to sync EHR appointments automatically. Synced events appear as "ValorWell" with no client details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Connection Status</p>
              <div className="flex items-center gap-2">
                {!connection && (
                  <Badge variant="secondary" className="gap-1">
                    <Unplug className="h-3 w-3" />
                    Not Connected
                  </Badge>
                )}
                {status === 'connected' && (
                  <Badge className="gap-1 bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                )}
                {status === 'needs_reconnect' && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Needs Reconnect
                  </Badge>
                )}
              </div>
            </div>

            {/* Action Button */}
            {!connection || status === 'needs_reconnect' ? (
              <Button onClick={startOAuth} disabled={isConnecting}>
                {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {status === 'needs_reconnect' ? 'Reconnect' : 'Connect Google Calendar'}
              </Button>
            ) : (
              <Button variant="outline" onClick={disconnect} className="text-destructive hover:text-destructive">
                Disconnect
              </Button>
            )}
          </div>

          {/* Reconnect Warning */}
          {status === 'needs_reconnect' && connection?.last_error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your Google Calendar connection expired. Reason: {connection.last_error}. Please reconnect to resume syncing.
              </AlertDescription>
            </Alert>
          )}

          {/* Calendar Selector */}
          {status === 'connected' && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Target Calendar</p>
                    <p className="text-sm text-muted-foreground">
                      Choose which calendar receives synced appointments.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={fetchCalendars} disabled={isLoadingCalendars}>
                    <RefreshCw className={`h-4 w-4 ${isLoadingCalendars ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                {isLoadingCalendars ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading calendars...
                  </div>
                ) : calendars.length > 0 ? (
                  <Select
                    value={connection.selected_calendar_id ?? ''}
                    onValueChange={selectCalendar}
                  >
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder="Select a calendar" />
                    </SelectTrigger>
                    <SelectContent>
                      {calendars.map((cal) => (
                        <SelectItem key={cal.id} value={cal.id}>
                          {cal.summary} {cal.primary ? '(Primary)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">No calendars found. Try refreshing.</p>
                )}

                {connection.selected_calendar_id && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      New appointments will automatically sync to this calendar as "ValorWell" events.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Privacy Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privacy & Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Synced events display only "ValorWell" — no client names or clinical details are shared.</p>
          <p>• OAuth tokens are encrypted at rest using AES-256-GCM.</p>
          <p>• Disconnecting immediately revokes access and deletes stored tokens.</p>
        </CardContent>
      </Card>
    </div>
  );
}
