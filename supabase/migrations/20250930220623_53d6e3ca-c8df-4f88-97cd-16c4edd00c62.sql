-- Create form_assignments table
CREATE TABLE public.form_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  form_template_id UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  assigned_by_user_id UUID NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
  completed_at TIMESTAMP WITH TIME ZONE,
  notify_customer BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.form_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for form_assignments
CREATE POLICY "Contractors can manage form assignments"
ON public.form_assignments
FOR ALL
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('business_admin', 'contractor')
  )
);

CREATE POLICY "Clients can view their assigned forms"
ON public.form_assignments
FOR SELECT
USING (
  customer_id IN (
    SELECT id FROM customers WHERE client_user_id = auth.uid()
  )
);

CREATE POLICY "Clients can update their assigned forms status"
ON public.form_assignments
FOR UPDATE
USING (
  customer_id IN (
    SELECT id FROM customers WHERE client_user_id = auth.uid()
  )
)
WITH CHECK (
  customer_id IN (
    SELECT id FROM customers WHERE client_user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_form_assignments_updated_at
BEFORE UPDATE ON public.form_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();