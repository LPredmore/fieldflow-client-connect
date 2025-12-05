import { format, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * Converts a UTC Date to a "display Date" for react-big-calendar.
 * The returned Date has UTC values that match the local time components.
 * This is necessary because react-big-calendar uses UTC values for grid positioning.
 * 
 * Example: 14:00 UTC in "America/New_York" (Eastern, UTC-5)
 * - Real local time: 9:00 AM
 * - Output Date: getUTCHours() = 9 (so calendar positions at 9 AM slot)
 */
export function toCalendarDisplayDate(utcDate: Date | string, userTimezone: string): Date {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  
  // Convert to user's timezone to get local time components
  const zonedDate = toZonedTime(date, userTimezone);
  
  // Extract the local time components
  const year = zonedDate.getFullYear();
  const month = zonedDate.getMonth();
  const day = zonedDate.getDate();
  const hours = zonedDate.getHours();
  const minutes = zonedDate.getMinutes();
  const seconds = zonedDate.getSeconds();
  
  // Create a new Date where UTC values match these local components
  // This "fakes" UTC so react-big-calendar positions correctly
  return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
}

/**
 * Creates a display Date for working hours (minTime/maxTime).
 * Takes an hour number (0-23) and returns a Date where getUTCHours() = that hour.
 */
export function createWorkingHoursDate(hour: number, minute: number = 0): Date {
  const today = new Date();
  return new Date(Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    hour,
    minute,
    0,
    0
  ));
}

/**
 * Default timezone fallback
 */
export const DEFAULT_TIMEZONE = 'America/New_York';

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
  const date = typeof utcDateTime === 'string' ? parseISO(utcDateTime) : utcDateTime;
  return toZonedTime(date, userTimezone);
}

/**
 * Format a UTC date/time in user's timezone
 */
export function formatInUserTimezone(
  utcDateTime: Date | string, 
  userTimezone: string, 
  formatStr: string = 'yyyy-MM-dd HH:mm:ss'
): string {
  const date = typeof utcDateTime === 'string' ? parseISO(utcDateTime) : utcDateTime;
  return formatInTimeZone(date, userTimezone, formatStr);
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
  
  // Create a Date object using Date.UTC() to represent the "wall clock" reading
  // This creates a Date where the UTC components match what we want to interpret
  // as the user's local time (avoids any browser timezone interpretation)
  // Note: Date.UTC uses 0-indexed months, so subtract 1 from month
  const wallClockAsUTC = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, 0));
  
  // fromZonedTime interprets this instant as if it occurred in the user's timezone
  // and returns the actual UTC instant
  // Example: 9:00 AM "wall clock" in "America/New_York" → 14:00 UTC
  const utcDateTime = fromZonedTime(wallClockAsUTC, userTimezone);
  
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
