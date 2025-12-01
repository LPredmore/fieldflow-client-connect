-- Migration: Add audit logging for clinician status changes
-- This migration creates the audit_logs table and related functions for
-- tracking all status changes and routing decisions

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN (
        'route_decision', 
        'status_change', 
        'registration_complete', 
        'access_denied',
        'login_redirect',
        'initialization'
    )),
    details JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    ip_address INET,
    user_agent TEXT,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON public.audit_logs(performed_by);

-- Add RLS policies for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own audit logs
CREATE POLICY "Users can read own audit logs" ON public.audit_logs
    FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.uid() = performed_by
    );

-- Policy: System can insert audit logs (for service accounts)
CREATE POLICY "System can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (true);

-- Policy: Admins can read all audit logs in their tenant
CREATE POLICY "Admins can read tenant audit logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_permissions up
            WHERE up.user_id = auth.uid()
            AND up.tenant_id = audit_logs.tenant_id
            AND up.supervisor = true
        )
    );

-- Function to insert audit log entries
CREATE OR REPLACE FUNCTION public.insert_audit_log(
    p_user_id UUID,
    p_action TEXT,
    p_details JSONB DEFAULT '{}',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_performed_by UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    audit_id UUID;
    user_tenant_id UUID;
BEGIN
    -- Get the user's tenant_id
    SELECT tenant_id INTO user_tenant_id
    FROM public.profiles
    WHERE user_id = p_user_id
    LIMIT 1;
    
    -- Insert the audit log entry
    INSERT INTO public.audit_logs (
        user_id,
        tenant_id,
        action,
        details,
        ip_address,
        user_agent,
        performed_by
    ) VALUES (
        p_user_id,
        user_tenant_id,
        p_action,
        p_details,
        p_ip_address,
        p_user_agent,
        COALESCE(p_performed_by, auth.uid())
    ) RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$function$;

-- Function to log status changes with rollback capability
CREATE OR REPLACE FUNCTION public.log_status_change_with_rollback(
    p_user_id UUID,
    p_from_status TEXT,
    p_to_status TEXT,
    p_reason TEXT DEFAULT NULL,
    p_performed_by UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    audit_id UUID;
    rollback_details JSONB;
BEGIN
    -- Prepare rollback information
    rollback_details := jsonb_build_object(
        'fromStatus', p_from_status,
        'toStatus', p_to_status,
        'reason', p_reason,
        'canRollback', true,
        'rollbackToStatus', p_from_status,
        'timestamp', now()
    );
    
    -- Insert audit log with rollback capability
    SELECT public.insert_audit_log(
        p_user_id,
        'status_change',
        rollback_details,
        NULL, -- IP address would be provided by application
        NULL, -- User agent would be provided by application
        p_performed_by
    ) INTO audit_id;
    
    RETURN audit_id;
END;
$function$;

-- Function to rollback a status change
CREATE OR REPLACE FUNCTION public.rollback_status_change(
    p_audit_log_id UUID,
    p_performed_by UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    log_record RECORD;
    rollback_to_status TEXT;
    rollback_audit_id UUID;
BEGIN
    -- Get the audit log record
    SELECT * INTO log_record
    FROM public.audit_logs
    WHERE id = p_audit_log_id
    AND action = 'status_change';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Audit log record not found or not a status change';
    END IF;
    
    -- Check if rollback is allowed
    IF NOT (log_record.details->>'canRollback')::boolean THEN
        RAISE EXCEPTION 'Rollback not allowed for this status change';
    END IF;
    
    -- Get the rollback target status
    rollback_to_status := log_record.details->>'rollbackToStatus';
    
    IF rollback_to_status IS NULL THEN
        RAISE EXCEPTION 'No rollback target status available';
    END IF;
    
    -- Perform the rollback
    UPDATE public.clinicians
    SET clinician_status = rollback_to_status::clinician_status_enum,
        updated_at = now()
    WHERE user_id = log_record.user_id;
    
    -- Log the rollback action
    SELECT public.insert_audit_log(
        log_record.user_id,
        'status_change',
        jsonb_build_object(
            'fromStatus', log_record.details->>'toStatus',
            'toStatus', rollback_to_status,
            'reason', 'Rollback of audit log ' || p_audit_log_id,
            'isRollback', true,
            'originalAuditLogId', p_audit_log_id,
            'canRollback', false
        ),
        NULL,
        NULL,
        COALESCE(p_performed_by, auth.uid())
    ) INTO rollback_audit_id;
    
    -- Mark the original audit log as rolled back
    UPDATE public.audit_logs
    SET details = details || jsonb_build_object(
        'rolledBack', true,
        'rollbackAuditLogId', rollback_audit_id,
        'rollbackTimestamp', now()
    )
    WHERE id = p_audit_log_id;
    
    RETURN true;
END;
$function$;

-- Function to get audit trail for a user
CREATE OR REPLACE FUNCTION public.get_user_audit_trail(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    id UUID,
    action TEXT,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE,
    performed_by_name TEXT,
    ip_address INET,
    user_agent TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        al.id,
        al.action,
        al.details,
        al.timestamp,
        COALESCE(p.full_name, p.email, 'System') as performed_by_name,
        al.ip_address,
        al.user_agent
    FROM public.audit_logs al
    LEFT JOIN public.profiles p ON al.performed_by = p.user_id
    WHERE al.user_id = p_user_id
    ORDER BY al.timestamp DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$function$;

-- Add comments for documentation
COMMENT ON TABLE public.audit_logs IS 'Audit trail for all clinician registration system actions';
COMMENT ON FUNCTION public.insert_audit_log(UUID, TEXT, JSONB, INET, TEXT, UUID) IS 'Inserts an audit log entry with automatic tenant resolution';
COMMENT ON FUNCTION public.log_status_change_with_rollback(UUID, TEXT, TEXT, TEXT, UUID) IS 'Logs status changes with rollback capability';
COMMENT ON FUNCTION public.rollback_status_change(UUID, UUID) IS 'Rolls back a status change using audit log information';
COMMENT ON FUNCTION public.get_user_audit_trail(UUID, INTEGER, INTEGER) IS 'Retrieves audit trail for a specific user';