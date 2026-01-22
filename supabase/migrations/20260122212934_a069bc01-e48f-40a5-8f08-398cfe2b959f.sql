-- Insert sample custom form template for testing
INSERT INTO form_templates (tenant_id, form_type, name, description, is_active, version)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'custom',
  'Client Satisfaction Survey',
  'A brief survey to gather feedback about our services and your care experience.',
  true,
  1
);

-- Insert sample form fields for the template
INSERT INTO form_template_fields (form_template_id, field_type, field_key, label, placeholder, help_text, is_required, order_index, options)
SELECT 
  id,
  'select',
  'overall_satisfaction',
  'Overall, how satisfied are you with our services?',
  'Select your rating',
  'Please rate your overall experience.',
  true,
  1,
  '[{"label": "Very Satisfied", "value": "very_satisfied"}, {"label": "Satisfied", "value": "satisfied"}, {"label": "Neutral", "value": "neutral"}, {"label": "Dissatisfied", "value": "dissatisfied"}, {"label": "Very Dissatisfied", "value": "very_dissatisfied"}]'::jsonb
FROM form_templates WHERE name = 'Client Satisfaction Survey' LIMIT 1;

INSERT INTO form_template_fields (form_template_id, field_type, field_key, label, placeholder, help_text, is_required, order_index)
SELECT 
  id,
  'textarea',
  'feedback_comments',
  'Do you have any additional comments or suggestions?',
  'Share your thoughts...',
  'Your feedback helps us improve our services.',
  false,
  2
FROM form_templates WHERE name = 'Client Satisfaction Survey' LIMIT 1;

INSERT INTO form_template_fields (form_template_id, field_type, field_key, label, placeholder, is_required, order_index, options)
SELECT 
  id,
  'radio',
  'would_recommend',
  'Would you recommend our services to others?',
  NULL,
  true,
  3,
  '[{"label": "Yes, definitely", "value": "yes_definitely"}, {"label": "Yes, probably", "value": "yes_probably"}, {"label": "Not sure", "value": "not_sure"}, {"label": "Probably not", "value": "probably_not"}, {"label": "Definitely not", "value": "definitely_not"}]'::jsonb
FROM form_templates WHERE name = 'Client Satisfaction Survey' LIMIT 1;