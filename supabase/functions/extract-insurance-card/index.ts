import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, cardSide = 'front' } = await req.json();

    if (!imageBase64) {
      throw new Error('No image data provided');
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Extracting insurance card data from ${cardSide} using Gemini vision...`);

    // Different prompts for front and back of card
    const promptText = cardSide === 'front' 
      ? "Extract insurance card information from the FRONT of this card. Look for: insurance company name (payer_name), policy number, group number, member/policy holder name (first, middle, last), date of birth, sex/gender, address (street, city, state, zip), phone number, employer name, plan name, and payer ID. Return all available information."
      : "Extract insurance card information from the BACK of this card. Look for: customer service phone numbers, claims submission information, provider contact numbers, payer ID, authorization phone numbers, plan details, and any additional contact information. Also look for any policy numbers or group numbers if visible. Return all available information.";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: promptText
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_insurance_info",
              description: "Extract structured insurance card information",
              parameters: {
                type: "object",
                properties: {
                  payer_name: { type: "string", description: "Insurance company name" },
                  policy_number: { type: "string", description: "Policy or member ID number" },
                  group_number: { type: "string", description: "Group number" },
                  payer_id: { type: "string", description: "Payer ID for electronic claims" },
                  insured_name_first: { type: "string", description: "Policy holder first name" },
                  insured_name_middle: { type: "string", description: "Policy holder middle name or initial" },
                  insured_name_last: { type: "string", description: "Policy holder last name" },
                  insured_dob: { type: "string", description: "Date of birth in YYYY-MM-DD format" },
                  insured_sex: { type: "string", description: "Sex/Gender - Use 'M' for male, 'F' for female, or 'Other'" },
                  insured_address_1: { type: "string", description: "Street address line 1" },
                  insured_address_2: { type: "string", description: "Street address line 2" },
                  insured_city: { type: "string", description: "City" },
                  insured_state: { type: "string", description: "Two-letter state code" },
                  insured_zip: { type: "string", description: "ZIP code" },
                  ins_phone: { type: "string", description: "Phone number (10 digits)" },
                  ins_employer: { type: "string", description: "Employer name" },
                  ins_plan: { type: "string", description: "Plan name or type" }
                },
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_insurance_info" } }
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable AI workspace." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${errorText}`);
    }

    const data = await response.json();
    console.log('AI response received:', JSON.stringify(data, null, 2));

    // Extract the function call arguments
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "extract_insurance_info") {
      throw new Error("Failed to extract insurance information from image");
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log('Extracted insurance data:', extractedData);

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error extracting insurance card:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to extract insurance card information' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
