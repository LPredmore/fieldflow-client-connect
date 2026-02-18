import { supabase } from '@/integrations/supabase/client';

/**
 * Fire-and-forget Google Calendar sync for appointment mutations.
 * Non-blocking: if sync fails, the EHR appointment is still correctly saved.
 * The calendar_sync_log table tracks failures for potential retry.
 */
export function syncAppointmentToGoogle(
  appointmentId: string,
  action: 'create' | 'update' | 'delete'
): void {
  supabase.functions
    .invoke('google-calendar-sync-appointment', {
      body: { appointment_id: appointmentId, action },
    })
    .then(({ data }) => {
      if (data?.synced) {
        console.log(`[CalendarSync] ${action} synced for ${appointmentId}`);
      } else {
        console.log(`[CalendarSync] Not synced:`, data?.reason || 'unknown');
      }
    })
    .catch((err) => {
      console.warn(`[CalendarSync] ${action} failed (non-blocking):`, err);
    });
}

/**
 * Sync multiple appointments in parallel (for batch operations).
 * Fire-and-forget, non-blocking.
 */
export function syncMultipleAppointmentsToGoogle(
  appointmentIds: string[],
  action: 'update' | 'delete'
): void {
  for (const id of appointmentIds) {
    syncAppointmentToGoogle(id, action);
  }
}
