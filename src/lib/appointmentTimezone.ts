/**
 * Appointment Timezone Utilities
 * 
 * Implements a clean, invariant UTC-based time model:
 * 
 * 1. Database stores UTC timestamps only (start_at, end_at as timestamptz)
 * 2. Browser converts local → UTC before saving
 * 3. Browser converts UTC → local when reading
 * 4. Timezone metadata (time_zone column) records creator's timezone but isn't used for rendering
 * 
 * This guarantees the same real-world moment is rendered at the correct
 * local clock time regardless of which timezone the viewer is in.
 */

import { DateTime } from 'luxon';

/**
 * Get the current browser's timezone (IANA format)
 * Example: "America/Chicago", "America/New_York"
 * 
 * @deprecated Use useStaffTimezone hook instead for staff views.
 * This function only returns browser timezone and does not account for
 * staff profile prov_time_zone preference.
 */
export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Convert a local date/time selection to UTC for database storage.
 * 
 * Use this when CREATING an appointment:
 * - User selects date "2025-12-05" and time "10:00"
 * - This converts that local time to the UTC instant
 * - Save the result to Supabase
 * 
 * @param date - Date string in YYYY-MM-DD format
 * @param time - Time string in HH:mm format
 * @param timezone - Optional timezone override (defaults to browser timezone)
 * @returns ISO string in UTC for database storage
 */
export function localToUTC(
  date: string,
  time: string,
  timezone?: string
): string {
  const zone = timezone || getBrowserTimezone();
  
  // Parse date and time components
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  
  // Create DateTime in the specified timezone
  const local = DateTime.fromObject(
    { year, month, day, hour, minute, second: 0, millisecond: 0 },
    { zone }
  );
  
  if (!local.isValid) {
    throw new Error(`Invalid date/time: ${date} ${time} in ${zone}`);
  }
  
  // Convert to UTC and return ISO string
  const utc = local.toUTC();
  return utc.toISO()!;
}

/**
 * Convert a local date/time to a UTC Date object.
 * Same as localToUTC but returns a JS Date instead of string.
 * 
 * @param date - Date string in YYYY-MM-DD format
 * @param time - Time string in HH:mm format
 * @param timezone - Optional timezone override (defaults to browser timezone)
 * @returns Date object representing the UTC instant
 */
export function localToUTCDate(
  date: string,
  time: string,
  timezone?: string
): Date {
  const zone = timezone || getBrowserTimezone();
  
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  
  const local = DateTime.fromObject(
    { year, month, day, hour, minute, second: 0, millisecond: 0 },
    { zone }
  );
  
  if (!local.isValid) {
    throw new Error(`Invalid date/time: ${date} ${time} in ${zone}`);
  }
  
  return local.toUTC().toJSDate();
}

/**
 * Convert a UTC timestamp from the database to a local JS Date for display.
 * 
 * Use this when READING appointments:
 * - Supabase returns UTC timestamp "2025-12-05T15:00:00Z"
 * - This converts it to the user's local time as a Date object
 * - Pass this Date to React Big Calendar
 * 
 * @param utcTimestamp - ISO string from database (UTC)
 * @param timezone - Optional timezone override (defaults to browser timezone)
 * @returns Date object for calendar display (in local timezone)
 */
export function utcToLocal(
  utcTimestamp: string,
  timezone?: string
): Date {
  const zone = timezone || getBrowserTimezone();
  
  // Parse as UTC
  const utc = DateTime.fromISO(utcTimestamp, { zone: 'utc' });
  
  if (!utc.isValid) {
    console.error('Invalid UTC timestamp:', utcTimestamp);
    return new Date(); // Fallback to now
  }
  
  // Convert to the target timezone and return as JS Date
  const local = utc.setZone(zone);
  return local.toJSDate();
}

/**
 * Convert a UTC timestamp to local date/time strings for form inputs.
 * 
 * Use this when populating edit forms with existing appointment data:
 * - Load appointment with start_at "2025-12-05T15:00:00Z"
 * - Convert to local strings for date and time inputs
 * 
 * @param utcTimestamp - ISO string from database (UTC)
 * @param timezone - Optional timezone override (defaults to browser timezone)
 * @returns Object with date (YYYY-MM-DD) and time (HH:mm) strings
 */
export function utcToLocalStrings(
  utcTimestamp: string,
  timezone?: string
): { date: string; time: string } {
  const zone = timezone || getBrowserTimezone();
  
  const utc = DateTime.fromISO(utcTimestamp, { zone: 'utc' });
  
  if (!utc.isValid) {
    console.error('Invalid UTC timestamp:', utcTimestamp);
    const now = DateTime.now();
    return {
      date: now.toFormat('yyyy-MM-dd'),
      time: now.toFormat('HH:mm')
    };
  }
  
  const local = utc.setZone(zone);
  return {
    date: local.toFormat('yyyy-MM-dd'),
    time: local.toFormat('HH:mm')
  };
}

/**
 * Format a UTC timestamp for display in the user's local timezone.
 * 
 * @param utcTimestamp - ISO string from database (UTC)
 * @param formatStr - Luxon format string (default: 'h:mm a')
 * @param timezone - Optional timezone override (defaults to browser timezone)
 * @returns Formatted string in local timezone
 */
export function formatUTCAsLocal(
  utcTimestamp: string,
  formatStr: string = 'h:mm a',
  timezone?: string
): string {
  const zone = timezone || getBrowserTimezone();
  
  const utc = DateTime.fromISO(utcTimestamp, { zone: 'utc' });
  
  if (!utc.isValid) {
    return 'Invalid time';
  }
  
  const local = utc.setZone(zone);
  return local.toFormat(formatStr);
}

/**
 * Calculate end time given start UTC and duration.
 * 
 * @param startUTC - Start time as ISO string (UTC)
 * @param durationMinutes - Duration in minutes
 * @returns End time as ISO string (UTC)
 */
export function calculateEndUTC(startUTC: string, durationMinutes: number): string {
  const start = DateTime.fromISO(startUTC, { zone: 'utc' });
  
  if (!start.isValid) {
    throw new Error(`Invalid start time: ${startUTC}`);
  }
  
  const end = start.plus({ minutes: durationMinutes });
  return end.toISO()!;
}

/**
 * Calculate end Date given start Date and duration.
 * Works with JS Date objects directly.
 * 
 * @param startDate - Start time as Date
 * @param durationMinutes - Duration in minutes
 * @returns End time as Date
 */
export function calculateEndDate(startDate: Date, durationMinutes: number): Date {
  return new Date(startDate.getTime() + durationMinutes * 60 * 1000);
}

/**
 * Get the database-compatible timezone enum value.
 * Maps browser timezone to the time_zones enum in the database.
 * 
 * @param browserTimezone - Browser timezone (IANA format)
 * @returns Database enum value
 */
export function getDBTimezoneEnum(browserTimezone?: string): string {
  const tz = browserTimezone || getBrowserTimezone();
  
  // Map common US timezones to DB enum values
  const mapping: Record<string, string> = {
    'America/New_York': 'America/New_York',
    'America/Chicago': 'America/Chicago',
    'America/Denver': 'America/Denver',
    'America/Los_Angeles': 'America/Los_Angeles',
    'America/Phoenix': 'America/Phoenix',
    'America/Anchorage': 'America/Anchorage',
    'Pacific/Honolulu': 'Pacific/Honolulu',
  };
  
  return mapping[tz] || 'America/New_York';
}
