-- Allow clients to insert their own insurance records
CREATE POLICY "Clients can insert their own insurance"
ON insurance_information
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id IN (
    SELECT id FROM customers 
    WHERE client_user_id = auth.uid()
  )
);

-- Allow clients to update their own insurance records
CREATE POLICY "Clients can update their own insurance"
ON insurance_information
FOR UPDATE
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers 
    WHERE client_user_id = auth.uid()
  )
)
WITH CHECK (
  customer_id IN (
    SELECT id FROM customers 
    WHERE client_user_id = auth.uid()
  )
);