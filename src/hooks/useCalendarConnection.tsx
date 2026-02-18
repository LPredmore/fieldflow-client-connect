import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface CalendarConnection {
  id: string;
  staff_id: string;
  tenant_id: string;
  provider: string;
  connection_status: string;
  selected_calendar_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  primary: boolean;
}

export function useCalendarConnection() {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);

  const staffId = user?.staffAttributes?.staffData?.id;

  // Fetch connection status
  const { data: connection, isLoading, refetch } = useQuery({
    queryKey: ['calendar-connection', staffId],
    queryFn: async () => {
      if (!staffId) return null;
      const { data, error } = await supabase
        .from('staff_calendar_connections')
        .select('*')
        .eq('staff_id', staffId)
        .eq('provider', 'google')
        .maybeSingle();

      if (error) throw error;
      return data as CalendarConnection | null;
    },
    enabled: !!staffId,
    staleTime: 30_000,
  });

  // Handle OAuth callback query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('calendar_connected');
    const error = params.get('calendar_error');

    if (connected === 'true') {
      toast({ title: 'Google Calendar connected', description: 'You can now select a calendar to sync.' });
      refetch();
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('calendar_connected');
      window.history.replaceState({}, '', url.toString());
    } else if (error) {
      toast({
        variant: 'destructive',
        title: 'Calendar connection failed',
        description: error === 'token_exchange_failed'
          ? 'Google rejected the authorization. Please try again.'
          : `Error: ${error}`,
      });
      const url = new URL(window.location.href);
      url.searchParams.delete('calendar_error');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Start OAuth flow
  const startOAuth = useCallback(async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth-start');
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No OAuth URL returned');
      }
    } catch (err: any) {
      console.error('OAuth start error:', err);
      toast({
        variant: 'destructive',
        title: 'Failed to start Google connection',
        description: err.message || 'Please try again.',
      });
      setIsConnecting(false);
    }
  }, [toast]);

  // List calendars
  const fetchCalendars = useCallback(async () => {
    setIsLoadingCalendars(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-list-calendars');
      if (error) throw error;
      setCalendars(data?.calendars ?? []);
      return data;
    } catch (err: any) {
      console.error('List calendars error:', err);
      toast({
        variant: 'destructive',
        title: 'Failed to load calendars',
        description: err.message || 'Please try again.',
      });
      return null;
    } finally {
      setIsLoadingCalendars(false);
    }
  }, [toast]);

  // Auto-fetch calendars when connected
  useEffect(() => {
    if (connection?.connection_status === 'connected') {
      fetchCalendars();
    }
  }, [connection?.connection_status, fetchCalendars]);

  // Select a calendar
  const selectCalendar = useCallback(async (calendarId: string) => {
    if (!connection) return;
    const { error } = await supabase
      .from('staff_calendar_connections')
      .update({ selected_calendar_id: calendarId, updated_at: new Date().toISOString() })
      .eq('id', connection.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to select calendar', description: error.message });
    } else {
      toast({ title: 'Calendar selected', description: 'Appointments will sync to this calendar.' });
      refetch();
    }
  }, [connection, toast, refetch]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (!connection) return;
    const { error } = await supabase
      .from('staff_calendar_connections')
      .delete()
      .eq('id', connection.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to disconnect', description: error.message });
    } else {
      toast({ title: 'Google Calendar disconnected' });
      setCalendars([]);
      queryClient.invalidateQueries({ queryKey: ['calendar-connection'] });
    }
  }, [connection, toast, queryClient]);

  return {
    connection,
    isLoading,
    isConnecting,
    calendars,
    isLoadingCalendars,
    startOAuth,
    fetchCalendars,
    selectCalendar,
    disconnect,
    refetch,
  };
}
