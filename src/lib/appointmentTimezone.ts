/**
 * Appointment Timezone Utilities
 * 
 * Server-authoritative timezone model:
 * - READS: PostgreSQL AT TIME ZONE provides pre-formatted display strings via RPCs
 * - WRITES: PostgreSQL convert_local_to_utc RPC converts user input to UTC
 * - Client-side: Zero timezone conversion. Only pure arithmetic helpers remain here.
 * 
 * All timezone conversion was moved server-side because the production environment's
 * Intl API lacks timezone data, causing Luxon and date-fns-tz to silently fail.
 */

import { DateTime } from 'luxon';

/**
 * Calculate end time given start UTC and duration.
 * Pure arithmetic — no timezone conversion.
 */
export function calculateEndUTC(startUTC: string, durationMinutes: number): string {
  const start = DateTime.fromISO(startUTC, { zone: 'utc' });
  if (!start.isValid) {
    throw new Error(`Invalid start time: ${startUTC}`);
  }
  return start.plus({ minutes: durationMinutes }).toISO()!;
}

/**
 * Calculate end Date given start Date and duration.
 * Pure arithmetic — no timezone conversion.
 */
export function calculateEndDate(startDate: Date, durationMinutes: number): Date {
  return new Date(startDate.getTime() + durationMinutes * 60 * 1000);
}

/**
 * Get the database-compatible timezone enum value.
 * Simple string mapping — no timezone conversion.
 */
export function getDBTimezoneEnum(browserTimezone?: string): string {
  const tz = browserTimezone || 'America/New_York';
  
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
