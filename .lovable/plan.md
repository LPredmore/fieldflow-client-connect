

# Fix AI Clinical Note Output Format

## Problem
The AI-generated narrative includes metadata fields (Date, Client ID, Clinician, Session Number, "End of Narrative" marker, "Next Steps" section) that don't belong in the session narrative field. The output should be **only** the clinical narrative paragraphs -- as if written directly by the clinician.

## Change

**File:** `supabase/functions/generate-clinical-note/index.ts`

Update the `userPrompt` to explicitly instruct the model to output only the narrative body, with no headers, metadata, labels, or sign-off markers.

Add these rules to the prompt:
- Output ONLY the narrative paragraphs -- no title, no headers, no metadata
- Do NOT include Date, Client ID, Clinician Name, or Session Number
- Do NOT include "Clinical Session Narrative:" or "[End of Narrative]" markers
- Do NOT include a "Next Steps" section (that information is captured in other fields of the session note)
- Write in first-person clinical voice as if the clinician is documenting directly

No database changes. No frontend changes. Single file edit, prompt-only update.

## Technical Detail

The key change is adding explicit negative instructions to the prompt string in `index.ts` (around line 42-57) so the LLM stops generating the wrapper metadata. The existing edge function structure, error handling, and API call remain unchanged.

