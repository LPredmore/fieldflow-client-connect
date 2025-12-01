import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  formType: 'signup' | 'intake' | 'session_notes';
  tenantId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { formType, tenantId } = await req.json() as RequestBody;

    console.log(`Fetching form template: type=${formType}, tenantId=${tenantId}`);

    // Build query
    let query = supabaseClient
      .from('form_templates')
      .select(`
        *,
        form_fields (*)
      `)
      .eq('form_type', formType)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    // Add tenant filter if provided
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Error fetching form template:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!data) {
      console.log('No active form template found');
      return new Response(
        JSON.stringify({ template: null, fields: [] }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Sort fields by order_index
    const sortedFields = data.form_fields?.sort((a: any, b: any) => a.order_index - b.order_index) || [];

    console.log(`Found template: ${data.id} with ${sortedFields.length} fields`);

    return new Response(
      JSON.stringify({
        template: {
          id: data.id,
          tenant_id: data.tenant_id,
          form_type: data.form_type,
          name: data.name,
          description: data.description,
          is_active: data.is_active,
          version: data.version,
        },
        fields: sortedFields,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
