import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

async function decryptToken(encrypted: string, keyHex: string): Promise<string> {
  const [ivHex, ctHex] = encrypted.split(":");
  const iv = hexToBytes(ivHex);
  const ciphertext = hexToBytes(ctHex);
  const keyBytes = hexToBytes(keyHex);
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv }, cryptoKey, ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

async function encryptToken(plaintext: string, keyHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyBytes = hexToBytes(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, cryptoKey, encoder.encode(plaintext)
  );
  const ivHex2 = Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join("");
  const ctHex2 = Array.from(new Uint8Array(ciphertext)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${ivHex2}:${ctHex2}`;
}

async function refreshAccessToken(
  connection: { id: string; refresh_token_encrypted: string },
  encryptionKey: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<string | null> {
  const refreshToken = await decryptToken(connection.refresh_token_encrypted, encryptionKey);
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  const encryptedAccess = await encryptToken(data.access_token, encryptionKey);
  await supabaseAdmin
    .from("staff_calendar_connections")
    .update({ access_token_encrypted: encryptedAccess, token_expires_at: expiresAt })
    .eq("id", connection.id);
  return data.access_token;
}

async function getAccessToken(
  connection: Record<string, unknown>,
  encryptionKey: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<string | null> {
  const isExpired = !connection.token_expires_at ||
    new Date(connection.token_expires_at as string) <= new Date();
  if (isExpired && connection.refresh_token_encrypted) {
    return refreshAccessToken(
      connection as { id: string; refresh_token_encrypted: string },
      encryptionKey, supabaseAdmin
    );
  }
  return decryptToken(connection.access_token_encrypted as string, encryptionKey);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { staff_id, calendar_id, action } = body;

    // action can be 'start' (default) or 'stop'
    const effectiveAction = action || "start";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (effectiveAction === "stop") {
      // Stop an existing watch channel and clean up
      const { data: channels } = await supabaseAdmin
        .from("calendar_watch_channels")
        .select("*")
        .eq("staff_id", staff_id);

      if (channels && channels.length > 0) {
        // Get access token to stop channels with Google
        const { data: connection } = await supabaseAdmin
          .from("staff_calendar_connections")
          .select("*")
          .eq("staff_id", staff_id)
          .eq("provider", "google")
          .maybeSingle();

        if (connection) {
          const encryptionKey = Deno.env.get("TOKEN_ENCRYPTION_KEY")!;
          const accessToken = await getAccessToken(connection, encryptionKey, supabaseAdmin);

          if (accessToken) {
            for (const ch of channels) {
              try {
                await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    id: ch.channel_id,
                    resourceId: ch.resource_id,
                  }),
                });
                console.log(`[watch-start] Stopped channel: ${ch.channel_id}`);
              } catch (err) {
                console.error(`[watch-start] Error stopping channel ${ch.channel_id}:`, err);
              }
            }
          }
        }

        // Delete channel records
        await supabaseAdmin
          .from("calendar_watch_channels")
          .delete()
          .eq("staff_id", staff_id);
      }

      // Delete all calendar blocks for this staff member
      await supabaseAdmin
        .from("staff_calendar_blocks")
        .delete()
        .eq("staff_id", staff_id)
        .eq("source", "google");

      return new Response(
        JSON.stringify({ success: true, action: "stopped" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === START a new watch ===
    if (!staff_id || !calendar_id) {
      return new Response(
        JSON.stringify({ error: "staff_id and calendar_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get calendar connection
    const { data: connection } = await supabaseAdmin
      .from("staff_calendar_connections")
      .select("*")
      .eq("staff_id", staff_id)
      .eq("provider", "google")
      .maybeSingle();

    if (!connection || connection.connection_status !== "connected") {
      return new Response(
        JSON.stringify({ error: "No active calendar connection" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const encryptionKey = Deno.env.get("TOKEN_ENCRYPTION_KEY")!;
    const accessToken = await getAccessToken(connection, encryptionKey, supabaseAdmin);

    if (!accessToken) {
      await supabaseAdmin
        .from("staff_calendar_connections")
        .update({ connection_status: "needs_reconnect", last_error: "Token refresh failed during watch setup" })
        .eq("id", connection.id);
      return new Response(
        JSON.stringify({ error: "Token refresh failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stop any existing watch channels for this staff member first
    const { data: existingChannels } = await supabaseAdmin
      .from("calendar_watch_channels")
      .select("*")
      .eq("staff_id", staff_id);

    if (existingChannels && existingChannels.length > 0) {
      for (const ch of existingChannels) {
        try {
          await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ id: ch.channel_id, resourceId: ch.resource_id }),
          });
        } catch {
          // Ignore errors stopping old channels
        }
      }
      await supabaseAdmin
        .from("calendar_watch_channels")
        .delete()
        .eq("staff_id", staff_id);
    }

    // Create a new watch channel
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-webhook`;
    const newChannelId = crypto.randomUUID();
    // Google watch channels max out at ~7 days (604800000ms)
    const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const watchResp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar_id)}/events/watch`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: newChannelId,
          type: "web_hook",
          address: webhookUrl,
          expiration,
        }),
      }
    );

    if (!watchResp.ok) {
      const errText = await watchResp.text();
      console.error("[watch-start] Google watch API error:", watchResp.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to create watch channel", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const watchData = await watchResp.json();
    console.log("[watch-start] Watch channel created:", watchData);

    // Store the channel in our database
    await supabaseAdmin
      .from("calendar_watch_channels")
      .insert({
        tenant_id: connection.tenant_id,
        staff_id: staff_id,
        channel_id: watchData.id,
        resource_id: watchData.resourceId,
        calendar_id: calendar_id,
        expiration: new Date(parseInt(watchData.expiration)).toISOString(),
      });

    // Initial full sync: fetch events for next 90 days
    const now = new Date();
    const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    let pageToken: string | undefined;
    let totalSynced = 0;
    let syncToken: string | undefined;

    do {
      let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar_id)}/events?singleEvents=true&maxResults=250&timeMin=${now.toISOString()}&timeMax=${future.toISOString()}`;
      if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

      const eventsResp = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!eventsResp.ok) {
        console.error("[watch-start] Events fetch error:", eventsResp.status);
        break;
      }

      const eventsData = await eventsResp.json();
      const events = eventsData.items || [];
      pageToken = eventsData.nextPageToken;
      syncToken = eventsData.nextSyncToken;

      // Bulk upsert events as calendar blocks
      for (const event of events) {
        if (!event.id || !event.start?.dateTime || !event.end?.dateTime) continue;
        if (event.status === "cancelled") continue;

        const { error } = await supabaseAdmin
          .from("staff_calendar_blocks")
          .upsert(
            {
              tenant_id: connection.tenant_id,
              staff_id: staff_id,
              start_at: event.start.dateTime,
              end_at: event.end.dateTime,
              source: "google",
              external_event_id: event.id,
              summary: "Busy",
            },
            { onConflict: "staff_id,source,external_event_id", ignoreDuplicates: false }
          );

        if (!error) totalSynced++;
      }
    } while (pageToken);

    // Save sync token for incremental syncs
    if (syncToken) {
      await supabaseAdmin
        .from("calendar_watch_channels")
        .update({ sync_token: syncToken })
        .eq("channel_id", watchData.id);
    }

    console.log(`[watch-start] Initial sync complete: ${totalSynced} events for staff ${staff_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        channel_id: watchData.id,
        expiration: watchData.expiration,
        initial_sync_count: totalSynced,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[watch-start] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
