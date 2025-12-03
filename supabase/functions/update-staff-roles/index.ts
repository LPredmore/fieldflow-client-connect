import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateStaffRolesRequest {
  staffId: string;
  tenantId: string;
  rolesToAdd: string[];    // Role codes to assign
  rolesToRemove: string[]; // Role codes to remove
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for bypassing RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Create client with user's token for verification
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } }
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error('[update-staff-roles] Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[update-staff-roles] User authenticated:', user.id);

    // Parse request body
    const body: UpdateStaffRolesRequest = await req.json();
    const { staffId, tenantId, rolesToAdd, rolesToRemove } = body;

    console.log('[update-staff-roles] Request:', { staffId, tenantId, rolesToAdd, rolesToRemove });

    // Validate required fields
    if (!staffId || !tenantId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing staffId or tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify staff exists and belongs to tenant
    const { data: staffRecord, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, profile_id, tenant_id')
      .eq('id', staffId)
      .eq('tenant_id', tenantId)
      .single();

    if (staffError || !staffRecord) {
      console.error('[update-staff-roles] Staff not found:', staffError);
      return new Response(
        JSON.stringify({ success: false, message: 'Staff member not found in this tenant' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get role IDs for codes we need to add/remove
    const allRoleCodes = [...new Set([...rolesToAdd, ...rolesToRemove])];
    
    if (allRoleCodes.length > 0) {
      const { data: roleRecords, error: rolesError } = await supabaseAdmin
        .from('staff_roles')
        .select('id, code')
        .in('code', allRoleCodes);

      if (rolesError) {
        console.error('[update-staff-roles] Error fetching roles:', rolesError);
        return new Response(
          JSON.stringify({ success: false, message: 'Error fetching role definitions' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const roleCodeToId = new Map(roleRecords?.map(r => [r.code, r.id]) || []);

      // Validate all role codes exist
      for (const code of allRoleCodes) {
        if (!roleCodeToId.has(code)) {
          return new Response(
            JSON.stringify({ success: false, message: `Unknown role code: ${code}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // SAFETY CHECK: Prevent removing the last ACCOUNT_OWNER
      if (rolesToRemove.includes('ACCOUNT_OWNER')) {
        const { data: ownerCount, error: countError } = await supabaseAdmin
          .from('staff_role_assignments')
          .select('id', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .eq('staff_role_id', roleCodeToId.get('ACCOUNT_OWNER'));

        if (!countError && ownerCount && ownerCount.length <= 1) {
          // Check if the one owner is this staff member
          const { data: currentOwnerAssignment } = await supabaseAdmin
            .from('staff_role_assignments')
            .select('staff_id')
            .eq('tenant_id', tenantId)
            .eq('staff_role_id', roleCodeToId.get('ACCOUNT_OWNER'))
            .single();

          if (currentOwnerAssignment?.staff_id === staffId) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                message: 'Cannot remove the last Account Owner from the organization' 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      // SAFETY CHECK: Prevent users from removing their own ACCOUNT_OWNER role
      if (rolesToRemove.includes('ACCOUNT_OWNER')) {
        // Get the current user's staff record
        const { data: currentUserStaff } = await supabaseAdmin
          .from('staff')
          .select('id')
          .eq('profile_id', user.id)
          .eq('tenant_id', tenantId)
          .single();

        if (currentUserStaff?.id === staffId) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: 'You cannot remove your own Account Owner role' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Remove roles
      if (rolesToRemove.length > 0) {
        const roleIdsToRemove = rolesToRemove
          .map(code => roleCodeToId.get(code))
          .filter(Boolean);

        if (roleIdsToRemove.length > 0) {
          const { error: deleteError } = await supabaseAdmin
            .from('staff_role_assignments')
            .delete()
            .eq('staff_id', staffId)
            .eq('tenant_id', tenantId)
            .in('staff_role_id', roleIdsToRemove);

          if (deleteError) {
            console.error('[update-staff-roles] Error removing roles:', deleteError);
            return new Response(
              JSON.stringify({ success: false, message: 'Error removing roles' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          console.log('[update-staff-roles] Removed roles:', rolesToRemove);
        }
      }

      // Add roles
      if (rolesToAdd.length > 0) {
        const assignmentsToInsert = rolesToAdd
          .map(code => ({
            staff_id: staffId,
            tenant_id: tenantId,
            staff_role_id: roleCodeToId.get(code),
          }))
          .filter(a => a.staff_role_id);

        if (assignmentsToInsert.length > 0) {
          // Use upsert to handle existing assignments gracefully
          const { error: insertError } = await supabaseAdmin
            .from('staff_role_assignments')
            .upsert(assignmentsToInsert, { 
              onConflict: 'staff_id,staff_role_id,tenant_id',
              ignoreDuplicates: true 
            });

          if (insertError) {
            console.error('[update-staff-roles] Error adding roles:', insertError);
            return new Response(
              JSON.stringify({ success: false, message: 'Error adding roles' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          console.log('[update-staff-roles] Added roles:', rolesToAdd);
        }
      }
    }

    // Fetch updated role assignments
    const { data: updatedAssignments, error: fetchError } = await supabaseAdmin
      .from('staff_role_assignments')
      .select('staff_roles(code)')
      .eq('staff_id', staffId)
      .eq('tenant_id', tenantId);

    if (fetchError) {
      console.error('[update-staff-roles] Error fetching updated roles:', fetchError);
    }

    const currentRoles = updatedAssignments?.map((a: any) => a.staff_roles?.code).filter(Boolean) || [];

    console.log('[update-staff-roles] Success. Current roles:', currentRoles);

    return new Response(
      JSON.stringify({ 
        success: true, 
        currentRoles,
        message: 'Roles updated successfully' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[update-staff-roles] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
