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

interface CreateStaffRequest {
  email: string;
  firstName: string;
  lastName: string;
  specialty?: string; // 'Mental Health' | 'Speech Therapy' | 'Occupational Therapy'
  roles: string[];    // Array of role codes: ['CLINICIAN', 'ADMIN', 'SUPERVISOR', 'BILLING', 'OFFICE']
  tenantId: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName, specialty, roles, tenantId }: CreateStaffRequest = await req.json();

    // Validate required fields
    if (!email || !firstName || !lastName || !tenantId) {
      console.error("Missing required fields:", { email: !!email, firstName: !!firstName, lastName: !!lastName, tenantId: !!tenantId });
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, firstName, lastName, tenantId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!roles || roles.length === 0) {
      console.error("No roles provided");
      return new Response(
        JSON.stringify({ error: "At least one role must be selected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating staff account:", { email, firstName, lastName, specialty, roles, tenantId });

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
    console.log("Generated password for new user");

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
    // The handle_new_user trigger may have already created a profile with empty password
    // UPSERT ensures we update it with the correct password regardless of timing
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
    console.log("Created profile for user:", userId);

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
    console.log("Created tenant membership for user:", userId);

    // Step 6: Insert into user_roles (role = 'staff')
    const { error: userRoleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "staff",
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
    console.log("Created user_roles entry for user:", userId);

    // Step 7: Insert into staff table
    const staffData: Record<string, unknown> = {
      tenant_id: tenantId,
      profile_id: userId,
      prov_name_f: firstName,
      prov_name_l: lastName,
    };

    // Add specialty if provided (for clinical roles)
    if (specialty) {
      staffData.prov_field = specialty;
    }

    const { data: staffRecord, error: staffError } = await supabaseAdmin
      .from("staff")
      .insert(staffData)
      .select("id")
      .single();

    if (staffError || !staffRecord) {
      console.error("Failed to create staff record:", staffError);
      // Rollback
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("tenant_memberships").delete().eq("profile_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Failed to create staff record: ${staffError?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const staffId = staffRecord.id;
    console.log("Created staff record:", staffId);

    // Step 8: Fetch staff_role IDs for selected roles
    const { data: staffRoles, error: rolesError } = await supabaseAdmin
      .from("staff_roles")
      .select("id, code")
      .in("code", roles);

    if (rolesError) {
      console.error("Failed to fetch staff roles:", rolesError);
      // Rollback
      await supabaseAdmin.from("staff").delete().eq("id", staffId);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("tenant_memberships").delete().eq("profile_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Failed to fetch staff roles: ${rolesError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found staff roles:", staffRoles);

    // Step 9: Insert staff_role_assignments for each selected role
    if (staffRoles && staffRoles.length > 0) {
      const roleAssignments = staffRoles.map((role) => ({
        tenant_id: tenantId,
        staff_id: staffId,
        staff_role_id: role.id,
      }));

      const { error: assignmentError } = await supabaseAdmin
        .from("staff_role_assignments")
        .insert(roleAssignments);

      if (assignmentError) {
        console.error("Failed to create role assignments:", assignmentError);
        // Rollback
        await supabaseAdmin.from("staff").delete().eq("id", staffId);
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.from("tenant_memberships").delete().eq("profile_id", userId);
        await supabaseAdmin.from("profiles").delete().eq("id", userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(
          JSON.stringify({ error: `Failed to create role assignments: ${assignmentError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("Created role assignments:", roleAssignments.length);
    }

    // Success!
    console.log("Successfully created staff account:", { userId, staffId, email });
    
    return new Response(
      JSON.stringify({
        success: true,
        userId,
        staffId,
        password,
        message: "Staff account created successfully",
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
