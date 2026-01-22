import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  templateId: string;
  responseData: Record<string, any>;
  customerId?: string;
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

    const { templateId, responseData, customerId } = await req.json() as RequestBody;

    console.log(`Submitting form response for template: ${templateId}`);

    // Get user if authenticated
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    // Verify template exists and get its type
    const { data: template, error: templateError } = await supabaseClient
      .from('form_templates')
      .select('form_type, tenant_id')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      console.error('Template not found:', templateError);
      return new Response(
        JSON.stringify({ error: 'Form template not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate required fields
    const { data: fields, error: fieldsError } = await supabaseClient
      .from('form_template_fields')
      .select('field_key, is_required, label')
      .eq('form_template_id', templateId);

    if (fieldsError) {
      console.error('Error fetching fields:', fieldsError);
      return new Response(
        JSON.stringify({ error: 'Error validating form' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check required fields
    const missingFields: string[] = [];
    fields?.forEach(field => {
      if (field.is_required && !responseData[field.field_key]) {
        missingFields.push(field.label);
      }
    });

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          missingFields,
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Insert form response
    const { data: response, error: insertError } = await supabaseClient
      .from('form_responses')
      .insert({
        form_template_id: templateId,
        customer_id: customerId,
        submitted_by_user_id: user?.id,
        response_data: responseData,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting form response:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // If this is a signup form, update the customer profile
    if (template.form_type === 'signup' && customerId) {
      const updateData: Record<string, any> = {
        profile_completed: true,
      };

      // Map common fields to customer table columns
      if (responseData.preferred_name) updateData.preferred_name = responseData.preferred_name;
      if (responseData.gender) updateData.gender = responseData.gender;
      if (responseData.gender_identity) updateData.gender_identity = responseData.gender_identity;
      if (responseData.date_of_birth) updateData.date_of_birth = responseData.date_of_birth;
      if (responseData.phone) updateData.phone = responseData.phone;
      if (responseData.email) updateData.email = responseData.email;
      if (responseData.street_address) updateData.street_address = responseData.street_address;
      if (responseData.city) updateData.city = responseData.city;
      if (responseData.state) updateData.state = responseData.state;
      if (responseData.zip_code) updateData.zip_code = responseData.zip_code;
      if (responseData.timezone) updateData.timezone = responseData.timezone;

      const { error: updateError } = await supabaseClient
        .from('customers')
        .update(updateData)
        .eq('id', customerId);

      if (updateError) {
        console.error('Error updating customer profile:', updateError);
        // Don't fail the response submission if profile update fails
      } else {
        console.log('Customer profile updated successfully');
      }
    }

    console.log(`Form response submitted successfully: ${response.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        responseId: response.id,
        message: 'Form submitted successfully',
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
