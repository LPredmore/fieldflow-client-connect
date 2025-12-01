-- Phase 6: Mark deprecated columns in clinicians table
-- These columns are maintained by sync triggers but should NOT be used for authorization
-- Target removal: v3.0.0 (after 6+ months of deprecation)

COMMENT ON COLUMN public.clinicians.is_admin IS 
'DEPRECATED: Legacy field maintained by sync trigger. DO NOT use for authorization. 
Use user_roles table instead via UnifiedRoleDetectionService.
Target removal: v3.0.0';

COMMENT ON COLUMN public.clinicians.is_clinician IS 
'DEPRECATED: Legacy field maintained by sync trigger. DO NOT use for authorization. 
Use user_roles table instead via UnifiedRoleDetectionService.
Target removal: v3.0.0';