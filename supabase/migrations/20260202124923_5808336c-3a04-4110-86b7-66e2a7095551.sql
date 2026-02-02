-- Repair orphaned user: info+dummy@valorwell.org
-- User ID: 990c998a-3cc7-4445-99eb-b2d03a4e7f9b
-- Tenant ID: 00000000-0000-0000-0000-000000000001 (ValorWell)

-- 1. Create tenant membership
INSERT INTO tenant_memberships (tenant_id, profile_id, tenant_role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '990c998a-3cc7-4445-99eb-b2d03a4e7f9b',
  'member'
)
ON CONFLICT (tenant_id, profile_id) DO NOTHING;

-- 2. Create user role (staff)
INSERT INTO user_roles (user_id, role)
VALUES (
  '990c998a-3cc7-4445-99eb-b2d03a4e7f9b',
  'staff'
)
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Create staff record with 'Invited' status
INSERT INTO staff (tenant_id, profile_id, prov_name_f, prov_name_l, prov_status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '990c998a-3cc7-4445-99eb-b2d03a4e7f9b',
  'Dummy',
  'User',
  'Invited'
)
ON CONFLICT (profile_id, tenant_id) DO NOTHING;