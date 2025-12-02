import { useMemo } from 'react';
import { useSupabaseTable } from '@/hooks/data/useSupabaseTable';
import { useAuth } from '@/hooks/useAuth';
import { Client, ClientFormData } from '@/types/client';
import { toast } from '@/hooks/use-toast';

export type { Client, ClientFormData };

export function useClients() {
  const { user, tenantId } = useAuth();
  
  const {
    data: clients,
    loading,
    error,
    refetch: refetchClients,
    create: createClient,
    update: updateClient,
    remove: deleteClient,
    createLoading,
    updateLoading,
    deleteLoading,
  } = useSupabaseTable<Client, ClientFormData>({
    table: 'clients',
    select: '*, assigned_staff:staff!primary_staff_id(prov_name_f, prov_name_l)',
    filters: {
      tenant_id: 'auto',
    },
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
                        'Unnamed Patient';
        
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
    insertOptions: {
      successMessage: 'Patient created successfully',
    },
    updateOptions: {
      successMessage: 'Patient updated successfully',
    },
    deleteOptions: {
      successMessage: 'Patient deleted successfully',
    },
  });

  // Statistics calculations
  const stats = useMemo(() => {
    const clientList = clients || [];
    
    return {
      total: clientList.length,
      active: clientList.filter(c => c.pat_status === 'active').length,
      new: clientList.filter(c => c.pat_status === 'new').length,
    };
  }, [clients]);

  // Wrapper function with defaults
  const createClientWithDefaults = async (clientData: ClientFormData) => {
    const dataWithDefaults = {
      ...clientData,
      primary_staff_id: clientData.primary_staff_id || undefined,
    };
    
    const result = await createClient(dataWithDefaults);
    
    if (result.data) {
      toast({
        title: "Success",
        description: "Patient created successfully!",
      });
    }
    
    return result;
  };

  const updateClientById = async (id: string, clientData: Partial<ClientFormData>) => {
    return updateClient({ id, ...clientData });
  };

  return {
    clients,
    loading: loading || createLoading || updateLoading || deleteLoading,
    error,
    stats,
    createClient: createClientWithDefaults,
    updateClient: updateClientById,
    deleteClient,
    refetchClients,
  };
}
