-- Create RLS policies for profiles table
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Allow user creation during signup" 
ON public.profiles 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Create RLS policies for settings table  
CREATE POLICY "Users can view their tenant settings" 
ON public.settings 
FOR SELECT 
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Business admins can manage settings" 
ON public.settings 
FOR ALL 
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  ) AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'business_admin'
  )
);

-- Create RLS policies for customers table
CREATE POLICY "Tenant users can view customers" 
ON public.customers 
FOR SELECT 
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Clients can view their own customer record" 
ON public.customers 
FOR SELECT 
USING (client_user_id = auth.uid());

CREATE POLICY "Clients can update their own customer record" 
ON public.customers 
FOR UPDATE 
USING (client_user_id = auth.uid());

CREATE POLICY "Contractors can manage customers" 
ON public.customers 
FOR ALL 
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  ) AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('business_admin', 'contractor')
  )
);

-- Create RLS policies for services table
CREATE POLICY "Tenant users can view services" 
ON public.services 
FOR SELECT 
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Contractors can manage services" 
ON public.services 
FOR ALL 
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  ) AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('business_admin', 'contractor')
  )
);

-- Create RLS policies for job_series table
CREATE POLICY "Tenant users can view job series" 
ON public.job_series 
FOR SELECT 
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Clients can view their own job series" 
ON public.job_series 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.customers 
    WHERE customers.id = job_series.customer_id 
    AND customers.client_user_id = auth.uid()
  )
);

CREATE POLICY "Contractors can manage job series" 
ON public.job_series 
FOR ALL 
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  ) AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('business_admin', 'contractor')
  )
);

-- Create RLS policies for job_occurrences table
CREATE POLICY "Tenant users can view job occurrences" 
ON public.job_occurrences 
FOR SELECT 
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Clients can view their own job occurrences" 
ON public.job_occurrences 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.customers 
    WHERE customers.id = job_occurrences.customer_id 
    AND customers.client_user_id = auth.uid()
  )
);

CREATE POLICY "Contractors can manage job occurrences" 
ON public.job_occurrences 
FOR ALL 
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  ) AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('business_admin', 'contractor')
  )
);

-- Create RLS policies for quotes table
CREATE POLICY "Tenant users can view quotes" 
ON public.quotes 
FOR SELECT 
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Clients can view their own quotes" 
ON public.quotes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.customers 
    WHERE customers.id = quotes.customer_id 
    AND customers.client_user_id = auth.uid()
  )
);

CREATE POLICY "Contractors can manage quotes" 
ON public.quotes 
FOR ALL 
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  ) AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('business_admin', 'contractor')
  )
);

-- Create RLS policies for invoices table
CREATE POLICY "Tenant users can view invoices" 
ON public.invoices 
FOR SELECT 
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Clients can view their own invoices" 
ON public.invoices 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.customers 
    WHERE customers.id = invoices.customer_id 
    AND customers.client_user_id = auth.uid()
  )
);

CREATE POLICY "Contractors can manage invoices" 
ON public.invoices 
FOR ALL 
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  ) AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('business_admin', 'contractor')
  )
);

-- Create RLS policies for user_permissions table
CREATE POLICY "Users can view their own permissions" 
ON public.user_permissions 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Business admins can manage user permissions" 
ON public.user_permissions 
FOR ALL 
USING (
  tenant_id = (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  ) AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'business_admin'
  )
);

-- Fix function search paths
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    tenant_uuid UUID;
BEGIN
    SELECT tenant_id INTO tenant_uuid
    FROM public.profiles
    WHERE user_id = auth.uid();
    
    RETURN tenant_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Create trigger function for creating customer record when client signs up
CREATE OR REPLACE FUNCTION public.handle_client_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_meta JSONB;
    new_tenant_id UUID;
BEGIN
    user_meta := NEW.raw_user_meta_data;
    
    -- Only process if this is a client signup
    IF user_meta->>'user_type' = 'client' THEN
        -- Generate a new tenant ID for the client (they are their own tenant)
        new_tenant_id := gen_random_uuid();
        
        -- Insert into profiles
        INSERT INTO public.profiles (
            user_id, 
            tenant_id, 
            role, 
            full_name, 
            phone, 
            email,
            company_name
        ) VALUES (
            NEW.id,
            new_tenant_id,
            'client',
            user_meta->>'full_name',
            user_meta->>'phone',
            NEW.email,
            user_meta->>'company_name'
        );
        
        -- Insert into customers (client becomes their own customer record)
        INSERT INTO public.customers (
            tenant_id,
            client_user_id,
            name,
            customer_type,
            phone,
            email
        ) VALUES (
            new_tenant_id,
            NEW.id,
            user_meta->>'full_name',
            'residential', -- default for client signups
            user_meta->>'phone',
            NEW.email
        );
        
    ELSIF user_meta->>'user_type' = 'contractor' THEN
        -- Generate a new tenant ID for contractors (they create their own business)
        new_tenant_id := gen_random_uuid();
        
        -- Insert into profiles for contractor
        INSERT INTO public.profiles (
            user_id, 
            tenant_id, 
            role, 
            full_name, 
            phone, 
            email,
            company_name
        ) VALUES (
            NEW.id,
            new_tenant_id,
            'business_admin', -- contractors start as business admins
            user_meta->>'full_name',
            user_meta->>'phone',
            NEW.email,
            user_meta->>'company_name'
        );
        
        -- Create initial settings for the business
        INSERT INTO public.settings (
            tenant_id,
            created_by_user_id,
            business_name,
            business_email
        ) VALUES (
            new_tenant_id,
            NEW.id,
            user_meta->>'company_name',
            NEW.email
        );
        
        -- Create initial permissions for the business admin
        INSERT INTO public.user_permissions (
            tenant_id,
            user_id,
            access_jobs,
            access_customers,
            access_services,
            access_quotes,
            access_invoicing,
            access_calendar,
            access_settings,
            access_user_management
        ) VALUES (
            new_tenant_id,
            NEW.id,
            true, true, true, true, true, true, true, true
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for handling new user signups
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_client_signup();