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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function decryptToken(encrypted: string, keyHex: string): Promise<string> {
  const [ivHex, ctHex] = encrypted.split(":");
  const iv = hexToBytes(ivHex);
  const ciphertext = hexToBytes(ctHex);
  const keyBytes = hexToBytes(keyHex);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

async function encryptToken(plaintext: string, keyHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyBytes = hexToBytes(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoder.encode(plaintext)
  );
  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(ciphertext))}`;
}

async function refreshAccessToken(
  connection: { id: string; refresh_token_encrypted: string },
  encryptionKey: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<string | null> {
  const refreshToken = await decryptToken(
    connection.refresh_token_encrypted,
    encryptionKey
  );

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
    .update({
      access_token_encrypted: encryptedAccess,
      token_expires_at: expiresAt,
    })
    .eq("id", connection.id);

  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { staff_id, time_min, time_max } = await req.json();

    if (!staff_id || !time_min || !time_max) {
      return new Response(
        JSON.stringify({ error: "staff_id, time_min, and time_max are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get calendar connection
    const { data: connection } = await supabaseAdmin
      .from("staff_calendar_connections")
      .select("*")
      .eq("staff_id", staff_id)
      .eq("provider", "google")
      .eq("connection_status", "connected")
      .maybeSingle();

    if (!connection) {
      return new Response(
        JSON.stringify({ busy: [], connected: false }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!connection.selected_calendar_id) {
      return new Response(
        JSON.stringify({ busy: [], connected: true, calendar_selected: false }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const encryptionKey = Deno.env.get("TOKEN_ENCRYPTION_KEY")!;
    let accessToken: string;

    const isExpired =
      !connection.token_expires_at ||
      new Date(connection.token_expires_at) <= new Date();

    if (isExpired && connection.refresh_token_encrypted) {
      const refreshed = await refreshAccessToken(connection, encryptionKey, supabaseAdmin);
      if (!refreshed) {
        await supabaseAdmin
          .from("staff_calendar_connections")
          .update({
            connection_status: "needs_reconnect",
            last_error: "Token refresh failed",
          })
          .eq("id", connection.id);

        return new Response(
          JSON.stringify({ busy: [], connected: false, needs_reconnect: true }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      accessToken = refreshed;
    } else {
      accessToken = await decryptToken(
        connection.access_token_encrypted,
        encryptionKey
      );
    }

    // Call Google FreeBusy API
    const freeBusyResp = await fetch(
      "https://www.googleapis.com/calendar/v3/freeBusy",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin: time_min,
          timeMax: time_max,
          items: [{ id: connection.selected_calendar_id }],
        }),
      }
    );

    if (!freeBusyResp.ok) {
      const errText = await freeBusyResp.text();
      console.error("FreeBusy API error:", errText);

      if (freeBusyResp.status === 401) {
        await supabaseAdmin
          .from("staff_calendar_connections")
          .update({
            connection_status: "needs_reconnect",
            last_error: "Google auth revoked",
          })
          .eq("id", connection.id);
      }

      return new Response(
        JSON.stringify({ busy: [], error: "Failed to fetch availability" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const freeBusyData = await freeBusyResp.json();
    const calendarBusy =
      freeBusyData.calendars?.[connection.selected_calendar_id]?.busy || [];

    // Return only start/end pairs — no event details
    const busy = calendarBusy.map(
      (interval: { start: string; end: string }) => ({
        start: interval.start,
        end: interval.end,
      })
    );

    // Update last_sync_at
    await supabaseAdmin
      .from("staff_calendar_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", connection.id);

    return new Response(
      JSON.stringify({ busy, connected: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("google-calendar-get-availability error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
