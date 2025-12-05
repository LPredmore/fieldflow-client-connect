/**
 * Appointment Time Utilities
 * 
 * INVARIANT TIME MODEL:
 * - Database stores UTC timestamps ONLY (start_at, end_at as timestamptz)
 * - Browser converts local → UTC on create
 * - Browser converts UTC → local on read
 * - Gutter/working hours use browser local time directly
 * 
 * This module uses Luxon for clarity and correctness.
 */

import { DateTime } from 'luxon';

/**
 * Get the current user's browser timezone.
 * Example: "America/Chicago", "America/New_York", "Europe/London"
 */
export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Convert local date/time input to UTC for database storage.
 * 
 * Usage when creating an appointment:
 * - User picks date "2025-12-05" and time "10:00" in their local timezone
 * - This function converts to UTC for storage
 * 
 * @param date - Date string in YYYY-MM-DD format
 * @param time - Time string in HH:mm format
 * @returns Object with utcDate (Date for Supabase) and isoString (for direct insert)
 */
export function localToUTC(date: string, time: string): { utcDate: Date; isoString: string } {
  const timezone = getBrowserTimezone();
  
  // Parse the date/time components
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  
  // Create DateTime in user's local timezone
  const local = DateTime.fromObject(
    { year, month, day, hour, minute, second: 0 },
    { zone: timezone }
  );
  
  // Convert to UTC
  const utc = local.toUTC();
  
  return {
    utcDate: utc.toJSDate(),
    isoString: utc.toISO() || utc.toJSDate().toISOString(),
  };
}

/**
 * Convert UTC timestamp from database to local JS Date for calendar display.
 * 
 * Usage when reading appointments:
 * - Supabase returns UTC timestamp like "2025-12-05T16:00:00+00:00"
 * - This function converts to a JS Date in user's local timezone
 * - The returned Date is what react-big-calendar uses for positioning
 * 
 * @param utcTimestamp - UTC timestamp string from Supabase
 * @returns JS Date object representing the local time
 */
export function utcToLocal(utcTimestamp: string): Date {
  const timezone = getBrowserTimezone();
  
  // Parse as UTC
  const utc = DateTime.fromISO(utcTimestamp, { zone: 'utc' });
  
  // Convert to user's local timezone
  const local = utc.setZone(timezone);
  
  // Return as JS Date - this Date represents the correct local time
  return local.toJSDate();
}

/**
 * Format a UTC timestamp for display in user's local timezone.
 * 
 * @param utcTimestamp - UTC timestamp string from Supabase
 * @param formatString - Luxon format string (default: 'h:mm a' for "3:00 PM")
 * @returns Formatted string in user's local timezone
 */
export function formatUTCAsLocal(utcTimestamp: string, formatString: string = 'h:mm a'): string {
  const timezone = getBrowserTimezone();
  
  const utc = DateTime.fromISO(utcTimestamp, { zone: 'utc' });
  const local = utc.setZone(timezone);
  
  return local.toFormat(formatString);
}

/**
 * Get local date and time strings from a UTC timestamp.
 * Used for populating form inputs when editing an appointment.
 * 
 * @param utcTimestamp - UTC timestamp string from Supabase
 * @returns Object with date (YYYY-MM-DD) and time (HH:mm) strings in local timezone
 */
export function utcToLocalStrings(utcTimestamp: string): { date: string; time: string } {
  const timezone = getBrowserTimezone();
  
  const utc = DateTime.fromISO(utcTimestamp, { zone: 'utc' });
  const local = utc.setZone(timezone);
  
  return {
    date: local.toFormat('yyyy-MM-dd'),
    time: local.toFormat('HH:mm'),
  };
}

/**
 * Calculate end time by adding duration to start time.
 * Works with UTC timestamps.
 * 
 * @param startUtcTimestamp - UTC start timestamp
 * @param durationMinutes - Duration in minutes
 * @returns Object with UTC end time
 */
export function calculateEndUTC(
  startUtcTimestamp: string, 
  durationMinutes: number
): { utcDate: Date; isoString: string } {
  const start = DateTime.fromISO(startUtcTimestamp, { zone: 'utc' });
  const end = start.plus({ minutes: durationMinutes });
  
  return {
    utcDate: end.toJSDate(),
    isoString: end.toISO() || end.toJSDate().toISOString(),
  };
}

/**
 * Calculate end time from local date/time inputs.
 * 
 * @param date - Date string in YYYY-MM-DD format
 * @param time - Time string in HH:mm format
 * @param durationMinutes - Duration in minutes
 * @returns Object with UTC end time
 */
export function localToUTCWithDuration(
  date: string, 
  time: string, 
  durationMinutes: number
): { startUtc: string; endUtc: string } {
  const start = localToUTC(date, time);
  const startDt = DateTime.fromJSDate(start.utcDate, { zone: 'utc' });
  const endDt = startDt.plus({ minutes: durationMinutes });
  
  return {
    startUtc: start.isoString,
    endUtc: endDt.toISO() || endDt.toJSDate().toISOString(),
  };
}

/**
 * Create a Date object for a specific hour in browser local time.
 * Used for calendar working hours (min/max time).
 * 
 * This creates a Date that, when getHours() is called, returns the expected hour.
 * 
 * @param hour - Hour in 24-hour format (0-23)
 * @returns Date object where getHours() === hour
 */
export function createLocalTimeDate(hour: number): Date {
  const timezone = getBrowserTimezone();
  
  // Create a DateTime for "today at the specified hour" in user's timezone
  const now = DateTime.now().setZone(timezone);
  const targetTime = now.set({ hour, minute: 0, second: 0, millisecond: 0 });
  
  // Return as JS Date - getHours() will return the correct local hour
  return targetTime.toJSDate();
}
