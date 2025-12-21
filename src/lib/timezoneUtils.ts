import { format, parseISO } from 'date-fns';
import { fromZonedTime, formatInTimeZone, toZonedTime } from 'date-fns-tz';

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
 * Parse a UTC timestamp string to a native Date object.
 * Browser automatically handles local timezone display when using getHours(), etc.
 * This is the PRIMARY function for converting UTC strings for calendar display.
 */
export function parseUTCTimestamp(utcString: string): Date {
  const normalized = normalizeTimestamp(utcString);
  return new Date(normalized);
}

/**
 * Format a UTC timestamp in browser's local timezone for display.
 * Uses date-fns format which respects browser's local timezone.
 * 
 * @param utcDateTime - UTC date/time string or Date object
 * @param formatStr - date-fns format string (default: 'h:mm a')
 * @returns Formatted string in browser's local timezone
 */
export function formatLocalTime(
  utcDateTime: Date | string,
  formatStr: string = 'h:mm a'
): string {
  const date = typeof utcDateTime === 'string' 
    ? parseUTCTimestamp(utcDateTime) 
    : utcDateTime;
  
  return format(date, formatStr);
}

/**
 * Get local date and time strings from a UTC timestamp.
 * Used for populating form inputs with existing appointment times.
 * 
 * @param utcDateTime - UTC date/time string or Date object
 * @returns Object with date (YYYY-MM-DD) and time (HH:mm) strings
 */
export function getLocalDateTimeStrings(utcDateTime: Date | string): { date: string; time: string } {
  const date = typeof utcDateTime === 'string'
    ? parseUTCTimestamp(utcDateTime)
    : utcDateTime;
  
  return {
    date: format(date, 'yyyy-MM-dd'),
    time: format(date, 'HH:mm')
  };
}

/**
 * Convert a date/time from user's timezone to UTC for storage.
 * Used when creating appointments - interprets local input as being in userTimezone.
 * 
 * @deprecated Use combineDateTimeToUTC for form inputs instead
 */
export function convertToUTC(dateTime: Date | string, userTimezone: string): Date {
  const date = typeof dateTime === 'string' ? parseISO(dateTime) : dateTime;
  return fromZonedTime(date, userTimezone);
}

/**
 * Convert a UTC date/time to local Date for display.
 * Uses native browser parsing which correctly converts to local timezone.
 * 
 * @param utcDateTime - UTC date/time string or Date object
 * @param _userTimezone - DEPRECATED: parameter kept for backwards compatibility but ignored
 * @returns Date object representing the local time
 */
export function convertFromUTC(utcDateTime: Date | string, _userTimezone?: string): Date {
  if (typeof utcDateTime === 'string') {
    return parseUTCTimestamp(utcDateTime);
  }
  return utcDateTime;
}

/**
 * Format a UTC date/time in browser's local timezone.
 * This is an alias for formatLocalTime with backwards-compatible signature.
 * 
 * @param utcDateTime - UTC date/time string or Date object
 * @param _userTimezone - DEPRECATED: parameter kept for backwards compatibility but ignored
 * @param formatStr - date-fns format string
 * @returns Formatted string in browser's local timezone
 */
export function formatInUserTimezone(
  utcDateTime: Date | string, 
  _userTimezone: string, 
  formatStr: string = 'yyyy-MM-dd HH:mm:ss'
): string {
  return formatLocalTime(utcDateTime, formatStr);
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
 * Convert UTC datetime to user's local date and time strings.
 * Returns object with separate date and time strings for form inputs.
 * 
 * IMPORTANT: This function NOW correctly uses the userTimezone parameter!
 * It converts UTC to the specified timezone, not the browser's timezone.
 * 
 * @param utcDateTime - UTC date/time string or Date object
 * @param userTimezone - Target timezone (IANA format). If not provided, uses browser timezone.
 * @returns Object with date (YYYY-MM-DD) and time (HH:mm) strings
 */
export function splitUTCToLocalDateTime(
  utcDateTime: Date | string,
  userTimezone?: string
): { date: string; time: string } {
  const date = typeof utcDateTime === 'string'
    ? parseUTCTimestamp(utcDateTime)
    : utcDateTime;
  
  // If no timezone specified, fall back to browser timezone (original behavior)
  if (!userTimezone) {
    return getLocalDateTimeStrings(utcDateTime);
  }
  
  // Use date-fns-tz to format in the specified timezone
  return {
    date: formatInTimeZone(date, userTimezone, 'yyyy-MM-dd'),
    time: formatInTimeZone(date, userTimezone, 'HH:mm')
  };
}

/**
 * Get current date/time as a native Date.
 * Browser's local timezone is automatically used when accessing hours/minutes.
 * 
 * @param _userTimezone - DEPRECATED: parameter kept for backwards compatibility but ignored
 */
export function getCurrentInTimezone(_userTimezone?: string): Date {
  return new Date();
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

/**
 * Get "today" as a date string in a specific timezone.
 * Returns format like "Sat Dec 21 2024" matching Date.toDateString() output.
 * 
 * @param timezone - IANA timezone string (e.g., 'America/Chicago')
 * @returns Date string in the format used by Date.toDateString()
 */
export function getTodayInTimezone(timezone: string): string {
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  return zonedNow.toDateString();
}

/**
 * Get a Date object representing "now" adjusted to a specific timezone.
 * Useful for comparisons like "is this appointment before/after now?"
 * 
 * @param timezone - IANA timezone string
 * @returns Date object representing "now" in the specified timezone
 */
export function getNowInTimezone(timezone: string): Date {
  const now = new Date();
  return toZonedTime(now, timezone);
}
