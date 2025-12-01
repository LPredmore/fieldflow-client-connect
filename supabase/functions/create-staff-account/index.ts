import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// Supabase client - using @2 version range for CDN stability
// This auto-resolves to latest 2.x patch version
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate random password
function generateRandomPassword(length: number = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

interface CreateStaffAccountRequest {
  email: string;
  firstName: string;
  lastName: string;
  specialty: string;
  npiNumber: string;
  primaryState: string;
  licenseType: string;
  licenseNumber: string;
  taxonomy: string;
  inviterTenantId: string;
  inviterCompanyName?: string;
  inviterAvatarUrl?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: CreateStaffAccountRequest = await req.json();
    const {
      email,
      firstName,
      lastName,
      specialty,
      npiNumber,
      primaryState,
      licenseType,
      licenseNumber,
      taxonomy,
      inviterTenantId,
      inviterCompanyName,
      inviterAvatarUrl,
    } = requestData;

    console.log(`📝 Creating staff account for: ${email}`);

    // Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.some((u) => u.email === email);

    if (userExists) {
      return new Response(
        JSON.stringify({ error: "User with this email already exists" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate random password
    const generatedPassword = generateRandomPassword(12);
    console.log(`🔑 Generated password for ${email}`);

    // Create user with admin client WITH PASSWORD
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        user_type: "contractor",
        first_name: firstName,
        last_name: lastName,
        clinician_field: specialty,
        clinician_npi_number: npiNumber,
        primary_state: primaryState,
        clinician_license_type: licenseType,
        clinician_license_number: licenseNumber,
        clinician_taxonomy_code: taxonomy,
        inviter_tenant_id: inviterTenantId,
        inviter_company_name: inviterCompanyName,
        inviter_avatar_url: inviterAvatarUrl,
      },
    });

    if (createError) {
      console.error("❌ Error creating user:", createError);
      throw createError;
    }

    if (!userData.user) {
      throw new Error("User creation failed - no user returned");
    }

    console.log("✅ User created successfully:", userData.user.id);

    // Store the generated password in profiles table
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ password: generatedPassword })
      .eq('user_id', userData.user.id);

    if (profileUpdateError) {
      console.error("⚠️ Error storing password in profile:", profileUpdateError);
      // Don't throw - user is created, this is just for reference
    } else {
      console.log("✅ Password stored in profiles table");
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: userData.user.id,
        password: generatedPassword,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("❌ Error in create-staff-account function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
