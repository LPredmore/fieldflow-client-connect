import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    
    if (!OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { currentSymptoms, sessionNarrative, selectedInterventions } = await req.json();

    // Validate that we have at least some content to work with
    if (!sessionNarrative?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Session narrative is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an expert clinical documentation assistant. Generate professional, clinical session narratives that are appropriate for mental health documentation while maintaining uniqueness and avoiding repetitive language.`;

    const userPrompt = `You are a licensed clinical mental health professional tasked with transforming informal session notes into clinically appropriate documentation. 

Please rewrite the following session information into a professional, clinical narrative that:
- Uses appropriate clinical terminology
- Maintains professional tone and objectivity
- Incorporates the interventions used naturally into the narrative
- References symptoms in a clinical context
- Avoids repetitive language while being thorough
- Follows standard clinical documentation practices
- Does not include specific quotes or overly detailed personal information
- Maintains HIPAA compliance

CRITICAL OUTPUT RULES:
- Output ONLY the narrative paragraphs. No title, no headers, no metadata.
- Do NOT include Date, Client ID, Clinician Name, or Session Number.
- Do NOT include labels like "Clinical Session Narrative:" or markers like "[End of Narrative]".
- Do NOT include a "Next Steps" section — that information is captured elsewhere.
- Write in first-person clinical voice as if the clinician is documenting directly into the session narrative field.
- Start immediately with the narrative content. No preamble.

Session Information:
- Current Symptoms: ${currentSymptoms || 'None specified'}
- Informal Session Notes: ${sessionNarrative || 'None provided'}
- Interventions Used: ${selectedInterventions?.join(', ') || 'None specified'}

Provide the clinical narrative now:`;

    console.log('Calling OpenRouter API with gpt-4o-mini...');

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
        'X-Title': 'Clinical Note Generator',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to generate clinical note' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const generatedNarrative = data.choices?.[0]?.message?.content;

    if (!generatedNarrative) {
      console.error('No content in OpenRouter response:', data);
      return new Response(
        JSON.stringify({ error: 'No content generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully generated clinical note');

    return new Response(
      JSON.stringify({ generatedNarrative }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in generate-clinical-note function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
