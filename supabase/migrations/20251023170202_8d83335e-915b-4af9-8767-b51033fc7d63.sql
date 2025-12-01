-- Drop CMS-1500 tables and all dependencies
-- Tables are dropped in reverse dependency order

-- Drop dependent tables first (CASCADE will handle foreign keys)
DROP TABLE IF EXISTS public.cms_1500_remittances CASCADE;
DROP TABLE IF EXISTS public.cms_1500_status_history CASCADE;
DROP TABLE IF EXISTS public.cms_1500_attachments CASCADE;
DROP TABLE IF EXISTS public.cms_1500_service_lines CASCADE;

-- Drop main table
DROP TABLE IF EXISTS public.cms_1500_claims CASCADE;