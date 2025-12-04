import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  price_per_unit: number | null;
  category: string | null;
  cpt_code: string | null;
  is_active: boolean;
  schedulable: boolean;
  tenant_id: string;
  created_by_profile_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to fetch services (session types) for the current tenant
 */
export function useServices() {
  const {
    data: services,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<Service>({
    table: 'services',
    filters: {
      tenant_id: 'auto',
      is_active: true,
      schedulable: true,
    },
    orderBy: { column: 'name', ascending: true },
  });

  // Find the default "Therapy Session" service
  const defaultService = services?.find(s => s.name === 'Therapy Session') || services?.[0];

  return {
    services: services || [],
    defaultService,
    loading,
    error,
    refetch,
  };
}
