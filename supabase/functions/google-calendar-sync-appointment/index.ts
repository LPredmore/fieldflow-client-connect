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

async function getAccessToken(
  connection: Record<string, unknown>,
  encryptionKey: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<string | null> {
  const isExpired =
    !connection.token_expires_at ||
    new Date(connection.token_expires_at as string) <= new Date();

  if (isExpired && connection.refresh_token_encrypted) {
    return refreshAccessToken(
      connection as { id: string; refresh_token_encrypted: string },
      encryptionKey,
      supabaseAdmin
    );
  }

  return decryptToken(
    connection.access_token_encrypted as string,
    encryptionKey
  );
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

    const { appointment_id, action } = await req.json();

    if (!appointment_id || !["create", "update", "delete"].includes(action)) {
      return new Response(
        JSON.stringify({
          error: "appointment_id and action (create|update|delete) required",
        }),
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

    // Get the appointment
    const { data: appointment, error: apptError } = await supabaseAdmin
      .from("appointments")
      .select("id, staff_id, tenant_id, start_at, end_at, time_zone")
      .eq("id", appointment_id)
      .maybeSingle();

    if (apptError || !appointment) {
      return new Response(
        JSON.stringify({ error: "Appointment not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get calendar connection for this staff member
    const { data: connection } = await supabaseAdmin
      .from("staff_calendar_connections")
      .select("*")
      .eq("staff_id", appointment.staff_id)
      .eq("provider", "google")
      .maybeSingle();

    if (
      !connection ||
      connection.connection_status !== "connected" ||
      !connection.selected_calendar_id
    ) {
      return new Response(
        JSON.stringify({
          synced: false,
          reason: "no_calendar_connection",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const encryptionKey = Deno.env.get("TOKEN_ENCRYPTION_KEY")!;
    const accessToken = await getAccessToken(
      connection,
      encryptionKey,
      supabaseAdmin
    );

    if (!accessToken) {
      await supabaseAdmin
        .from("staff_calendar_connections")
        .update({
          connection_status: "needs_reconnect",
          last_error: "Token refresh failed during sync",
        })
        .eq("id", connection.id);

      // Record failed sync
      await supabaseAdmin.from("calendar_sync_log").upsert(
        {
          appointment_id: appointment.id,
          staff_id: appointment.staff_id,
          tenant_id: appointment.tenant_id,
          sync_status: "failed",
          sync_direction: "outbound",
          error_message: "Token refresh failed",
          google_calendar_id: connection.selected_calendar_id,
        },
        { onConflict: "appointment_id,staff_id" }
      );

      return new Response(
        JSON.stringify({ synced: false, reason: "needs_reconnect" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const calendarId = connection.selected_calendar_id;
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    // Check for existing sync log
    const { data: existingLog } = await supabaseAdmin
      .from("calendar_sync_log")
      .select("*")
      .eq("appointment_id", appointment.id)
      .eq("staff_id", appointment.staff_id)
      .maybeSingle();

    let result: { synced: boolean; google_event_id?: string; error?: string };

    if (action === "create") {
      // If there's already a synced event, update instead
      if (existingLog?.google_event_id) {
        const updateResp = await fetch(
          `${baseUrl}/${existingLog.google_event_id}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              summary: "ValorWell",
              start: { dateTime: appointment.start_at },
              end: { dateTime: appointment.end_at },
            }),
          }
        );

        if (updateResp.ok) {
          await supabaseAdmin
            .from("calendar_sync_log")
            .update({
              sync_status: "synced",
              last_synced_at: new Date().toISOString(),
              error_message: null,
              retry_count: 0,
            })
            .eq("id", existingLog.id);

          result = { synced: true, google_event_id: existingLog.google_event_id };
        } else {
          result = { synced: false, error: "Failed to update existing event" };
        }
      } else {
        // Create new event
        const createResp = await fetch(baseUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: "ValorWell",
            start: { dateTime: appointment.start_at },
            end: { dateTime: appointment.end_at },
          }),
        });

        if (createResp.ok) {
          const eventData = await createResp.json();

          await supabaseAdmin.from("calendar_sync_log").upsert(
            {
              appointment_id: appointment.id,
              staff_id: appointment.staff_id,
              tenant_id: appointment.tenant_id,
              google_event_id: eventData.id,
              google_calendar_id: calendarId,
              sync_status: "synced",
              sync_direction: "outbound",
              last_synced_at: new Date().toISOString(),
              error_message: null,
              retry_count: 0,
            },
            { onConflict: "appointment_id,staff_id" }
          );

          result = { synced: true, google_event_id: eventData.id };
        } else {
          const errText = await createResp.text();
          console.error("Failed to create Google event:", errText);

          await supabaseAdmin.from("calendar_sync_log").upsert(
            {
              appointment_id: appointment.id,
              staff_id: appointment.staff_id,
              tenant_id: appointment.tenant_id,
              google_calendar_id: calendarId,
              sync_status: "failed",
              sync_direction: "outbound",
              error_message: `Create failed: ${createResp.status}`,
              retry_count: (existingLog?.retry_count || 0) + 1,
            },
            { onConflict: "appointment_id,staff_id" }
          );

          if (createResp.status === 401) {
            await supabaseAdmin
              .from("staff_calendar_connections")
              .update({
                connection_status: "needs_reconnect",
                last_error: "Google auth revoked during sync",
              })
              .eq("id", connection.id);
          }

          result = { synced: false, error: `Google API error: ${createResp.status}` };
        }
      }
    } else if (action === "update") {
      if (!existingLog?.google_event_id) {
        // No existing event — create one instead
        const createResp = await fetch(baseUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: "ValorWell",
            start: { dateTime: appointment.start_at },
            end: { dateTime: appointment.end_at },
          }),
        });

        if (createResp.ok) {
          const eventData = await createResp.json();
          await supabaseAdmin.from("calendar_sync_log").upsert(
            {
              appointment_id: appointment.id,
              staff_id: appointment.staff_id,
              tenant_id: appointment.tenant_id,
              google_event_id: eventData.id,
              google_calendar_id: calendarId,
              sync_status: "synced",
              sync_direction: "outbound",
              last_synced_at: new Date().toISOString(),
              error_message: null,
              retry_count: 0,
            },
            { onConflict: "appointment_id,staff_id" }
          );
          result = { synced: true, google_event_id: eventData.id };
        } else {
          result = { synced: false, error: "Failed to create event on update" };
        }
      } else {
        const updateResp = await fetch(
          `${baseUrl}/${existingLog.google_event_id}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              summary: "ValorWell",
              start: { dateTime: appointment.start_at },
              end: { dateTime: appointment.end_at },
            }),
          }
        );

        if (updateResp.ok) {
          await supabaseAdmin
            .from("calendar_sync_log")
            .update({
              sync_status: "synced",
              last_synced_at: new Date().toISOString(),
              error_message: null,
              retry_count: 0,
            })
            .eq("id", existingLog.id);

          result = { synced: true, google_event_id: existingLog.google_event_id };
        } else {
          const errText = await updateResp.text();
          console.error("Failed to update Google event:", errText);

          await supabaseAdmin
            .from("calendar_sync_log")
            .update({
              sync_status: "failed",
              error_message: `Update failed: ${updateResp.status}`,
              retry_count: (existingLog.retry_count || 0) + 1,
            })
            .eq("id", existingLog.id);

          result = { synced: false, error: `Google API error: ${updateResp.status}` };
        }
      }
    } else if (action === "delete") {
      if (existingLog?.google_event_id) {
        const deleteResp = await fetch(
          `${baseUrl}/${existingLog.google_event_id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        // 204 = success, 410 = already deleted (both fine)
        if (deleteResp.ok || deleteResp.status === 204 || deleteResp.status === 410) {
          await supabaseAdmin
            .from("calendar_sync_log")
            .update({
              sync_status: "synced",
              last_synced_at: new Date().toISOString(),
              error_message: null,
            })
            .eq("id", existingLog.id);

          result = { synced: true };
        } else {
          const errText = await deleteResp.text();
          console.error("Failed to delete Google event:", errText);

          await supabaseAdmin
            .from("calendar_sync_log")
            .update({
              sync_status: "failed",
              error_message: `Delete failed: ${deleteResp.status}`,
              retry_count: (existingLog.retry_count || 0) + 1,
            })
            .eq("id", existingLog.id);

          result = { synced: false, error: `Google API error: ${deleteResp.status}` };
        }
      } else {
        // No event to delete — that's fine
        result = { synced: true };
      }
    } else {
      result = { synced: false, error: "Unknown action" };
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("google-calendar-sync-appointment error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
