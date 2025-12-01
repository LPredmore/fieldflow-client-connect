import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useSupabaseInsert, useSupabaseDelete } from '@/hooks/data/useSupabaseMutation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

type LicenseType = {
  id: number;
  license: string | null;
  specialty: string | null;
  tenant_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
};

type LicenseTypeInsert = {
  license: string;
  specialty: string;
  tenant_id: string;
  created_by_user_id: string;
};

export function useLicenseTypes() {
  const { user, tenantId, isAdmin } = useAuth();
  const { toast } = useToast();

  // Query for license types
  const {
    data: licenseTypes,
    loading: queryLoading,
    error: queryError,
    refetch,
  } = useSupabaseQuery<LicenseType>({
    table: 'cliniclevel_license_types',
    filters: {
      tenant_id: 'auto',
    },
    enabled: !!user && !!tenantId,
  });

  // Get unique specialties for dropdown
  const uniqueSpecialties = Array.from(
    new Set((licenseTypes || []).map((lt) => lt.specialty).filter(Boolean))
  ) as string[];

  // Insert mutation
  const {
    mutate: insertMutation,
    loading: insertLoading,
    error: insertError,
  } = useSupabaseInsert<LicenseTypeInsert>({
    table: 'cliniclevel_license_types',
    onSuccess: () => {
      refetch();
    },
    successMessage: 'License type added successfully',
  });

  // Delete mutation
  const {
    mutate: deleteMutation,
    loading: deleteLoading,
    error: deleteError,
  } = useSupabaseDelete({
    table: 'cliniclevel_license_types',
    idField: 'id',
    onSuccess: () => {
      refetch();
    },
    successMessage: 'License type removed successfully',
  });

  const addLicenseType = async (specialty: string, license: string) => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Access denied',
        description: 'Only business administrators can add license types.',
      });
      return { error: 'Insufficient permissions' };
    }

    if (!tenantId || !user?.id) {
      return { error: 'Missing tenant or user information' };
    }

    return insertMutation({
      specialty,
      license,
      tenant_id: tenantId,
      created_by_user_id: user.id,
    });
  };

  const deleteLicenseType = async (id: number) => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Access denied',
        description: 'Only business administrators can delete license types.',
      });
      return { error: 'Insufficient permissions' };
    }

    return deleteMutation(id.toString());
  };

  return {
    licenseTypes,
    uniqueSpecialties,
    loading: queryLoading || insertLoading || deleteLoading,
    error: queryError || insertError || deleteError,
    addLicenseType,
    deleteLicenseType,
    refetch,
  };
}
