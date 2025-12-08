import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateRandomPassword(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

interface CreateBulkClientRequest {
  emails: string[];
  tenantId: string;
}

interface CreatedAccount {
  uuid: string;
  email: string;
  password: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emails, tenantId } = await req.json() as CreateBulkClientRequest;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return new Response(
        JSON.stringify({ error: 'emails array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'tenantId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const createdAccounts: CreatedAccount[] = [];
    const errors: { email: string; error: string }[] = [];

    for (const email of emails) {
      const trimmedEmail = email.trim().toLowerCase();
      
      try {
        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          u => u.email?.toLowerCase() === trimmedEmail
        );

        if (existingUser) {
          errors.push({ email: trimmedEmail, error: 'User already exists' });
          continue;
        }

        // Generate random password
        const password = generateRandomPassword(12);

        // Create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: trimmedEmail,
          password: password,
          email_confirm: true,
        });

        if (authError || !authData.user) {
          errors.push({ email: trimmedEmail, error: authError?.message || 'Failed to create auth user' });
          continue;
        }

        const userId = authData.user.id;

        // Create profile entry with plain-text password
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: userId,
            email: trimmedEmail,
            password: password,
            email_verified: true,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (profileError) {
          console.error(`Profile error for ${trimmedEmail}:`, profileError);
          // Continue anyway, profile might already exist from trigger
        }

        // Create tenant membership
        const { error: membershipError } = await supabaseAdmin
          .from('tenant_memberships')
          .insert({
            tenant_id: tenantId,
            profile_id: userId,
            tenant_role: 'member',
            created_at: new Date().toISOString(),
          });

        if (membershipError) {
          console.error(`Membership error for ${trimmedEmail}:`, membershipError);
        }

        // Create user_roles entry with 'client' role
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'client',
            created_at: new Date().toISOString(),
          });

        if (roleError) {
          console.error(`Role error for ${trimmedEmail}:`, roleError);
        }

        createdAccounts.push({
          uuid: userId,
          email: trimmedEmail,
          password: password,
        });

        console.log(`Created account for: ${trimmedEmail}`);

      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error creating account for ${email}:`, err);
        errors.push({ email, error: errorMessage });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        created: createdAccounts,
        errors: errors,
        summary: {
          total: emails.length,
          created: createdAccounts.length,
          failed: errors.length,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Bulk account creation error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
