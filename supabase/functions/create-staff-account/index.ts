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

function generateDiagnosticId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `server-${timestamp}-${random}`;
}

interface CreateStaffRequest {
  email: string;
  firstName: string;
  lastName: string;
  specialty?: string;
  roles: string[];
  tenantId: string;
  diagnosticId?: string; // Optional: passed from client for correlation
}

interface StepResult {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

function logStep(
  diagId: string,
  step: number,
  stepName: string,
  phase: "START" | "COMPLETE" | "FAILED",
  details?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` | ${JSON.stringify(details)}` : "";
  console.log(`[DIAG:${diagId}] [${timestamp}] STEP ${step} ${phase}: ${stepName}${detailsStr}`);
}

Deno.serve(async (req: Request): Promise<Response> => {
  const startTime = Date.now();
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Generate or use provided diagnostic ID
  let diagnosticId = generateDiagnosticId();
  
  try {
    const body: CreateStaffRequest = await req.json();
    
    // Use client-provided diagnosticId if available for correlation
    if (body.diagnosticId) {
      diagnosticId = body.diagnosticId;
    }

    const { email, firstName, lastName, specialty, roles, tenantId } = body;

    logStep(diagnosticId, 0, "Request received", "START", {
      email,
      firstName,
      lastName,
      specialty,
      roles,
      tenantId,
      hasClientDiagnosticId: !!body.diagnosticId,
    });

    // Validate required fields
    if (!email || !firstName || !lastName || !tenantId) {
      logStep(diagnosticId, 0, "Validation", "FAILED", {
        missingFields: {
          email: !email,
          firstName: !firstName,
          lastName: !lastName,
          tenantId: !tenantId,
        },
      });
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields: email, firstName, lastName, tenantId",
          diagnosticId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!roles || roles.length === 0) {
      logStep(diagnosticId, 0, "Validation", "FAILED", { reason: "No roles provided" });
      return new Response(
        JSON.stringify({ 
          error: "At least one role must be selected",
          diagnosticId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep(diagnosticId, 0, "Validation", "COMPLETE", { valid: true });

    // Initialize Supabase Admin client
    logStep(diagnosticId, 1, "Initializing Supabase Admin client", "START");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    logStep(diagnosticId, 1, "Initializing Supabase Admin client", "COMPLETE");

    // Step 2: Check if user already exists
    logStep(diagnosticId, 2, "Checking if user exists", "START", { email });
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      logStep(diagnosticId, 2, "Checking if user exists", "FAILED", {
        error: listError.message,
      });
      return new Response(
        JSON.stringify({ 
          error: `Failed to check existing users: ${listError.message}`,
          diagnosticId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const existingUser = existingUsers?.users?.find((u) => u.email === email);
    
    if (existingUser) {
      logStep(diagnosticId, 2, "Checking if user exists", "FAILED", {
        reason: "User already exists",
        existingUserId: existingUser.id,
      });
      return new Response(
        JSON.stringify({ 
          error: "A user with this email already exists",
          diagnosticId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    logStep(diagnosticId, 2, "Checking if user exists", "COMPLETE", { userExists: false });

    // Step 3: Generate password
    logStep(diagnosticId, 3, "Generating password", "START");
    const password = generateRandomPassword(12);
    logStep(diagnosticId, 3, "Generating password", "COMPLETE", { passwordLength: password.length });

    // Step 4: Create auth user
    logStep(diagnosticId, 4, "Creating auth user", "START", { email });
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      logStep(diagnosticId, 4, "Creating auth user", "FAILED", {
        error: authError?.message,
        errorCode: authError?.code,
      });
      return new Response(
        JSON.stringify({ 
          error: `Failed to create user: ${authError?.message}`,
          diagnosticId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;
    logStep(diagnosticId, 4, "Creating auth user", "COMPLETE", { userId });

    // Step 5: UPSERT into profiles
    logStep(diagnosticId, 5, "Upserting profile", "START", { userId });
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
      logStep(diagnosticId, 5, "Upserting profile", "FAILED", {
        error: profileError.message,
        code: profileError.code,
        details: profileError.details,
      });
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ 
          error: `Failed to create profile: ${profileError.message}`,
          diagnosticId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    logStep(diagnosticId, 5, "Upserting profile", "COMPLETE", { userId });

    // Step 6: Insert into tenant_memberships
    logStep(diagnosticId, 6, "Creating tenant membership", "START", { tenantId, userId });
    const { error: membershipError } = await supabaseAdmin
      .from("tenant_memberships")
      .insert({
        tenant_id: tenantId,
        profile_id: userId,
        tenant_role: "member",
      });

    if (membershipError) {
      logStep(diagnosticId, 6, "Creating tenant membership", "FAILED", {
        error: membershipError.message,
        code: membershipError.code,
        details: membershipError.details,
      });
      // Rollback
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ 
          error: `Failed to create tenant membership: ${membershipError.message}`,
          diagnosticId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    logStep(diagnosticId, 6, "Creating tenant membership", "COMPLETE", { tenantId, userId });

    // Step 7: Insert into user_roles (role = 'staff')
    logStep(diagnosticId, 7, "Creating user_roles entry", "START", { userId, role: "staff" });
    const { error: userRoleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "staff",
      });

    if (userRoleError) {
      logStep(diagnosticId, 7, "Creating user_roles entry", "FAILED", {
        error: userRoleError.message,
        code: userRoleError.code,
        details: userRoleError.details,
      });
      // Rollback
      await supabaseAdmin.from("tenant_memberships").delete().eq("profile_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ 
          error: `Failed to create user role: ${userRoleError.message}`,
          diagnosticId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    logStep(diagnosticId, 7, "Creating user_roles entry", "COMPLETE", { userId });

    // Step 8: Insert into staff table
    logStep(diagnosticId, 8, "Creating staff record", "START", { tenantId, userId, firstName, lastName, specialty });
    const staffData: Record<string, unknown> = {
      tenant_id: tenantId,
      profile_id: userId,
      prov_name_f: firstName,
      prov_name_l: lastName,
      prov_status: 'Invited',
    };

    if (specialty) {
      staffData.prov_field = specialty;
    }

    const { data: staffRecord, error: staffError } = await supabaseAdmin
      .from("staff")
      .insert(staffData)
      .select("id")
      .single();

    if (staffError || !staffRecord) {
      logStep(diagnosticId, 8, "Creating staff record", "FAILED", {
        error: staffError?.message,
        code: staffError?.code,
        details: staffError?.details,
      });
      // Rollback
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("tenant_memberships").delete().eq("profile_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ 
          error: `Failed to create staff record: ${staffError?.message}`,
          diagnosticId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const staffId = staffRecord.id;
    logStep(diagnosticId, 8, "Creating staff record", "COMPLETE", { staffId });

    // Step 9: Fetch staff_role IDs for selected roles
    logStep(diagnosticId, 9, "Fetching staff roles", "START", { roleCodes: roles });
    const { data: staffRoles, error: rolesError } = await supabaseAdmin
      .from("staff_roles")
      .select("id, code")
      .in("code", roles);

    if (rolesError) {
      logStep(diagnosticId, 9, "Fetching staff roles", "FAILED", {
        error: rolesError.message,
        code: rolesError.code,
      });
      // Rollback
      await supabaseAdmin.from("staff").delete().eq("id", staffId);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("tenant_memberships").delete().eq("profile_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ 
          error: `Failed to fetch staff roles: ${rolesError.message}`,
          diagnosticId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep(diagnosticId, 9, "Fetching staff roles", "COMPLETE", {
      foundRoles: staffRoles?.map(r => r.code),
      requestedRoles: roles,
    });

    // Step 10: Insert staff_role_assignments for each selected role
    if (staffRoles && staffRoles.length > 0) {
      logStep(diagnosticId, 10, "Creating role assignments", "START", {
        staffId,
        roleCount: staffRoles.length,
      });

      const roleAssignments = staffRoles.map((role) => ({
        tenant_id: tenantId,
        staff_id: staffId,
        staff_role_id: role.id,
      }));

      const { error: assignmentError } = await supabaseAdmin
        .from("staff_role_assignments")
        .insert(roleAssignments);

      if (assignmentError) {
        logStep(diagnosticId, 10, "Creating role assignments", "FAILED", {
          error: assignmentError.message,
          code: assignmentError.code,
          details: assignmentError.details,
        });
        // Rollback
        await supabaseAdmin.from("staff").delete().eq("id", staffId);
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.from("tenant_memberships").delete().eq("profile_id", userId);
        await supabaseAdmin.from("profiles").delete().eq("id", userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(
          JSON.stringify({ 
            error: `Failed to create role assignments: ${assignmentError.message}`,
            diagnosticId,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      logStep(diagnosticId, 10, "Creating role assignments", "COMPLETE", {
        assignedRoles: staffRoles.map(r => r.code),
      });
    } else {
      logStep(diagnosticId, 10, "Creating role assignments", "COMPLETE", {
        note: "No matching staff roles found to assign",
        requestedRoles: roles,
      });
    }

    // Success!
    const totalDuration = Date.now() - startTime;
    logStep(diagnosticId, 11, "Staff creation complete", "COMPLETE", {
      userId,
      staffId,
      email,
      totalDurationMs: totalDuration,
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        userId,
        staffId,
        password,
        diagnosticId,
        message: "Staff account created successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const totalDuration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logStep(diagnosticId, -1, "Unexpected exception", "FAILED", {
      errorMessage,
      errorStack,
      totalDurationMs: totalDuration,
    });

    return new Response(
      JSON.stringify({ 
        error: `Unexpected error: ${errorMessage}`,
        diagnosticId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
