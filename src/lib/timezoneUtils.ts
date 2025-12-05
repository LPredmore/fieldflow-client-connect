import { format, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * Default timezone fallback
 */
export const DEFAULT_TIMEZONE = 'America/New_York';

/**
 * Normalize Supabase timestamp format to ISO 8601
 * Supabase returns: "2025-12-05 14:00:00+00" (space separator, short offset)
 * ISO 8601 expects: "2025-12-05T14:00:00Z" (T separator, Z or full offset)
 * 
 * This ensures consistent parsing across all browsers.
 */
export function normalizeTimestamp(timestamp: string): string {
  if (!timestamp) return timestamp;
  
  // Replace space with T for ISO 8601 compliance
  let normalized = timestamp.replace(' ', 'T');
  
  // Normalize timezone offset
  // "+00" or "-00" → "Z"
  if (/[+-]00$/.test(normalized)) {
    normalized = normalized.slice(0, -3) + 'Z';
  }
  // "+00:00" or "-00:00" → "Z"
  else if (/[+-]00:00$/.test(normalized)) {
    normalized = normalized.slice(0, -6) + 'Z';
  }
  // "+05" → "+05:00" (short offset to full offset)
  else if (/[+-]\d{2}$/.test(normalized)) {
    normalized = normalized + ':00';
  }
  
  return normalized;
}

/**
 * Convert a date/time from user's timezone to UTC for storage
 */
export function convertToUTC(dateTime: Date | string, userTimezone: string): Date {
  const date = typeof dateTime === 'string' ? parseISO(dateTime) : dateTime;
  return fromZonedTime(date, userTimezone);
}

/**
 * Convert a UTC date/time to user's timezone for display
 */
export function convertFromUTC(utcDateTime: Date | string, userTimezone: string): Date {
  if (typeof utcDateTime === 'string') {
    const normalized = normalizeTimestamp(utcDateTime);
    const date = parseISO(normalized);
    return toZonedTime(date, userTimezone);
  }
  return toZonedTime(utcDateTime, userTimezone);
}

/**
 * Format a UTC date/time in user's timezone
 */
export function formatInUserTimezone(
  utcDateTime: Date | string, 
  userTimezone: string, 
  formatStr: string = 'yyyy-MM-dd HH:mm:ss'
): string {
  if (typeof utcDateTime === 'string') {
    const normalized = normalizeTimestamp(utcDateTime);
    const date = parseISO(normalized);
    return formatInTimeZone(date, userTimezone, formatStr);
  }
  return formatInTimeZone(utcDateTime, userTimezone, formatStr);
}

/**
 * Combine a date and time string in user's timezone, then convert to UTC
 * Used for form inputs where user enters date/time in their local timezone
 * 
 * IMPORTANT: This function correctly interprets the date/time as being IN the user's timezone
 * and converts it to UTC for database storage.
 */
export function combineDateTimeToUTC(
  date: string, // YYYY-MM-DD format
  time: string, // HH:mm format
  userTimezone: string
): Date {
  // Validate inputs
  if (!date || !time) {
    throw new Error('Date and time are required');
  }
  
  // Parse date components explicitly (no string parsing ambiguity)
  const dateParts = date.split('-');
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10);
  const day = parseInt(dateParts[2], 10);
  
  // Validate parsed date
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
  }
  
  // Parse time components explicitly
  const timeParts = time.split(':');
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  const seconds = timeParts[2] ? parseInt(timeParts[2], 10) : 0;
  
  // Validate parsed time
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time format: ${time}. Expected HH:mm or HH:mm:ss`);
  }
  
  // Create a Date object with LOCAL components matching the user's input
  // CRITICAL: fromZonedTime reads getHours(), getMinutes(), etc. (local accessors)
  // NOT getUTCHours(). So we must create a Date where local components = user input.
  // Note: Date constructor uses 0-indexed months, so subtract 1 from month
  const localDate = new Date(year, month - 1, day, hours, minutes, seconds, 0);
  
  // fromZonedTime interprets localDate's LOCAL components as being in userTimezone
  // and returns the actual UTC instant
  // Example: 9:00 AM in "America/New_York" → 14:00 UTC (during EST)
  const utcDateTime = fromZonedTime(localDate, userTimezone);
  
  // Validate the result
  if (isNaN(utcDateTime.getTime())) {
    throw new Error(`Invalid date/time combination or timezone: ${date} ${time} in ${userTimezone}`);
  }
  
  return utcDateTime;
}

/**
 * Convert UTC datetime to user's local date and time strings
 * Returns object with separate date and time strings
 */
export function splitUTCToLocalDateTime(
  utcDateTime: Date | string,
  userTimezone: string
): { date: string; time: string } {
  const localDateTime = convertFromUTC(utcDateTime, userTimezone);
  
  return {
    date: format(localDateTime, 'yyyy-MM-dd'),
    time: format(localDateTime, 'HH:mm')
  };
}

/**
 * Get current date/time in user's timezone
 */
export function getCurrentInTimezone(userTimezone: string): Date {
  return toZonedTime(new Date(), userTimezone);
}

/**
 * Convert datetime to ISO string for calendar compatibility
 * Ensures proper format with timezone information
 */
export function toCalendarFormat(dateTime: Date | string): string {
  const date = typeof dateTime === 'string' ? parseISO(dateTime) : dateTime;
  return date.toISOString();
}

/**
 * Convert user local datetime to calendar format (via UTC)
 */
export function localToCalendar(
  dateTime: Date | string,
  userTimezone: string
): string {
  const utcDate = convertToUTC(dateTime, userTimezone);
  return toCalendarFormat(utcDate);
}

/**
 * Convert UTC datetime to user timezone and format for calendar
 */
export function utcToCalendarInTimezone(
  utcDateTime: Date | string,
  userTimezone: string
): string {
  const localDate = convertFromUTC(utcDateTime, userTimezone);
  return toCalendarFormat(localDate);
}

/**
 * Calculate end time given start time and duration in minutes
 */
export function calculateEndTime(startAt: Date | string, durationMinutes: number): Date {
  const start = typeof startAt === 'string' ? new Date(startAt) : startAt;
  return new Date(start.getTime() + durationMinutes * 60 * 1000);
}
