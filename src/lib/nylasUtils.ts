/**
 * Nylas Compatibility Utilities
 * 
 * Nylas calendar API uses Unix timestamps (seconds since epoch) for datetime fields.
 * Our database stores datetimes as ISO 8601 strings in UTC.
 * These utilities provide seamless conversion between the two formats.
 */

/**
 * Convert an ISO 8601 datetime string to Nylas Unix timestamp (seconds)
 * 
 * @param isoString - ISO 8601 datetime string (e.g., "2025-12-04T14:00:00.000Z")
 * @returns Unix timestamp in seconds
 * 
 * @example
 * toNylasTimestamp("2025-12-04T14:00:00.000Z") // Returns: 1764949200
 */
export function toNylasTimestamp(isoString: string): number {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ISO datetime string: ${isoString}`);
  }
  return Math.floor(date.getTime() / 1000);
}

/**
 * Convert a Nylas Unix timestamp (seconds) to ISO 8601 datetime string
 * 
 * @param unixTimestamp - Unix timestamp in seconds
 * @returns ISO 8601 datetime string in UTC
 * 
 * @example
 * fromNylasTimestamp(1764949200) // Returns: "2025-12-04T14:00:00.000Z"
 */
export function fromNylasTimestamp(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid Unix timestamp: ${unixTimestamp}`);
  }
  return date.toISOString();
}

/**
 * Convert a Date object to Nylas Unix timestamp (seconds)
 * 
 * @param date - JavaScript Date object
 * @returns Unix timestamp in seconds
 */
export function dateToNylasTimestamp(date: Date): number {
  if (isNaN(date.getTime())) {
    throw new Error('Invalid Date object');
  }
  return Math.floor(date.getTime() / 1000);
}

/**
 * Convert a Nylas Unix timestamp (seconds) to Date object
 * 
 * @param unixTimestamp - Unix timestamp in seconds
 * @returns JavaScript Date object
 */
export function nylasTimestampToDate(unixTimestamp: number): Date {
  const date = new Date(unixTimestamp * 1000);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid Unix timestamp: ${unixTimestamp}`);
  }
  return date;
}

/**
 * Create a Nylas event time object from our appointment data
 * 
 * @param startAt - Start datetime (ISO string or Date)
 * @param endAt - End datetime (ISO string or Date)
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Object formatted for Nylas event API
 */
export function toNylasEventTime(
  startAt: string | Date,
  endAt: string | Date,
  timezone: string
): { start_time: number; end_time: number; start_timezone: string; end_timezone: string } {
  const startDate = typeof startAt === 'string' ? new Date(startAt) : startAt;
  const endDate = typeof endAt === 'string' ? new Date(endAt) : endAt;
  
  return {
    start_time: dateToNylasTimestamp(startDate),
    end_time: dateToNylasTimestamp(endDate),
    start_timezone: timezone,
    end_timezone: timezone,
  };
}

/**
 * Parse Nylas event time object to our appointment format
 * 
 * @param nylasEvent - Nylas event object with start_time and end_time
 * @returns Object with ISO datetime strings
 */
export function fromNylasEventTime(nylasEvent: {
  start_time: number;
  end_time: number;
  start_timezone?: string;
  end_timezone?: string;
}): { start_at: string; end_at: string; time_zone: string } {
  return {
    start_at: fromNylasTimestamp(nylasEvent.start_time),
    end_at: fromNylasTimestamp(nylasEvent.end_time),
    time_zone: nylasEvent.start_timezone || 'UTC',
  };
}
