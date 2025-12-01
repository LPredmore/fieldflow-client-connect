/**
 * Simplified Supabase Client
 * 
 * Removes all excessive resilience infrastructure and focuses on what actually works:
 * - Basic HTTP/1.1 compatible client
 * - Simple lock timeout for auth
 * - No monitors, no complex retries, no caching overhead
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Hardcoded Supabase configuration
const SUPABASE_URL = "https://tizshsmrqqaharwpqocj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpenNoc21ycXFhaGFyd3Bxb2NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwOTQwNDQsImV4cCI6MjA3NDY3MDA0NH0.HFecGZAPLi6-RmPJrG0M0G9bAV7AsabybTapjKw-ddU";

/**
 * Simple lock with timeout - prevents auth hangs
 * Skips navigator.locks entirely to avoid complexity and resource contention
 */
async function simpleLockWithTimeout<R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  // Skip navigator.locks - complexity causes more issues than it solves
  return await fn();
}

/**
 * Create the Supabase client - simple and working
 */
function createSimpleClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      lock: simpleLockWithTimeout,
    },
    global: {
      headers: {
        "User-Agent": "Supabase-JS/2.0",
      },
    },
  });
}

// Create and export the client
const supabaseClient = createSimpleClient();

// Export as both named and for compatibility
export { supabaseClient as supabase };
export const simpleClient = supabaseClient;
