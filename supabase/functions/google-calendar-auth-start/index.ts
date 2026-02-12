import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Look up the staff record for this user
    const { data: staffRecord, error: staffError } = await supabase
      .from("staff")
      .select("id, tenant_id")
      .eq("profile_id", userId)
      .maybeSingle();

    if (staffError || !staffRecord) {
      return new Response(
        JSON.stringify({ error: "Staff record not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const staffId = staffRecord.id;
    const tenantId = staffRecord.tenant_id;

    // Build HMAC state parameter: staff_id:tenant_id signed with secret
    const signingSecret = Deno.env.get("OAUTH_STATE_SIGNING_SECRET")!;
    const statePayload = `${staffId}:${tenantId}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(signingSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(statePayload)
    );
    const signatureHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const state = `${statePayload}:${signatureHex}`;

    // Build the Google OAuth URL
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI")!;
    const scopes = Deno.env.get("GOOGLE_SCOPES") ||
      "https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events";
    const prompt = Deno.env.get("GOOGLE_OAUTH_PROMPT") || "consent";
    const accessType = Deno.env.get("GOOGLE_OAUTH_ACCESS_TYPE") || "offline";

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes,
      access_type: accessType,
      prompt: prompt,
      state: state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return new Response(JSON.stringify({ url: authUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("google-calendar-auth-start error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
