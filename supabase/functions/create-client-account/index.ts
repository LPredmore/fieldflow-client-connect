import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateRandomPassword(length: number = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

interface CreateClientRequest {
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  preferredName?: string;
  phone: string;
  biologicalSex?: string;
  assignedClinicianId?: string;
  streetAddress?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  tenantId: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: CreateClientRequest = await req.json();
    const {
      email,
      firstName,
      lastName,
      middleName,
      preferredName,
      phone,
      biologicalSex,
      assignedClinicianId,
      streetAddress,
      address2,
      city,
      state,
      zipCode,
      country,
      tenantId,
    } = requestData;

    // Validate required fields
    if (!email || !firstName || !lastName || !tenantId) {
      console.error("Missing required fields:", { 
        email: !!email, 
        firstName: !!firstName, 
        lastName: !!lastName, 
        tenantId: !!tenantId 
      });
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, firstName, lastName, tenantId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating client account:", { email, firstName, lastName, tenantId });

    // Initialize Supabase Admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Step 1: Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === email);
    
    if (existingUser) {
      console.error("User already exists:", email);
      return new Response(
        JSON.stringify({ error: "A user with this email already exists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Generate password
    const password = generateRandomPassword(12);
    console.log("Generated password for new client");

    // Step 3: Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      console.error("Failed to create auth user:", authError);
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${authError?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;
    console.log("Created auth user:", userId);

    // Step 4: UPSERT into profiles (handles trigger race condition)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email: email,
        password: password,
        is_active: true,
        email_verified: true,
      }, { 
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (profileError) {
      console.error("Failed to create profile:", profileError);
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Failed to create profile: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("Created profile for client:", userId);

    // Step 5: Insert into tenant_memberships
    const { error: membershipError } = await supabaseAdmin
      .from("tenant_memberships")
      .insert({
        tenant_id: tenantId,
        profile_id: userId,
        tenant_role: "member",
      });

    if (membershipError) {
      console.error("Failed to create tenant membership:", membershipError);
      // Rollback
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Failed to create tenant membership: ${membershipError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("Created tenant membership for client:", userId);

    // Step 6: Insert into user_roles (role = 'client')
    const { error: userRoleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "client",
      });

    if (userRoleError) {
      console.error("Failed to create user role:", userRoleError);
      // Rollback
      await supabaseAdmin.from("tenant_memberships").delete().eq("profile_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Failed to create user role: ${userRoleError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("Created user_roles entry (client) for:", userId);

    // Step 7: Insert into clients table
    const clientData: Record<string, unknown> = {
      tenant_id: tenantId,
      profile_id: userId,
      pat_name_f: firstName,
      pat_name_l: lastName,
      pat_name_m: middleName || null,
      pat_name_preferred: preferredName || null,
      phone: phone || null,
      email: email,
      pat_sex: biologicalSex || null,
      primary_staff_id: assignedClinicianId || null,
      pat_addr_1: streetAddress || null,
      pat_addr_2: address2 || null,
      pat_city: city || null,
      pat_state: state || null,
      pat_zip: zipCode || null,
      pat_country: country || 'US',
      pat_status: 'New',
    };

    const { data: clientRecord, error: clientError } = await supabaseAdmin
      .from("clients")
      .insert(clientData)
      .select("id")
      .single();

    if (clientError || !clientRecord) {
      console.error("Failed to create client record:", clientError);
      // Rollback
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("tenant_memberships").delete().eq("profile_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Failed to create client record: ${clientError?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId = clientRecord.id;
    console.log("Created client record:", clientId);

    // Success!
    console.log("Successfully created client account:", { userId, clientId, email });
    
    return new Response(
      JSON.stringify({
        success: true,
        userId,
        clientId,
        password,
        message: "Client account created successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${errorMessage}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
