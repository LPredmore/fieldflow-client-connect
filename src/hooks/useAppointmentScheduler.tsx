import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from "./useAuth";
import { useUserTimezone } from "./useUserTimezone";
import { useToast } from "@/hooks/use-toast";
import {
  combineDateTimeToUTC,
  convertFromUTC,
} from "@/lib/timezoneUtils";

/**
 * Unified scheduler hook:
 * - Source of truth for the calendar is `appointment_occurrences` (one-off + recurring instances)
 * - Creates a `appointment_series` for every appointment (is_recurring controls RRULE)
 * - For one-off appointments: also inserts exactly one row in `appointment_occurrences`
 * - For recurring appointments: calls the `generate-appointment-occurrences` Edge Function to (re)materialize a horizon
 *
 * NOTE: Calendar components should use `useCalendarAppointments` for calendar display functionality.
 */

export type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type JobPriority = "low" | "medium" | "high" | "urgent";

// Export aliases for "Appointment" naming
export type AppointmentStatus = JobStatus;
export type AppointmentPriority = JobPriority;

export interface ScheduledJob {
  id: string; // occurrence id
  series_id: string;
  tenant_id: string;
  customer_id: string;
  customer_name: string;
  assigned_to_user_id?: string | null;
  title: string;
  description?: string | null;
  start_at: string; // UTC ISO
  end_at: string;   // UTC ISO
  status: JobStatus;
  priority: JobPriority;
  actual_cost?: number | null;
  completion_notes?: string | null;
  appointment_type: "one_time" | "recurring_instance";
  created_at?: string;
  updated_at?: string;
  // convenience for non-calendar displays:
  local_start?: string;
  local_end?: string;
  service_id?: string | null;
  service_name?: string | null;
  service_category?: string | null;
}

// Export aliases for "Appointment" naming
export type ScheduledAppointment = ScheduledJob;

export interface CreateJobInput {
  // shared
  title: string;
  customer_id: string;
  customer_name: string;
  description?: string;
  priority?: JobPriority;
  duration_minutes?: number;
  assigned_to_user_id?: string | null;
  service_type?: string;

  // times supplied from UI (local)
  // we accept either (date,time) or (scheduled_date,start_time)
  date?: string;           // "YYYY-MM-DD"
  time?: string;           // "HH:mm"
  scheduled_date?: string; // alias of date
  start_time?: string;     // alias of time

  // non-recurring
  is_recurring?: boolean;
  // recurring
  rrule?: string | null;
  until_date?: string | null; // optional end date in UI schema
  
  // service selection (use service_id instead of service_type)
  service_id?: string | null;
}

// Export aliases for "Appointment" naming
export type CreateAppointmentInput = CreateJobInput;

export function useJobScheduler() {
  const { user, tenantId } = useAuth();
  const userTimezone = useUserTimezone();
  const { toast } = useToast();

  // Calculate date range for default rolling window (past 7 days to next 90 days)
  const dateRange = useMemo(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    const to = new Date(now);
    to.setDate(to.getDate() + 90);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }, []);

  // Query appointment occurrences using generic hook
  const {
    data: rawJobs,
    loading,
    error: queryError,
    refetch: refreshJobs,
  } = useSupabaseQuery<any>({
    table: 'appointment_occurrences',
    select: `
      id,
      series_id,
      tenant_id,
      customer_id,
      assigned_to_user_id,
      start_at,
      end_at,
      status,
      priority,
      actual_cost,
      notes,
      created_at,
      updated_at,
      customers!inner(name),
      appointment_series!inner(
        is_recurring,
        title,
        description,
        service_id,
        services(id, name, category)
      )
    `,
    filters: {
      tenant_id: 'auto',
    },
    orderBy: { column: 'start_at', ascending: true },
    // Custom filtering for date range (can't use generic filters for this)
    enabled: !!user && !!tenantId,
    onError: (error) => {
      console.error("fetchJobs error", error);
      toast({
        title: "Error loading appointments",
        description: error.message ?? String(error),
        variant: "destructive",
      });
    },
  });

  // Override the query to add date range filtering
  const fetchJobsWithRange = useCallback(async () => {
    if (!user || !tenantId) return [];

    try {
      const { data, error: qErr } = await supabase
        .from("appointment_occurrences")
        .select(
          `
          id,
          series_id,
          tenant_id,
          customer_id,
          assigned_to_user_id,
          start_at,
          end_at,
          status,
          priority,
          actual_cost,
          notes,
          created_at,
          updated_at,
          customers!inner(pat_name_f, pat_name_l, pat_name_m, preferred_name),
          appointment_series!inner(
            is_recurring,
            title,
            description,
            service_id,
            services(id, name, category)
          )
        `
        )
        .eq("tenant_id", tenantId)
        .gte("start_at", dateRange.from)
        .lt("start_at", dateRange.to)
        .order("start_at", { ascending: true });

      if (qErr) throw qErr;

      return (data ?? []);
    } catch (e: any) {
      console.error("fetchJobs error", e);
      toast({
        title: "Error loading appointments",
        description: e.message ?? "Failed to load appointments",
        variant: "destructive",
      });
      return [];
    }
  }, [user, tenantId, dateRange.from, dateRange.to, toast]);

  // Use custom fetch instead of generic query for date range filtering
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [customLoading, setCustomLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadJobs = async () => {
      setCustomLoading(true);
      setError(null);
      const data = await fetchJobsWithRange();
      const mappedJobs = (data || []).map(mapRowToJob);
      setJobs(mappedJobs);
      setCustomLoading(false);
    };
    
    loadJobs();
  }, [fetchJobsWithRange]);

  const refreshJobsCustom = useCallback(async () => {
    const data = await fetchJobsWithRange();
    const mappedJobs = (data || []).map(mapRowToJob);
    setJobs(mappedJobs);
  }, [fetchJobsWithRange]);

  /**
   * Internal helper to map DB rows (occurrence + series) -> ScheduledJob
   */
    const mapRowToJob = useCallback(
    (row: any): ScheduledJob => {
      const title = row.appointment_series?.title ?? "Untitled Appointment";
      const description = row.appointment_series?.description ?? null;
      const appointment_type = row.appointment_series?.is_recurring ? "recurring_instance" : "one_time";

      const local_start = convertFromUTC(row.start_at, userTimezone);
      const local_end = convertFromUTC(row.end_at, userTimezone);
      const service = row.appointment_series?.services;

      return {
        id: row.id,
        series_id: row.series_id,
        tenant_id: row.tenant_id,
        customer_id: row.customer_id,
        customer_name: [
          row.customers?.pat_name_f,
          row.customers?.pat_name_m,
          row.customers?.pat_name_l
        ].filter(Boolean).join(' ').trim() || row.customers?.preferred_name || 'Unknown Customer',
        assigned_to_user_id: row.assigned_to_user_id,
        title,
        description,
        start_at: row.start_at,
        end_at: row.end_at,
        status: row.status as JobStatus,
        priority: (row.priority ?? "medium") as JobPriority,
        actual_cost: row.actual_cost ?? null,
        completion_notes: row.notes ?? null,
        appointment_type,
        created_at: row.created_at,
        updated_at: row.updated_at,
        local_start: local_start.toISOString(),
        local_end: local_end.toISOString(),
        service_id: row.appointment_series?.service_id ?? null,
        service_name: service?.name ?? null,
        service_category: service?.category ?? null,
      };
    },
    [userTimezone]
  );



  /**
   * Create a job (one-off or recurring).
   * Always creates a series row; then creates either one occurrence (one-off)
   * or invokes the generator to materialize a horizon (recurring).
   */
  const createJob = useCallback(
    async (jobData: CreateJobInput) => {
      if (!user || !tenantId) {
        toast({
          title: "Not signed in",
          description: "Please sign in to create appointments.",
          variant: "destructive",
        });
        return { ok: false, error: "Not authenticated" as const };
      }

      // Normalize time inputs
      const uiDate = jobData.scheduled_date ?? jobData.date;
      const uiTime = jobData.start_time ?? jobData.time;

      if (!uiDate || !uiTime) {
        return {
          ok: false as const,
          error: "Missing date/time for appointment creation",
        };
      }

      const duration = jobData.duration_minutes ?? 60;
      let utcStart: Date;
      try {
        utcStart = combineDateTimeToUTC(uiDate, uiTime, userTimezone);
      } catch (e: any) {
        toast({
          title: "Invalid date/time",
          description: e.message ?? "Please check the values",
          variant: "destructive",
        });
        return { ok: false as const, error: "Invalid date/time" as const };
      }
      const utcEnd = new Date(utcStart.getTime() + duration * 60 * 1000);

      const isRecurring = !!jobData.is_recurring && !!jobData.rrule;

      // Prepare series payload
      const seriesPayload: Record<string, any> = {
        tenant_id: tenantId,
        created_by_user_id: user.id,
        customer_id: jobData.customer_id,
        title: jobData.title,
        description: jobData.description ?? null,
        priority: jobData.priority ?? "medium",
        duration_minutes: duration,
        // local / tz / rrule fields (support existing schema)
        start_date: uiDate,
        local_start_time: uiTime.length === 5 ? `${uiTime}:00` : uiTime, // HH:mm -> HH:mm:ss
        timezone: userTimezone,
        is_recurring: isRecurring,
        rrule: isRecurring ? jobData.rrule : null,
        until_date: jobData.until_date ?? null,
        service_id: jobData.service_id ?? null,
        // precomputed UTC for convenience/perf
        scheduled_time_utc: utcStart.toISOString(),
        scheduled_end_time_utc: utcEnd.toISOString(),
        status: "scheduled",
        active: true,
      };

      // Insert series
      const { data: series, error: sErr } = await supabase
        .from("appointment_series")
        .insert(seriesPayload as any)
        .select()
        .single();

      if (sErr) {
        console.error("create series error", sErr);
        toast({
          title: "Failed to create appointment",
          description: sErr.message ?? String(sErr),
          variant: "destructive",
        });
        return { ok: false as const, error: sErr.message ?? "Insert failed" };
      }

      if (isRecurring) {
        // Recurring: invoke generator to materialize occurrences
        const { data: fnRes, error: fnErr } = await supabase.functions.invoke(
          "generate-appointment-occurrences",
          {
            body: {
              seriesId: series.id,
              monthsAhead: 3,
              maxOccurrences: 200,
            },
          }
        );

        if (fnErr) {
          console.error("generator error", fnErr, fnRes);
          toast({
            title: "Appointment created, but failed to generate occurrences",
            description: fnErr.message ?? String(fnErr),
            variant: "destructive",
          });
          // still return ok because the series exists; a follow-up horizon task can repair
          await refreshJobsCustom();
          return { ok: true as const, seriesId: series.id };
        }

        toast({
          title: "Recurring appointment created",
          description: `Generated ${fnRes?.generated?.created ?? 0} occurrences`,
        });
        await refreshJobsCustom();
        return { ok: true as const, seriesId: series.id };
      } else {
        // One-off: insert exactly one occurrence
        const occurrencePayload: Record<string, any> = {
          tenant_id: tenantId,
          series_id: series.id,
          customer_id: jobData.customer_id,
          start_at: utcStart.toISOString(),
          end_at: utcEnd.toISOString(),
          status: "scheduled",
          priority: jobData.priority ?? "medium",
          assigned_to_user_id: jobData.assigned_to_user_id ?? null,
          series_timezone: userTimezone,
          series_local_start_time:
            uiTime.length === 5 ? `${uiTime}:00` : uiTime,
        };

        const { error: oErr } = await supabase
          .from("appointment_occurrences")
          .insert(occurrencePayload as any);

        if (oErr) {
          console.error("insert occurrence error", oErr);
          toast({
            title: "Failed to create appointment occurrence",
            description: oErr.message ?? String(oErr),
            variant: "destructive",
          });
          return { ok: false as const, error: oErr.message ?? "Insert failed" };
        }

        toast({ title: "Appointment created" });
        await refreshJobsCustom();
        return { ok: true as const, seriesId: series.id };
      }
    },
    [user, tenantId, userTimezone, toast, refreshJobsCustom]
  );

  /**
   * Update a single occurrence row (calendar-level edit).
   * To update the SERIES template, use the dedicated series hook/screen.
   */
  const updateJob = useCallback(
    async (occurrenceId: string, updates: Partial<ScheduledJob> & Record<string, any>) => {
      if (!user || !tenantId) return { ok: false as const, error: "Not authenticated" };

      const payload: Record<string, any> = { ...updates };

      // Map completion_notes to notes for database
      if ('completion_notes' in updates) {
        payload.notes = updates.completion_notes;
        delete payload.completion_notes;
      }

      // If UI passes local date/time updates, convert to UTC
      if (updates?.local_start && updates?.local_end) {
        // assume ISO-like strings in user's tz, but for safety the UI should pass (date,time)
        // here we prefer start_at/end_at updates directly; keeping for compatibility
        // No-op: convertFromUTC is the reverse. We'll rely on start_at/end_at when provided.
      }

      if (updates?.start_at && updates?.end_at) {
        // Ensure ISO strings
        payload.start_at = new Date(updates.start_at).toISOString();
        payload.end_at = new Date(updates.end_at).toISOString();
      }

      const { error: uErr } = await supabase
        .from("appointment_occurrences")
        .update(payload)
        .eq("id", occurrenceId)
        .eq("tenant_id", tenantId);

      if (uErr) {
        console.error("update occurrence error", uErr);
        toast({
          title: "Failed to update appointment",
          description: uErr.message ?? String(uErr),
          variant: "destructive",
        });
        return { ok: false as const, error: uErr.message ?? "Update failed" };
      }

      toast({ title: "Appointment updated" });
      await refreshJobsCustom();
      return { ok: true as const };
    },
    [user, tenantId, toast, refreshJobsCustom]
  );

  /**
   * Delete a single occurrence row (calendar-level delete).
   * Series-level deletion should be done via series screens.
   */
  const deleteJob = useCallback(
    async (occurrenceId: string) => {
      if (!user || !tenantId) return { ok: false as const, error: "Not authenticated" };

      const { error: dErr } = await supabase
        .from("appointment_occurrences")
        .delete()
        .eq("id", occurrenceId)
        .eq("tenant_id", tenantId);

      if (dErr) {
        console.error("delete occurrence error", dErr);
        toast({
          title: "Failed to delete appointment",
          description: dErr.message ?? String(dErr),
          variant: "destructive",
        });
        return { ok: false as const, error: dErr.message ?? "Delete failed" };
      }

      toast({ title: "Appointment deleted" });
      await refreshJobsCustom();
      return { ok: true as const };
    },
    [user, tenantId, toast, refreshJobsCustom]
  );

  /**
   * Convenience mapper for calendar components.
   * Returns events with UTC start/end; rendering layer can convert if desired.
   */
  const getCalendarEvents = useCallback(() => {
    return jobs.map((j) => ({
      id: j.id,
      title: j.title,
      start: j.start_at, // UTC ISO
      end: j.end_at,     // UTC ISO
      extendedProps: {
        status: j.status,
        priority: j.priority,
        customer_name: j.customer_name,
        series_id: j.series_id,
        appointment_type: j.appointment_type,
      },
    }));
  }, [jobs]);

  return {
    jobs,
    loading: customLoading,
    error,
    createJob,
    updateJob,
    deleteJob,
    refreshJobs: refreshJobsCustom,
    getCalendarEvents,
    // convenience derived data
    upcomingJobs: jobs
      .filter((job) => new Date(job.start_at) > new Date() && job.status === "scheduled")
      .slice(0, 5),
    todaysJobs: jobs.filter((job) => {
      const today = new Date();
      const jobDate = new Date(job.start_at);
      return jobDate.toDateString() === today.toDateString();
    }),
  };
}

// Export alias for "Appointment" naming
export const useAppointmentScheduler = useJobScheduler;
