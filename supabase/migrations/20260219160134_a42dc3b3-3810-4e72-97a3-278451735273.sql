-- Fix existing tenant templates: set is_required = true for active customized consent templates
UPDATE consent_templates 
SET is_required = true 
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND is_active = true 
  AND is_required = false
  AND consent_type IN ('telehealth_informed_consent', 'financial_agreement');