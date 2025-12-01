import { useSupabaseTable } from '@/hooks/data/useSupabaseTable';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  cpt_code?: string | null;
  price_per_unit: number;
  duration_minutes?: number | null;
  schedulable: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface ServiceFormData {
  name: string;
  description?: string;
  category?: string;
  cpt_code?: string;
  price_per_unit: number;
  duration_minutes?: number;
  schedulable?: boolean;
  is_active?: boolean;
}

export function useServices() {
  const {
    data: services,
    loading,
    error,
    refetch: refetchServices,
    create: createService,
    update: updateService,
    remove: deleteService,
    createLoading,
    updateLoading,
    deleteLoading,
  } = useSupabaseTable<Service, ServiceFormData>({
    table: 'services',
    filters: {
      tenant_id: 'auto', // Auto-apply tenant filter
    },
    orderBy: { column: 'created_at', ascending: false },
    insertOptions: {
      successMessage: 'Service created successfully',
    },
    updateOptions: {
      successMessage: 'Service updated successfully',
    },
    deleteOptions: {
      successMessage: 'Service deleted successfully',
    },
  });

  // Wrapper functions to maintain API compatibility
  const updateServiceById = async (id: string, serviceData: Partial<ServiceFormData>) => {
    return updateService({ id, ...serviceData });
  };

  return {
    services,
    loading: loading || createLoading || updateLoading || deleteLoading,
    error,
    createService,
    updateService: updateServiceById,
    deleteService,
    refetchServices,
  };
}