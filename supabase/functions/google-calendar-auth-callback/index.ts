import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Encrypt a string using AES-GCM with the TOKEN_ENCRYPTION_KEY */
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
  // Store as iv:ciphertext in hex
  const ivHex = bytesToHex(iv);
  const ctHex = bytesToHex(new Uint8Array(ciphertext));
  return `${ivHex}:${ctHex}`;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://ehr-staff.lovable.app";

    if (error) {
      console.error("Google OAuth error:", error);
      return Response.redirect(
        `${appBaseUrl}/settings?calendar_error=${encodeURIComponent(error)}`,
        302
      );
    }

    if (!code || !state) {
      return Response.redirect(
        `${appBaseUrl}/settings?calendar_error=missing_params`,
        302
      );
    }

    // Validate HMAC state
    const signingSecret = Deno.env.get("OAUTH_STATE_SIGNING_SECRET")!;
    const parts = state.split(":");
    if (parts.length !== 3) {
      return Response.redirect(
        `${appBaseUrl}/settings?calendar_error=invalid_state`,
        302
      );
    }

    const [staffId, tenantId, receivedSig] = parts;
    const statePayload = `${staffId}:${tenantId}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(signingSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const expectedSig = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(statePayload)
    );
    const expectedSigHex = bytesToHex(new Uint8Array(expectedSig));

    if (receivedSig !== expectedSigHex) {
      console.error("HMAC state validation failed");
      return Response.redirect(
        `${appBaseUrl}/settings?calendar_error=state_mismatch`,
        302
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
        redirect_uri: Deno.env.get("GOOGLE_REDIRECT_URI")!,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error("Token exchange failed:", errBody);
      return Response.redirect(
        `${appBaseUrl}/settings?calendar_error=token_exchange_failed`,
        302
      );
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    const expiresIn = tokens.expires_in; // seconds

    // Encrypt tokens
    const encryptionKey = Deno.env.get("TOKEN_ENCRYPTION_KEY")!;
    const encryptedAccess = await encryptToken(accessToken, encryptionKey);
    const encryptedRefresh = refreshToken
      ? await encryptToken(refreshToken, encryptionKey)
      : null;

    const tokenExpiresAt = new Date(
      Date.now() + (expiresIn || 3600) * 1000
    ).toISOString();

    // Use service role to upsert the connection
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: upsertError } = await supabaseAdmin
      .from("staff_calendar_connections")
      .upsert(
        {
          staff_id: staffId,
          tenant_id: tenantId,
          provider: "google",
          access_token_encrypted: encryptedAccess,
          refresh_token_encrypted: encryptedRefresh,
          token_expires_at: tokenExpiresAt,
          connection_status: "connected",
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "staff_id,provider" }
      );

    if (upsertError) {
      console.error("Failed to store connection:", upsertError);
      return Response.redirect(
        `${appBaseUrl}/settings?calendar_error=storage_failed`,
        302
      );
    }

    console.log(`Calendar connected for staff ${staffId}`);
    return Response.redirect(
      `${appBaseUrl}/settings?calendar_connected=true`,
      302
    );
  } catch (err) {
    console.error("google-calendar-auth-callback error:", err);
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://ehr-staff.lovable.app";
    return Response.redirect(
      `${appBaseUrl}/settings?calendar_error=internal_error`,
      302
    );
  }
});
