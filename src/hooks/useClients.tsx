import { useMemo, useState } from 'react';
import { useSupabaseTable } from '@/hooks/data/useSupabaseTable';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';
import { Client, ClientFormData } from '@/types/client';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export type { Client, ClientFormData };

interface UseClientsOptions {
  /**
   * If true, returns all clients for the tenant (admin view).
   * If false/undefined, filters by primary_staff_id (clinician's assigned clients).
   */
  allTenantClients?: boolean;
}

export function useClients(options?: UseClientsOptions) {
  const { user, tenantId } = useAuth();
  const [createLoading, setCreateLoading] = useState(false);
  
  // Extract staff ID from auth context for filtering
  const staffId = user?.staffAttributes?.staffData?.id;
  
  // Determine if we should filter by staff
  const shouldFilterByStaff = !options?.allTenantClients && !!staffId;
  
  const {
    data: clients,
    loading,
    error,
    refetch: refetchClients,
    update: updateClient,
    remove: deleteClient,
    updateLoading,
    deleteLoading,
  } = useSupabaseTable<Client, ClientFormData>({
    table: 'clients',
    select: '*, assigned_staff:staff!primary_staff_id(prov_name_f, prov_name_l)',
    filters: {
      tenant_id: 'auto',
      ...(shouldFilterByStaff ? { primary_staff_id: staffId } : {}),
    },
    enabled: options?.allTenantClients ? !!tenantId : !!staffId,
    orderBy: { column: 'created_at', ascending: false },
    transform: (data: any[]) => 
      data.map((client: any) => {
        // Compute full name with robust fallback chain
        const patientName = [
          client.pat_name_f,
          client.pat_name_m,
          client.pat_name_l
        ].filter(Boolean).join(' ').trim();
        
        const fullName = patientName || 
                        client.pat_name_preferred || 
                        client.email || 
                        'Unnamed Client';
        
        // Compute assigned staff name
        const staffName = client.assigned_staff 
          ? `${client.assigned_staff.prov_name_f || ''} ${client.assigned_staff.prov_name_l || ''}`.trim()
          : 'Unassigned';
        
        return {
          ...client,
          full_name: fullName,
          assigned_staff_name: staffName
        };
      }),
    updateOptions: {
      successMessage: 'Client updated successfully',
    },
    deleteOptions: {
      successMessage: 'Client deleted successfully',
    },
  });

  // Fetch treatment plans to determine which clients have plans (for "New" stat)
  const { data: treatmentPlans, loading: treatmentPlansLoading } = useSupabaseQuery<{ client_id: string }>({
    table: 'client_treatment_plans',
    select: 'client_id',
    filters: {
      tenant_id: 'auto',
    },
    enabled: options?.allTenantClients ? !!tenantId : !!staffId,
  });

  // Statistics calculations
  const stats = useMemo(() => {
    const clientList = clients || [];
    
    // Create a Set of client IDs that have treatment plans
    const clientsWithPlans = new Set(
      (treatmentPlans || []).map(tp => tp.client_id)
    );
    
    return {
      total: clientList.length,
      active: clientList.filter(c => c.pat_status === 'Active').length,
      // "New" = clients without any treatment plan entry
      new: clientList.filter(c => !clientsWithPlans.has(c.id)).length,
    };
  }, [clients, treatmentPlans]);

  // Create client via edge function (creates auth account + all related records)
  const createClientWithAccount = async (clientData: ClientFormData) => {
    if (!tenantId) {
      toast({
        title: "Error",
        description: "No tenant ID available. Please log in again.",
        variant: "destructive",
      });
      return { data: null, error: new Error("No tenant ID") };
    }

    setCreateLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-client-account', {
        body: {
          email: clientData.email,
          firstName: clientData.pat_name_f,
          lastName: clientData.pat_name_l,
          middleName: clientData.pat_name_m,
          preferredName: clientData.pat_name_preferred,
          phone: clientData.phone,
          biologicalSex: clientData.pat_sex,
          assignedClinicianId: clientData.primary_staff_id,
          streetAddress: clientData.pat_addr_1,
          address2: clientData.pat_addr_2,
          city: clientData.pat_city,
          state: clientData.pat_state,
          zipCode: clientData.pat_zip,
          country: clientData.pat_country || 'US',
          tenantId: tenantId,
        },
      });

      if (error) {
        console.error("Edge function error:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to create client account",
          variant: "destructive",
        });
        return { data: null, error };
      }

      if (data?.error) {
        console.error("Create client error:", data.error);
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        return { data: null, error: new Error(data.error) };
      }

      // Refetch clients list
      await refetchClients();

      toast({
        title: "Client Created",
        description: `Client account created successfully. Temporary password: ${data.password}`,
      });

      return { data, error: null };
    } catch (err) {
      console.error("Unexpected error creating client:", err);
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { data: null, error: err };
    } finally {
      setCreateLoading(false);
    }
  };

  const updateClientById = async (id: string, clientData: Partial<ClientFormData>) => {
    return updateClient({ id, ...clientData });
  };

  return {
    clients,
    loading: loading || treatmentPlansLoading || createLoading || updateLoading || deleteLoading,
    error,
    stats,
    createClient: createClientWithAccount,
    updateClient: updateClientById,
    deleteClient,
    refetchClients,
  };
}
