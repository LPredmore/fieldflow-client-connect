
-- Create messages table for HIPAA-compliant client-staff messaging
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  staff_id uuid NOT NULL REFERENCES public.staff(id),
  sender_type text NOT NULL CHECK (sender_type IN ('client', 'staff')),
  sender_id uuid NOT NULL,
  body text NOT NULL,
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_messages_thread ON public.messages (client_id, staff_id, created_at DESC);
CREATE INDEX idx_messages_staff_unread ON public.messages (staff_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_messages_client_unread ON public.messages (client_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_messages_tenant ON public.messages (tenant_id);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy 1: Staff can read messages for their tenant
CREATE POLICY "Staff can read tenant messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.profile_id = auth.uid()
  )
);

-- Policy 2: Clients can read their own messages
CREATE POLICY "Clients can read own messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT c.id FROM public.clients c WHERE c.profile_id = auth.uid()
  )
);

-- Policy 3: Staff can send messages
CREATE POLICY "Staff can send messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'staff'
  AND sender_id = auth.uid()
  AND tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.profile_id = auth.uid()
  )
);

-- Policy 4: Clients can send messages
CREATE POLICY "Clients can send messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'client'
  AND sender_id = auth.uid()
  AND client_id IN (
    SELECT c.id FROM public.clients c WHERE c.profile_id = auth.uid()
  )
);

-- Policy 5: Recipients can mark messages as read (UPDATE read_at only)
-- Staff marking client messages as read
CREATE POLICY "Staff can mark messages as read"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  sender_type = 'client'
  AND staff_id IN (
    SELECT s.id FROM public.staff s WHERE s.profile_id = auth.uid()
  )
)
WITH CHECK (
  sender_type = 'client'
  AND staff_id IN (
    SELECT s.id FROM public.staff s WHERE s.profile_id = auth.uid()
  )
);

-- Clients marking staff messages as read
CREATE POLICY "Clients can mark messages as read"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  sender_type = 'staff'
  AND client_id IN (
    SELECT c.id FROM public.clients c WHERE c.profile_id = auth.uid()
  )
)
WITH CHECK (
  sender_type = 'staff'
  AND client_id IN (
    SELECT c.id FROM public.clients c WHERE c.profile_id = auth.uid()
  )
);

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
