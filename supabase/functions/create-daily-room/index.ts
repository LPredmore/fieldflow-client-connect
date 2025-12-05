import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateDailyRoomRequest {
  appointmentId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Creating Daily.co room for appointment');

    const dailyApiKey = Deno.env.get('DAILY.CO_API_KEY');
    if (!dailyApiKey) {
      console.error('DAILY.CO_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Daily.co API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { appointmentId }: CreateDailyRoomRequest = await req.json();

    if (!appointmentId) {
      return new Response(
        JSON.stringify({ error: 'appointmentId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching appointment:', appointmentId);

    // Fetch the appointment to verify it exists and is telehealth
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('id, is_telehealth, videoroom_url')
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error('Appointment not found:', appointmentError);
      return new Response(
        JSON.stringify({ error: 'Appointment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip if already has a video room URL
    if (appointment.videoroom_url) {
      console.log('Appointment already has a video room URL:', appointment.videoroom_url);
      return new Response(
        JSON.stringify({ 
          success: true, 
          videoroom_url: appointment.videoroom_url,
          message: 'Video room already exists' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip if not a telehealth appointment
    if (!appointment.is_telehealth) {
      console.log('Appointment is not a telehealth session, skipping room creation');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Appointment is not a telehealth session' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Daily.co room
    const roomName = `appt-${appointmentId}`;
    console.log('Creating Daily.co room:', roomName);

    const dailyResponse = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dailyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: roomName,
        privacy: 'private',
        properties: {
          enable_screenshare: true,
          enable_chat: true,
          start_video_off: false,
          start_audio_off: false,
        },
      }),
    });

    if (!dailyResponse.ok) {
      const errorText = await dailyResponse.text();
      console.error('Daily.co API error:', dailyResponse.status, errorText);
      
      // If room already exists, try to get its URL
      if (dailyResponse.status === 400 && errorText.includes('already exists')) {
        const getResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
          headers: {
            'Authorization': `Bearer ${dailyApiKey}`,
          },
        });
        
        if (getResponse.ok) {
          const existingRoom = await getResponse.json();
          const videoUrl = existingRoom.url;
          
          // Update appointment with existing room URL
          await supabase
            .from('appointments')
            .update({ videoroom_url: videoUrl })
            .eq('id', appointmentId);
          
          return new Response(
            JSON.stringify({ success: true, videoroom_url: videoUrl }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to create Daily.co room', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dailyRoom = await dailyResponse.json();
    const videoUrl = dailyRoom.url;

    console.log('Daily.co room created:', videoUrl);

    // Update appointment with video room URL
    const { error: updateError } = await supabase
      .from('appointments')
      .update({ videoroom_url: videoUrl })
      .eq('id', appointmentId);

    if (updateError) {
      console.error('Error updating appointment with video URL:', updateError);
      // Room was created but we couldn't save the URL - still return success with the URL
      return new Response(
        JSON.stringify({ 
          success: true, 
          videoroom_url: videoUrl,
          warning: 'Room created but failed to save URL to database'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Appointment updated with video room URL');

    return new Response(
      JSON.stringify({ success: true, videoroom_url: videoUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in create-daily-room:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
