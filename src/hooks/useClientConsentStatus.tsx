import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ConsentSignature {
  id: string;
  client_id: string;
  consent_template_key: string;
  consent_template_version: string;
  signature_date: string;
  signed_at: string;
  is_revoked: boolean;
  revoked_at: string | null;
}

export interface RequiredConsent {
  key: string;
  label: string;
  required: boolean;
  requiredFor?: string | null;
}

export interface ConsentStatus {
  consent: RequiredConsent;
  isSigned: boolean;
  signedAt: string | null;
  version: string | null;
  isRevoked: boolean;
  revokedAt: string | null;
}

interface UseClientConsentStatusOptions {
  clientId: string | null;
  enabled?: boolean;
}

interface UseClientConsentStatusResult {
  consentStatuses: ConsentStatus[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  signedCount: number;
  requiredCount: number;
  isFullyCompliant: boolean;
}

export function useClientConsentStatus({ 
  clientId, 
  enabled = true 
}: UseClientConsentStatusOptions): UseClientConsentStatusResult {
  const { tenantId } = useAuth();
  const [signatures, setSignatures] = useState<ConsentSignature[]>([]);
  const [requiredConsents, setRequiredConsents] = useState<RequiredConsent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!clientId || !enabled) {
      setSignatures([]);
      setRequiredConsents([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let consentsFromDb: RequiredConsent[] = [];

      // First, try to get tenant-specific required templates
      if (tenantId) {
        const { data: tenantTemplates, error: tenantError } = await supabase
          .from('consent_templates')
          .select('consent_type, title, is_required, required_for')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .eq('is_required', true);

        if (tenantError) {
          throw tenantError;
        }

        if (tenantTemplates && tenantTemplates.length > 0) {
          // Tenant has explicit required templates - use those
          consentsFromDb = tenantTemplates.map(t => ({
            key: t.consent_type,
            label: t.title,
            required: t.is_required ?? true,
            requiredFor: t.required_for,
          }));
        }
      }

      // No fallback to system defaults -- tenants must customize templates explicitly
      setRequiredConsents(consentsFromDb);

      // Fetch client's consent signatures
      const { data: signatureData, error: signatureError } = await supabase
        .from('client_telehealth_consents')
        .select('id, client_id, consent_template_key, consent_template_version, signature_date, signed_at, is_revoked, revoked_at')
        .eq('client_id', clientId);

      if (signatureError) {
        throw signatureError;
      }

      setSignatures(signatureData || []);
    } catch (err) {
      console.error('Error fetching consent data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch consent status');
      setSignatures([]);
      setRequiredConsents([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, enabled, tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Map required consents to their status
  const consentStatuses = useMemo(() => {
    return requiredConsents.map((consent): ConsentStatus => {
      // Find the most recent signature for this consent type
      const signature = signatures
        .filter(s => s.consent_template_key === consent.key)
        .sort((a, b) => new Date(b.signed_at).getTime() - new Date(a.signed_at).getTime())[0];

      if (!signature) {
        return {
          consent,
          isSigned: false,
          signedAt: null,
          version: null,
          isRevoked: false,
          revokedAt: null,
        };
      }

      return {
        consent,
        isSigned: !signature.is_revoked,
        signedAt: signature.signed_at,
        version: signature.consent_template_version,
        isRevoked: signature.is_revoked,
        revokedAt: signature.revoked_at,
      };
    });
  }, [requiredConsents, signatures]);

  // Calculate compliance metrics
  const { signedCount, requiredCount, isFullyCompliant } = useMemo(() => {
    const required = consentStatuses.filter(s => s.consent.required);
    const signed = required.filter(s => s.isSigned);
    
    return {
      signedCount: signed.length,
      requiredCount: required.length,
      isFullyCompliant: required.length === 0 || signed.length === required.length,
    };
  }, [consentStatuses]);

  return {
    consentStatuses,
    loading,
    error,
    refetch: fetchData,
    signedCount,
    requiredCount,
    isFullyCompliant,
  };
}
