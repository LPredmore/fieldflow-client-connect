import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { REQUIRED_CONSENTS, RequiredConsent } from '@/config/requiredConsents';

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
  const [signatures, setSignatures] = useState<ConsentSignature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConsentSignatures = useCallback(async () => {
    if (!clientId || !enabled) {
      setSignatures([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('client_telehealth_consents')
        .select('id, client_id, consent_template_key, consent_template_version, signature_date, signed_at, is_revoked, revoked_at')
        .eq('client_id', clientId);

      if (fetchError) {
        throw fetchError;
      }

      setSignatures(data || []);
    } catch (err) {
      console.error('Error fetching consent signatures:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch consent status');
      setSignatures([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, enabled]);

  useEffect(() => {
    fetchConsentSignatures();
  }, [fetchConsentSignatures]);

  // Map required consents to their status
  const consentStatuses = useMemo(() => {
    return REQUIRED_CONSENTS.map((consent): ConsentStatus => {
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
  }, [signatures]);

  // Calculate compliance metrics
  const { signedCount, requiredCount, isFullyCompliant } = useMemo(() => {
    const required = consentStatuses.filter(s => s.consent.required);
    const signed = required.filter(s => s.isSigned);
    
    return {
      signedCount: signed.length,
      requiredCount: required.length,
      isFullyCompliant: signed.length === required.length,
    };
  }, [consentStatuses]);

  return {
    consentStatuses,
    loading,
    error,
    refetch: fetchConsentSignatures,
    signedCount,
    requiredCount,
    isFullyCompliant,
  };
}
