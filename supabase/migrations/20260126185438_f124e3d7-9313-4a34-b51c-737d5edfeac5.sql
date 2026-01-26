-- Enable RLS on payroll_recipients
ALTER TABLE payroll_recipients ENABLE ROW LEVEL SECURITY;

-- Staff can view/manage their own payroll recipient record
CREATE POLICY "Staff can manage own payroll recipient"
ON payroll_recipients FOR ALL
USING (
  staff_id IN (
    SELECT id FROM staff WHERE profile_id = auth.uid()
  )
)
WITH CHECK (
  staff_id IN (
    SELECT id FROM staff WHERE profile_id = auth.uid()
  )
);

-- Admins can view all tenant payroll recipients (for billing portal)
CREATE POLICY "Admins can view tenant payroll recipients"
ON payroll_recipients FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM tenant_memberships 
    WHERE profile_id = auth.uid()
  )
  AND has_role(auth.uid(), 'admin'::app_role)
);