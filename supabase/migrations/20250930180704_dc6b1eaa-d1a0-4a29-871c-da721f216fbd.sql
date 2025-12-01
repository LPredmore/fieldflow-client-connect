-- Comprehensive migration to rename "jobs" to "appointments" throughout the database

-- Step 1: Rename the main tables
ALTER TABLE job_series RENAME TO appointment_series;
ALTER TABLE job_occurrences RENAME TO appointment_occurrences;

-- Step 2: Rename the column in invoices table
ALTER TABLE invoices RENAME COLUMN job_id TO appointment_id;

-- Step 3: Update RLS policies for appointment_series
DROP POLICY IF EXISTS "Clients can view their own job series" ON appointment_series;
DROP POLICY IF EXISTS "Contractors can manage job series" ON appointment_series;
DROP POLICY IF EXISTS "Tenant users can view job series" ON appointment_series;

CREATE POLICY "Clients can view their own appointment series" 
ON appointment_series FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM customers 
    WHERE customers.id = appointment_series.customer_id 
    AND customers.client_user_id = auth.uid()
  )
);

CREATE POLICY "Contractors can manage appointment series" 
ON appointment_series FOR ALL 
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('business_admin', 'contractor')
  )
);

CREATE POLICY "Tenant users can view appointment series" 
ON appointment_series FOR SELECT 
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
);

-- Step 4: Update RLS policies for appointment_occurrences
DROP POLICY IF EXISTS "Clients can view their own job occurrences" ON appointment_occurrences;
DROP POLICY IF EXISTS "Contractors can manage job occurrences" ON appointment_occurrences;
DROP POLICY IF EXISTS "Tenant users can view job occurrences" ON appointment_occurrences;

CREATE POLICY "Clients can view their own appointment occurrences" 
ON appointment_occurrences FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM customers 
    WHERE customers.id = appointment_occurrences.customer_id 
    AND customers.client_user_id = auth.uid()
  )
);

CREATE POLICY "Contractors can manage appointment occurrences" 
ON appointment_occurrences FOR ALL 
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('business_admin', 'contractor')
  )
);

CREATE POLICY "Tenant users can view appointment occurrences" 
ON appointment_occurrences FOR SELECT 
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
);

-- Step 5: Update indexes (they are automatically renamed with the table, but let's be explicit)
-- PostgreSQL automatically renames indexes when tables are renamed

-- Step 6: Update any triggers
-- The triggers on updated_at columns should automatically work with renamed tables

-- Step 7: Add comments for clarity
COMMENT ON TABLE appointment_series IS 'Stores appointment series (recurring and one-time appointments)';
COMMENT ON TABLE appointment_occurrences IS 'Stores individual appointment occurrences generated from appointment series';