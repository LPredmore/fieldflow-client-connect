import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CLAIM_MD_API_KEY = Deno.env.get('CLAIM.MD_API_KEY');
const CLAIM_MD_BASE_URL = 'https://api.claim.md/api/eligibility-check';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { customer_id, insurance_id, service_date, service_type } = await req.json();

    const { data: customer } = await supabaseClient
      .from('customers')
      .select('*')
      .eq('id', customer_id)
      .single();

    const { data: insurance } = await supabaseClient
      .from('insurance_information')
      .select('*')
      .eq('id', insurance_id)
      .single();

    const { data: settings } = await supabaseClient
      .from('settings')
      .select('billing_provider_npi')
      .single();

    if (!customer || !insurance) {
      return new Response(
        JSON.stringify({ error: 'Customer or insurance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mock response for now - integrate with Claim.MD API when credentials are available
    if (!CLAIM_MD_API_KEY) {
      console.log('Claim.MD API key not configured, returning mock data');
      const mockResponse = {
        status: 'active',
        coverage_details: {
          plan_name: insurance.payer_name || 'Mock Insurance Plan',
          effective_date: '2025-01-01',
          copay: 30,
          deductible: 1000,
          deductible_met: 250,
          out_of_pocket_max: 5000,
          out_of_pocket_met: 500,
        },
        benefits: [
          {
            service_type: 'Psychotherapy',
            coverage_level: '80%',
            authorization_required: false,
          },
        ],
        verified_at: new Date().toISOString(),
      };

      return new Response(JSON.stringify(mockResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Real Claim.MD integration
    const eligibilityRequest = {
      payerId: insurance.payerid,
      provider: {
        npi: settings?.billing_provider_npi || '1234567890',
      },
      subscriber: {
        memberId: insurance.ins_number,
        firstName: insurance.ins_name_f || customer.name_f,
        lastName: insurance.ins_name_l || customer.name_l,
        dateOfBirth: insurance.ins_dob || customer.date_of_birth,
      },
      dependent: customer.pat_rel !== '18' ? {
        firstName: customer.name_f,
        lastName: customer.name_l,
        dateOfBirth: customer.date_of_birth,
        relationship: customer.pat_rel,
      } : null,
      serviceDate: service_date || new Date().toISOString().split('T')[0],
      serviceType: service_type || '30',
    };

    const response = await fetch(CLAIM_MD_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLAIM_MD_API_KEY}`,
      },
      body: JSON.stringify(eligibilityRequest),
    });

    if (!response.ok) {
      throw new Error(`Claim.MD API error: ${response.statusText}`);
    }

    const eligibilityData = await response.json();

    const result = {
      status: eligibilityData.eligibilityStatus || 'pending',
      coverage_details: {
        plan_name: eligibilityData.planName,
        effective_date: eligibilityData.effectiveDate,
        termination_date: eligibilityData.terminationDate,
        copay: eligibilityData.copay,
        deductible: eligibilityData.deductible,
        deductible_met: eligibilityData.deductibleMet,
        out_of_pocket_max: eligibilityData.outOfPocketMax,
        out_of_pocket_met: eligibilityData.outOfPocketMet,
      },
      benefits: eligibilityData.benefits || [],
      verified_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Eligibility check error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        status: 'error',
        error_message: error.message,
        verified_at: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
