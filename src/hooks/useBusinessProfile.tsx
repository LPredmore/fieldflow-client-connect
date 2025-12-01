import { useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Tenant = Database['public']['Tables']['tenants']['Row'];
type TenantUpdate = Database['public']['Tables']['tenants']['Update'];
type PracticeLocation = Database['public']['Tables']['practice_locations']['Row'];
type PracticeLocationInsert = Database['public']['Tables']['practice_locations']['Insert'];
type PracticeLocationUpdate = Database['public']['Tables']['practice_locations']['Update'];
type PracticeInfo = Database['public']['Tables']['practice_info']['Row'];
type PracticeInfoInsert = Database['public']['Tables']['practice_info']['Insert'];
type PracticeInfoUpdate = Database['public']['Tables']['practice_info']['Update'];

export function useBusinessProfile() {
  const { tenantId, isAdmin } = useAuth();
  const { toast } = useToast();

  // Query 1: Get tenant data (org info)
  const {
    data: tenantArray,
    loading: tenantLoading,
    error: tenantError,
    refetch: refetchTenant,
  } = useSupabaseQuery<Tenant>({
    table: 'tenants',
    filters: { id: tenantId },
    enabled: !!tenantId,
  });

  // Query 2: Get primary practice location
  const {
    data: locationArray,
    loading: locationLoading,
    error: locationError,
    refetch: refetchLocation,
  } = useSupabaseQuery<PracticeLocation>({
    table: 'practice_locations',
    filters: { tenant_id: tenantId, is_default: true },
    enabled: !!tenantId,
  });

  // Query 3: Get primary billing info
  const {
    data: billingArray,
    loading: billingLoading,
    error: billingError,
    refetch: refetchBilling,
  } = useSupabaseQuery<PracticeInfo>({
    table: 'practice_info',
    filters: { tenant_id: tenantId, is_default: true },
    enabled: !!tenantId,
  });

  const tenant = tenantArray?.[0] || null;
  const location = locationArray?.[0] || null;
  const billing = billingArray?.[0] || null;

  const loading = tenantLoading || locationLoading || billingLoading;
  const error = tenantError || locationError || billingError;

  // Mutation: Update tenant
  const updateTenant = async (data: Partial<TenantUpdate>) => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Access denied',
        description: 'Only administrators can update organization settings.',
      });
      return { error: 'Insufficient permissions' };
    }

    if (!tenant) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Tenant not found.',
      });
      return { error: 'Tenant not found' };
    }

    const { error } = await supabase
      .from('tenants')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', tenantId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to update organization: ${error.message}`,
      });
      return { error };
    }

    toast({
      title: 'Success',
      description: 'Organization settings updated successfully.',
    });

    refetchTenant();
    return { error: null };
  };

  // Mutation: Create location
  const createLocation = async (data: Omit<PracticeLocationInsert, 'tenant_id' | 'is_default'>) => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Access denied',
        description: 'Only administrators can create locations.',
      });
      return { error: 'Insufficient permissions' };
    }

    const { error } = await supabase.from('practice_locations').insert({
      ...data,
      tenant_id: tenantId!,
      is_default: true,
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to create location: ${error.message}`,
      });
      return { error };
    }

    toast({
      title: 'Success',
      description: 'Location created successfully.',
    });

    refetchLocation();
    return { error: null };
  };

  // Mutation: Update location
  const updateLocation = async (data: Partial<PracticeLocationUpdate>) => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Access denied',
        description: 'Only administrators can update locations.',
      });
      return { error: 'Insufficient permissions' };
    }

    if (!location) {
      return createLocation(data as Omit<PracticeLocationInsert, 'tenant_id' | 'is_default'>);
    }

    const { error } = await supabase
      .from('practice_locations')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', location.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to update location: ${error.message}`,
      });
      return { error };
    }

    toast({
      title: 'Success',
      description: 'Location updated successfully.',
    });

    refetchLocation();
    return { error: null };
  };

  // Mutation: Create billing info
  const createBilling = async (data: Omit<PracticeInfoInsert, 'tenant_id' | 'is_default'>) => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Access denied',
        description: 'Only administrators can create billing info.',
      });
      return { error: 'Insufficient permissions' };
    }

    const { error } = await supabase.from('practice_info').insert({
      ...data,
      tenant_id: tenantId!,
      is_default: true,
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to create billing info: ${error.message}`,
      });
      return { error };
    }

    toast({
      title: 'Success',
      description: 'Billing information created successfully.',
    });

    refetchBilling();
    return { error: null };
  };

  // Mutation: Update billing info
  const updateBilling = async (data: Partial<PracticeInfoUpdate>) => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Access denied',
        description: 'Only administrators can update billing info.',
      });
      return { error: 'Insufficient permissions' };
    }

    if (!billing) {
      return createBilling(data as Omit<PracticeInfoInsert, 'tenant_id' | 'is_default'>);
    }

    const { error } = await supabase
      .from('practice_info')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', billing.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to update billing info: ${error.message}`,
      });
      return { error };
    }

    toast({
      title: 'Success',
      description: 'Billing information updated successfully.',
    });

    refetchBilling();
    return { error: null };
  };

  const refetch = () => {
    refetchTenant();
    refetchLocation();
    refetchBilling();
  };

  return {
    tenant,
    location,
    billing,
    loading,
    error,
    updateTenant,
    updateLocation,
    createLocation,
    updateBilling,
    createBilling,
    refetch,
  };
}
