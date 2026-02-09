import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id } = await req.json();
    if (!message_id) {
      console.error("notify-new-message: missing message_id");
      return new Response(JSON.stringify({ error: "missing message_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("notify-new-message: RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "email service not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const resend = new Resend(resendApiKey);

    // 1. Fetch the message
    const { data: message, error: msgError } = await supabase
      .from("messages")
      .select("id, sender_type, staff_id, client_id")
      .eq("id", message_id)
      .single();

    if (msgError || !message) {
      console.error("notify-new-message: message not found", msgError);
      return new Response(JSON.stringify({ error: "message not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2. Only notify for client-sent messages (defense-in-depth; trigger already filters)
    if (message.sender_type !== "client") {
      return new Response(JSON.stringify({ skipped: true, reason: "not a client message" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 3. Get staff email via staff -> profiles
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("profile_id")
      .eq("id", message.staff_id)
      .single();

    if (staffError || !staff?.profile_id) {
      console.error("notify-new-message: staff not found", staffError);
      return new Response(JSON.stringify({ error: "staff not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", staff.profile_id)
      .single();

    if (profileError || !profile?.email) {
      console.error("notify-new-message: staff email not found", profileError);
      return new Response(JSON.stringify({ error: "staff email not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 4. Get client name
    const { data: client } = await supabase
      .from("clients")
      .select("pat_name_f, pat_name_l, pat_name_preferred")
      .eq("id", message.client_id)
      .single();

    const clientName = client?.pat_name_preferred ||
      [client?.pat_name_f, client?.pat_name_l].filter(Boolean).join(" ") ||
      "a client";

    // 5. Send PHI-safe email (no message content)
    const emailResponse = await resend.emails.send({
      from: "ValorWell <noreply@valorwell.org>",
      to: [profile.email],
      subject: `New message from ${clientName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a; margin-bottom: 16px;">New Message</h2>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">
            You have a new message from <strong>${clientName}</strong>.
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">
            Log in to view and respond.
          </p>
          <a href="https://ehr-staff.lovable.app/messages" 
             style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px;">
            Open Messages
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            This is an automated notification. Please do not reply to this email.
          </p>
        </div>
      `,
    });

    console.log("notify-new-message: email sent", {
      message_id,
      to: profile.email,
      resend_id: emailResponse?.data?.id,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("notify-new-message: unexpected error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
