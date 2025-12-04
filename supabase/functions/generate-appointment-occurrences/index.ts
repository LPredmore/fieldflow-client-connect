import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { RRule } from 'https://esm.sh/rrule@2.8.1';
import { DateTime } from 'https://esm.sh/luxon@3.4.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateOccurrencesRequest {
  seriesId: string;
  monthsAhead?: number;
  fromDate?: string;
  maxOccurrences?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting appointment occurrence generation');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      seriesId, 
      monthsAhead = 3, 
      fromDate,
      maxOccurrences = 200 
    }: GenerateOccurrencesRequest = await req.json();
    
    console.log('Generating occurrences for series:', seriesId);

    // Fetch the appointment series with correct column names
    const { data: series, error: seriesError } = await supabase
      .from('appointment_series')
      .select('*')
      .eq('id', seriesId)
      .single();

    if (seriesError || !series) {
      console.error('Series not found:', seriesError);
      return new Response(
        JSON.stringify({ error: 'Appointment series not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!series.is_active) {
      console.log('Series is inactive, skipping generation');
      return new Response(
        JSON.stringify({ message: 'Series is inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the rrule from the series
    const recurrenceRule = series.rrule;
    if (!recurrenceRule) {
      console.error('No recurrence rule found:', series);
      return new Response(
        JSON.stringify({ error: 'No recurrence rule found for this series' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Series details:', {
      id: series.id,
      rrule: recurrenceRule,
      start_at: series.start_at,
      time_zone: series.time_zone,
      duration_minutes: series.duration_minutes
    });

    // Parse start_at (stored in UTC) and convert to local for RRule
    const startDateTime = new Date(series.start_at);
    
    console.log('StartDateTime for RRule:', startDateTime.toISOString());
    
    // Parse the RRULE
    let rule: RRule;
    try {
      const rruleOptions = RRule.parseString(recurrenceRule);
      rruleOptions.dtstart = startDateTime;
      rule = new RRule(rruleOptions);
    } catch (rruleError) {
      console.error('Invalid RRULE:', rruleError);
      return new Response(
        JSON.stringify({ error: 'Invalid recurrence rule' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate generation window
    const windowStart = fromDate ? new Date(fromDate) : new Date();
    windowStart.setHours(0, 0, 0, 0);
    
    const windowEnd = new Date(windowStart);
    windowEnd.setMonth(windowEnd.getMonth() + monthsAhead);
    windowEnd.setHours(23, 59, 59, 999);
    
    // Hard ceiling: never generate beyond 365 days
    const hardCeiling = new Date();
    hardCeiling.setFullYear(hardCeiling.getFullYear() + 1);
    if (windowEnd > hardCeiling) {
      windowEnd.setTime(hardCeiling.getTime());
    }

    // Apply series_end_date limit if specified
    let effectiveEnd = windowEnd;
    if (series.series_end_date) {
      const endDate = new Date(series.series_end_date);
      endDate.setHours(23, 59, 59, 999);
      effectiveEnd = endDate < windowEnd ? endDate : windowEnd;
    }

    console.log('Generation window:', {
      start: windowStart.toISOString(),
      end: effectiveEnd.toISOString()
    });

    // Generate occurrences
    let occurrences = rule.between(windowStart, effectiveEnd, true);
    
    // Apply max occurrences cap
    if (series.max_occurrences && occurrences.length > series.max_occurrences) {
      occurrences = occurrences.slice(0, series.max_occurrences);
    }
    if (occurrences.length > maxOccurrences) {
      occurrences = occurrences.slice(0, maxOccurrences);
    }
    
    console.log(`Generated ${occurrences.length} occurrences`);

    const generatedCount = { created: 0, skipped: 0 };

    // Insert each occurrence into the appointments table
    for (const occurrence of occurrences) {
      const startUTC = DateTime.fromJSDate(occurrence, { zone: 'utc' });
      const endUTC = startUTC.plus({ minutes: series.duration_minutes });

      // Build appointment data matching the appointments table schema
      const appointmentData = {
        tenant_id: series.tenant_id,
        series_id: series.id,
        client_id: series.client_id,
        staff_id: series.staff_id,
        service_id: series.service_id,
        start_at: startUTC.toISO(),
        end_at: endUTC.toISO(),
        time_zone: series.time_zone,
        status: 'scheduled',
        is_telehealth: false,
        created_by_profile_id: series.created_by_profile_id,
      };

      // Use upsert to avoid duplicates (based on series_id + start_at)
      const { error: insertError } = await supabase
        .from('appointments')
        .upsert(appointmentData, { 
          onConflict: 'series_id,start_at',
          ignoreDuplicates: true
        });

      if (insertError) {
        console.error('Error inserting appointment:', insertError);
        generatedCount.skipped++;
      } else {
        generatedCount.created++;
      }
    }

    console.log('Generation completed:', generatedCount);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Generated ${generatedCount.created} appointments, skipped ${generatedCount.skipped}`,
        generated: generatedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-appointment-occurrences:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
