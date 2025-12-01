import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  customerEmail: string;
  customerName: string;
  businessName?: string;
  password: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customerEmail, customerName, businessName = "Our Practice", password }: WelcomeEmailRequest = await req.json();

    console.log(`📧 Sending welcome email to: ${customerEmail}`);

    if (!customerEmail) {
      throw new Error("Customer email is required");
    }

    if (!password) {
      throw new Error("Password is required");
    }

    // Construct login credentials section
    const loginSection = `
      <div style="background-color: #eff6ff; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #4F46E5;">
        <h2 style="margin-top: 0; color: #1e40af;">🔐 Your Login Credentials</h2>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
          Use these credentials to access your portal:
        </p>
        <div style="background-color: white; padding: 20px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 8px 0;"><strong>Email:</strong> ${customerEmail}</p>
          <p style="margin: 8px 0;"><strong>Temporary Password:</strong> <code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 14px;">${password}</code></p>
          <p style="margin: 8px 0;"><strong>Login URL:</strong> <a href="https://emr.valorwell.org/auth" style="color: #4F46E5;">https://emr.valorwell.org/auth</a></p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="https://emr.valorwell.org/auth" style="display: inline-block; padding: 14px 32px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Login Now
          </a>
        </div>
        <p style="font-size: 13px; color: #6b7280; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <strong>Important:</strong> Please change your password after your first login for security purposes.
        </p>
      </div>
    `;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background-color: #f9fafb; }
            .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to ${businessName}!</h1>
            </div>
            <div class="content">
              <h2>Hello ${customerName},</h2>
              <p>We're excited to have you as a new patient! Your account has been successfully created.</p>
              
              ${loginSection}
              
              <p>Our team is looking forward to providing you with excellent care. If you have any questions or need to schedule an appointment, please don't hesitate to reach out.</p>
              <p>You can access your portal anytime to:</p>
              <ul>
                <li>View upcoming appointments</li>
                <li>Complete intake forms</li>
                <li>Update your information</li>
                <li>Communicate with your care team</li>
              </ul>
            </div>
            <div class="footer">
              <p>If you didn't create this account, please contact us immediately.</p>
              <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: `${businessName} <onboarding@resend.dev>`,
      to: [customerEmail],
      subject: `Welcome to ${businessName} - Your Login Credentials`,
      html: emailHtml,
    });

    console.log("✅ Welcome email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("❌ Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
