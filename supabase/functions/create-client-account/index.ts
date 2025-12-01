import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// Supabase client - using @2 version range for CDN stability
// This auto-resolves to latest 2.x patch version
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

interface CreateClientAccountRequest {
  email: string;
  firstName: string;
  lastName: string;
  customerId: string;
  tenantId: string;
  redirectUrl?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName, customerId, tenantId, redirectUrl }: CreateClientAccountRequest = await req.json();

    console.log("📝 Creating client account for:", email);
    
    // Generate random password
    const generatedPassword = generateRandomPassword(12);
    console.log(`🔑 Generated password for ${email}`);

    // Create Supabase client with service role for admin operations
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
    const { data: existingUsers, error: checkError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (checkError) {
      console.error("❌ Error checking existing users:", checkError);
      throw new Error("Failed to check for existing users");
    }

    const existingUser = existingUsers.users.find(u => u.email === email);
    
    if (existingUser) {
      console.log("⚠️ User already exists with email:", email);
      return new Response(
        JSON.stringify({ 
          error: "A user with this email already exists",
          userId: existingUser.id 
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create auth user WITH PASSWORD
    const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: true, // Skip email confirmation step
      user_metadata: {
        user_type: 'client',
        first_name: firstName,
        last_name: lastName,
        tenant_id: tenantId,
      },
    });

    if (createError) {
      console.error("❌ Error creating auth user:", createError);
      throw createError;
    }

    console.log("✅ Auth user created:", authUser.user.id);

    // Update customer record with client_user_id
    const { error: updateError } = await supabaseAdmin
      .from('customers')
      .update({ client_user_id: authUser.user.id })
      .eq('id', customerId);

    if (updateError) {
      console.error("❌ Error updating customer record:", updateError);
      // Don't throw here - auth user is created, we'll handle this on retry
    } else {
      console.log("✅ Customer record updated with client_user_id");
    }

    // Store the generated password in profiles table
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ password: generatedPassword })
      .eq('user_id', authUser.user.id);

    if (profileUpdateError) {
      console.error("⚠️ Error storing password in profile:", profileUpdateError);
      // Don't throw - user is created, this is just for reference
    } else {
      console.log("✅ Password stored in profiles table");
    }

    return new Response(
      JSON.stringify({
        userId: authUser.user.id,
        password: generatedPassword,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("❌ Error in create-client-account function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
