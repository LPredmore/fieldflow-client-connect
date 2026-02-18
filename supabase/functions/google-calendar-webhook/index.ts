import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-goog-channel-id, x-goog-resource-id, x-goog-resource-state, x-goog-message-number",
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const channelId = req.headers.get("x-goog-channel-id");
    const resourceState = req.headers.get("x-goog-resource-state");

    // Google sends a "sync" notification when the channel is first created — acknowledge it
    if (resourceState === "sync") {
      console.log("[webhook] Sync notification received for channel:", channelId);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (!channelId) {
      console.error("[webhook] Missing x-goog-channel-id header");
      return new Response("Bad Request", { status: 400, headers: corsHeaders });
    }

    // Validate channel exists in our database
    const { data: watchChannel, error: channelError } = await supabaseAdmin
      .from("calendar_watch_channels")
      .select("*")
      .eq("channel_id", channelId)
      .maybeSingle();

    if (channelError || !watchChannel) {
      console.error("[webhook] Unknown channel:", channelId, channelError);
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    }

    // Get the staff member's calendar connection
    const { data: connection } = await supabaseAdmin
      .from("staff_calendar_connections")
      .select("*")
      .eq("staff_id", watchChannel.staff_id)
      .eq("provider", "google")
      .maybeSingle();

    if (!connection || connection.connection_status !== "connected") {
      console.log("[webhook] No active connection for staff:", watchChannel.staff_id);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const encryptionKey = Deno.env.get("TOKEN_ENCRYPTION_KEY")!;
    const accessToken = await getAccessToken(connection, encryptionKey, supabaseAdmin);

    if (!accessToken) {
      console.error("[webhook] Token refresh failed for staff:", watchChannel.staff_id);
      await supabaseAdmin
        .from("staff_calendar_connections")
        .update({ connection_status: "needs_reconnect", last_error: "Token refresh failed during webhook" })
        .eq("id", connection.id);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Fetch changed events using sync token if available
    const calendarId = encodeURIComponent(watchChannel.calendar_id);
    let eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?singleEvents=true&maxResults=250`;

    if (watchChannel.sync_token) {
      eventsUrl += `&syncToken=${encodeURIComponent(watchChannel.sync_token)}`;
    } else {
      // No sync token — do initial sync for next 90 days
      const now = new Date();
      const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      eventsUrl += `&timeMin=${now.toISOString()}&timeMax=${future.toISOString()}`;
    }

    const eventsResp = await fetch(eventsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (eventsResp.status === 410) {
      // Sync token invalidated — clear it and do a full re-sync on next notification
      console.log("[webhook] Sync token expired, clearing for full re-sync");
      await supabaseAdmin
        .from("calendar_watch_channels")
        .update({ sync_token: null })
        .eq("id", watchChannel.id);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (!eventsResp.ok) {
      const errText = await eventsResp.text();
      console.error("[webhook] Events API error:", eventsResp.status, errText);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const eventsData = await eventsResp.json();
    const events = eventsData.items || [];
    const nextSyncToken = eventsData.nextSyncToken;

    console.log(`[webhook] Processing ${events.length} events for staff ${watchChannel.staff_id}`);

    // Process each event
    for (const event of events) {
      const eventId = event.id;
      if (!eventId) continue;

      if (event.status === "cancelled") {
        // Delete the block
        await supabaseAdmin
          .from("staff_calendar_blocks")
          .delete()
          .eq("staff_id", watchChannel.staff_id)
          .eq("source", "google")
          .eq("external_event_id", eventId);
        console.log(`[webhook] Deleted block for cancelled event: ${eventId}`);
      } else if (event.start && event.end) {
        // Skip all-day events (they have .date instead of .dateTime)
        const startAt = event.start.dateTime;
        const endAt = event.end.dateTime;
        if (!startAt || !endAt) continue;

        // Upsert the block — always store as 'Busy' (privacy constraint)
        const { error: upsertError } = await supabaseAdmin
          .from("staff_calendar_blocks")
          .upsert(
            {
              tenant_id: watchChannel.tenant_id,
              staff_id: watchChannel.staff_id,
              start_at: startAt,
              end_at: endAt,
              source: "google",
              external_event_id: eventId,
              summary: "Busy",
            },
            {
              onConflict: "staff_id,source,external_event_id",
              ignoreDuplicates: false,
            }
          );

        if (upsertError) {
          console.error(`[webhook] Upsert error for event ${eventId}:`, upsertError);
        } else {
          console.log(`[webhook] Upserted block for event: ${eventId}`);
        }
      }
    }

    // Save the new sync token for incremental sync next time
    if (nextSyncToken) {
      await supabaseAdmin
        .from("calendar_watch_channels")
        .update({ sync_token: nextSyncToken })
        .eq("id", watchChannel.id);
    }

    // Update last_sync_at on connection
    await supabaseAdmin
      .from("staff_calendar_connections")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", connection.id);

    return new Response(JSON.stringify({ processed: events.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[webhook] Unhandled error:", err);
    // Always return 200 to Google to avoid retries flooding us
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
