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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
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

/** Refresh access token using stored refresh token */
async function refreshAccessToken(
  connection: { id: string; refresh_token_encrypted: string },
  encryptionKey: string
): Promise<{ accessToken: string; expiresAt: string } | null> {
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

  // Update stored access token
  const encryptedAccess = await encryptToken(data.access_token, encryptionKey);
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  await supabaseAdmin
    .from("staff_calendar_connections")
    .update({
      access_token_encrypted: encryptedAccess,
      token_expires_at: expiresAt,
    })
    .eq("id", connection.id);

  return { accessToken: data.access_token, expiresAt };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate
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
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Get staff record
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: staffRecord } = await supabaseAdmin
      .from("staff")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();

    if (!staffRecord) {
      return new Response(JSON.stringify({ error: "Staff not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get calendar connection
    const { data: connection } = await supabaseAdmin
      .from("staff_calendar_connections")
      .select("*")
      .eq("staff_id", staffRecord.id)
      .eq("provider", "google")
      .maybeSingle();

    if (!connection || connection.connection_status !== "connected") {
      return new Response(
        JSON.stringify({ error: "Google Calendar not connected" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const encryptionKey = Deno.env.get("TOKEN_ENCRYPTION_KEY")!;
    let accessToken: string;

    // Check if token is expired
    const isExpired =
      !connection.token_expires_at ||
      new Date(connection.token_expires_at) <= new Date();

    if (isExpired && connection.refresh_token_encrypted) {
      const refreshed = await refreshAccessToken(connection, encryptionKey);
      if (!refreshed) {
        // Mark as needs_reconnect
        await supabaseAdmin
          .from("staff_calendar_connections")
          .update({
            connection_status: "needs_reconnect",
            last_error: "Token refresh failed",
          })
          .eq("id", connection.id);

        return new Response(
          JSON.stringify({ error: "needs_reconnect" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      accessToken = refreshed.accessToken;
    } else {
      accessToken = await decryptToken(
        connection.access_token_encrypted,
        encryptionKey
      );
    }

    // Call Google Calendar API to list calendars
    const calResp = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!calResp.ok) {
      const errText = await calResp.text();
      console.error("Google Calendar API error:", errText);

      if (calResp.status === 401) {
        await supabaseAdmin
          .from("staff_calendar_connections")
          .update({
            connection_status: "needs_reconnect",
            last_error: "Google auth revoked",
          })
          .eq("id", connection.id);

        return new Response(
          JSON.stringify({ error: "needs_reconnect" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to list calendars" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const calData = await calResp.json();
    const calendars = (calData.items || []).map(
      (cal: { id: string; summary: string; primary?: boolean }) => ({
        id: cal.id,
        summary: cal.summary,
        primary: cal.primary || false,
      })
    );

    return new Response(
      JSON.stringify({
        calendars,
        selected_calendar_id: connection.selected_calendar_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("google-calendar-list-calendars error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
