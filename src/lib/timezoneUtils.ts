import { format, parseISO } from 'date-fns';

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
 * Extract date string from a "fake local" Date object (created by createFakeLocalDate).
 * These Dates have their local components set to match a specific timezone,
 * so we use getFullYear/getMonth/getDate to extract them.
 * 
 * @param fakeLocalDate - Date object from createFakeLocalDate()
 * @returns Date string in YYYY-MM-DD format
 */
export function getDateFromFakeLocalDate(fakeLocalDate: Date): string {
  const year = fakeLocalDate.getFullYear();
  const month = String(fakeLocalDate.getMonth() + 1).padStart(2, '0');
  const day = String(fakeLocalDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate end time given start time and duration in minutes
 */
export function calculateEndTime(startAt: Date | string, durationMinutes: number): Date {
  const start = typeof startAt === 'string' ? new Date(startAt) : startAt;
  return new Date(start.getTime() + durationMinutes * 60 * 1000);
}

/**
 * Convert datetime to ISO string for calendar compatibility
 * Ensures proper format with timezone information
 */
export function toCalendarFormat(dateTime: Date | string): string {
  const date = typeof dateTime === 'string' ? parseISO(dateTime) : dateTime;
  return date.toISOString();
}
