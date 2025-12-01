import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FormField {
  id?: string;
  field_type: string;
  field_key: string;
  label: string;
  placeholder?: string;
  help_text?: string;
  is_required: boolean;
  order_index: number;
  validation_rules?: any;
  options?: any;
  conditional_logic?: any;
}

interface FormTemplate {
  id?: string;
  tenant_id: string;
  form_type: 'signup' | 'intake' | 'session_notes';
  name: string;
  description?: string;
  is_active: boolean;
}

interface RequestBody {
  template: FormTemplate;
  fields: FormField[];
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

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { template, fields } = await req.json() as RequestBody;

    console.log(`Saving form template: type=${template.form_type}, name=${template.name}`);

    let templateId = template.id;

    // If activating this template, deactivate other active templates of the same type
    if (template.is_active) {
      const { error: deactivateError } = await supabaseClient
        .from('form_templates')
        .update({ is_active: false })
        .eq('tenant_id', template.tenant_id)
        .eq('form_type', template.form_type)
        .eq('is_active', true);

      if (deactivateError) {
        console.error('Error deactivating other templates:', deactivateError);
      }
    }

    if (templateId) {
      // Update existing template
      const { data: updatedTemplate, error: updateError } = await supabaseClient
        .from('form_templates')
        .update({
          name: template.name,
          description: template.description,
          is_active: template.is_active,
          version: template.is_active ? (template as any).version + 1 : (template as any).version,
        })
        .eq('id', templateId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating template:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Delete existing fields
      await supabaseClient
        .from('form_fields')
        .delete()
        .eq('form_template_id', templateId);

    } else {
      // Create new template
      const { data: newTemplate, error: createError } = await supabaseClient
        .from('form_templates')
        .insert({
          tenant_id: template.tenant_id,
          form_type: template.form_type,
          name: template.name,
          description: template.description,
          is_active: template.is_active,
          version: 1,
          created_by_user_id: user.id,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating template:', createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      templateId = newTemplate.id;
    }

    // Insert new fields
    if (fields.length > 0) {
      const fieldsToInsert = fields.map(field => ({
        form_template_id: templateId,
        field_type: field.field_type,
        field_key: field.field_key,
        label: field.label,
        placeholder: field.placeholder,
        help_text: field.help_text,
        is_required: field.is_required,
        order_index: field.order_index,
        validation_rules: field.validation_rules || {},
        options: field.options,
        conditional_logic: field.conditional_logic,
      }));

      const { error: fieldsError } = await supabaseClient
        .from('form_fields')
        .insert(fieldsToInsert);

      if (fieldsError) {
        console.error('Error inserting fields:', fieldsError);
        return new Response(
          JSON.stringify({ error: fieldsError.message }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    console.log(`Successfully saved template: ${templateId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        templateId,
        message: 'Form template saved successfully',
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
