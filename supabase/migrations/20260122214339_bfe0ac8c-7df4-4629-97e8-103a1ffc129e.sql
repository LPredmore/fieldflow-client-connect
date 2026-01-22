-- Phase 1-2: Add is_required/required_for columns and seed missing consent templates

-- Step 1: Add new columns to consent_templates
ALTER TABLE consent_templates 
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false;

ALTER TABLE consent_templates 
ADD COLUMN IF NOT EXISTS required_for TEXT DEFAULT NULL;

-- Step 2: Seed missing consent templates (hipaa_notice and financial_agreement)
INSERT INTO consent_templates (tenant_id, consent_type, title, content, version, is_active, is_required, required_for)
VALUES 
  (NULL, 'hipaa_notice', 'HIPAA Notice of Privacy Practices', 
   '{"sections": [
     {"id": "intro", "type": "text", "title": "Notice of Privacy Practices", "content": "This notice describes how medical information about you may be used and disclosed and how you can get access to this information. Please review it carefully."},
     {"id": "uses", "type": "text", "title": "How We Use Your Information", "content": "We may use and disclose your protected health information for treatment, payment, and healthcare operations purposes with your consent."},
     {"id": "rights", "type": "text", "title": "Your Rights", "content": "You have the right to request restrictions on certain uses and disclosures of your information, request amendments to your health information, and obtain an accounting of disclosures."},
     {"id": "ack_received", "type": "acknowledgment", "content": "I acknowledge that I have received the Notice of Privacy Practices.", "required": true},
     {"id": "signature", "type": "signature_block", "content": "By signing below, I acknowledge receipt of the HIPAA Notice of Privacy Practices.", "required": true}
   ]}'::jsonb, 1, true, true, NULL),
  
  (NULL, 'financial_agreement', 'Financial Agreement',
   '{"sections": [
     {"id": "intro", "type": "text", "title": "Financial Responsibility", "content": "This agreement outlines the financial policies and your responsibility for payment of services rendered."},
     {"id": "payment_terms", "type": "text", "title": "Payment Terms", "content": "Payment is due at the time of service unless other arrangements have been made. We accept cash, checks, and major credit cards."},
     {"id": "insurance", "type": "text", "title": "Insurance", "content": "If you have insurance, we will bill your insurance company as a courtesy. However, you are ultimately responsible for all charges not covered by your insurance."},
     {"id": "ack_payment", "type": "acknowledgment", "content": "I understand that I am financially responsible for all charges not covered by my insurance.", "required": true},
     {"id": "ack_cancellation", "type": "acknowledgment", "content": "I understand that missed appointments or cancellations with less than 24 hours notice may result in a fee.", "required": true},
     {"id": "signature", "type": "signature_block", "content": "By signing below, I agree to the financial terms described above.", "required": true}
   ]}'::jsonb, 1, true, true, NULL);

-- Step 3: Mark existing system default consents as required
UPDATE consent_templates 
SET is_required = true, required_for = NULL 
WHERE tenant_id IS NULL AND consent_type = 'treatment_consent';

UPDATE consent_templates 
SET is_required = true, required_for = 'telehealth'
WHERE tenant_id IS NULL AND consent_type = 'telehealth_informed_consent';