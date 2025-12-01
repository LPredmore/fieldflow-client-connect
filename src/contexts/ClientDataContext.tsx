import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useSupabaseUpdate } from '@/hooks/data/useSupabaseMutation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export type ClientStatus = 'new' | 'completing_signup' | 'registered';

// Database structure - matches actual customers table columns
interface ClientProfileData {
  // Core fields
  id: string;
  status: ClientStatus;
  tenant_id: string;
  client_user_id: string | null;
  
  // Database column names (healthcare-specific)
  pat_name_f: string | null;
  pat_name_l: string | null;
  pat_name_m: string | null;
  preferred_name?: string | null;
  email?: string | null;
  pat_phone?: string | null;
  pat_dob?: string | null;
  pat_sex?: string | null;
  gender_identity?: string | null;
  pat_addr_1?: string | null;
  pat_city?: string | null;
  pat_state?: string | null;
  pat_zip?: string | null;
  pat_country?: string | null;
  timezone?: string | null;
  notes?: string | null;
  assigned_clinician?: string | null;
  assigned_to_user_id?: string | null;
  created_at?: string;
  updated_at?: string;
  
  // Computed properties for backward compatibility (readonly)
  readonly fullName?: string;
  readonly name?: string;
  readonly phone?: string;
  readonly date_of_birth?: string;
  readonly gender?: string;
  readonly street_address?: string;
  readonly city?: string;
  readonly state?: string;
  readonly zip_code?: string;
}

interface ClientDataContextType {
  profile: ClientProfileData | null;
  status: ClientStatus | null;
  customerId: string | null;
  loading: boolean;
  error: string | null;
  isRefreshing: boolean; // True when refreshing data in background
  updateStatus: (newStatus: ClientStatus) => Promise<boolean>;
  updateProfile: (updates: Partial<ClientProfileData>) => Promise<{ error?: any }>;
  refetch: () => Promise<void>;
}

const ClientDataContext = createContext<ClientDataContextType | undefined>(undefined);

// CRITICAL FIX: Define transform function outside component for stable reference
// This prevents the transform from being recreated on every render
const transformClientProfile = (data: any[]) => {
  return data.map(profile => ({
    ...profile,
    fullName: [profile.pat_name_f, profile.pat_name_m, profile.pat_name_l]
      .filter(Boolean)
      .join(' ') || undefined,
    name: [profile.pat_name_f, profile.pat_name_l]
      .filter(Boolean)
      .join(' ') || undefined,
    phone: profile.pat_phone || undefined,
    date_of_birth: profile.pat_dob || undefined,
    gender: profile.pat_sex || undefined,
    street_address: profile.pat_addr_1 || undefined,
    city: profile.pat_city || undefined,
    state: profile.pat_state || undefined,
    zip_code: profile.pat_zip || undefined,
  }));
};

export function ClientDataProvider({ children }: { children: ReactNode }) {
  const { user, userRole } = useAuth();

  // Memoize filters to prevent reference changes causing infinite loops
  const profileFilters = useMemo(() => ({
    client_user_id: user?.id,
  }), [user?.id]);

  // Single global query for client profile data with aggressive caching
  const {
    data: profileArray,
    loading: queryLoading,
    error: queryError,
    refetch,
    isRefreshing,
  } = useSupabaseQuery<ClientProfileData>({
    table: 'customers',
    select: 'id, status, tenant_id, client_user_id, pat_name_f, pat_name_l, pat_name_m, preferred_name, email, pat_phone, pat_dob, pat_sex, gender_identity, pat_addr_1, pat_city, pat_state, pat_zip, pat_country, timezone, notes, assigned_clinician, assigned_to_user_id, created_at, updated_at',
    filters: profileFilters,
    enabled: !!user && userRole === 'client',
    staleTime: 600000, // 10 minutes - client data rarely changes during session
    throttleMs: 5000, // 5 second minimum between requests to reduce throttling
    transform: transformClientProfile, // Use stable function reference
    onError: (error) => {
      console.error('Error loading client profile:', error);
    },
  });

  // Extract data
  const profile = profileArray?.length > 0 ? profileArray[0] : null;
  const status = profile?.status || null;
  const customerId = profile?.id || null;

  // Update status mutation
  const {
    mutate: updateStatusMutation,
    loading: updateLoading,
    error: updateError,
  } = useSupabaseUpdate<{ status: ClientStatus }>({
    table: 'customers',
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      console.error('Error updating client status:', error);
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateStatus = async (newStatus: ClientStatus) => {
    if (!customerId) {
      console.error('No customer ID available');
      return false;
    }

    const result = await updateStatusMutation({
      id: customerId,
      status: newStatus,
    });

    return !result.error;
  };

  // Update profile mutation
  const {
    mutate: updateProfileMutation,
    loading: updateProfileLoading,
  } = useSupabaseUpdate<Partial<ClientProfileData>>({
    table: 'customers',
    onSuccess: () => {
      // No refetch - we'll update optimistically instead
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateProfile = async (updates: Partial<ClientProfileData>) => {
    if (!customerId) {
      console.error('No customer ID available');
      return { error: 'No customer ID' };
    }

    // Map modern field names to database column names
    const mappedUpdates: Record<string, any> = { ...updates };
    
    // Handle name splitting if full name is provided
    if ('name' in updates && updates.name) {
      const nameParts = updates.name.split(' ');
      if (nameParts.length >= 2) {
        mappedUpdates.pat_name_f = nameParts[0];
        mappedUpdates.pat_name_l = nameParts.slice(1).join(' ');
      } else if (nameParts.length === 1) {
        mappedUpdates.pat_name_f = nameParts[0];
      }
      delete mappedUpdates.name;
    }
    
    // Map individual modern fields to database fields
    if ('phone' in updates) {
      mappedUpdates.pat_phone = updates.phone;
      delete mappedUpdates.phone;
    }
    if ('date_of_birth' in updates) {
      mappedUpdates.pat_dob = updates.date_of_birth;
      delete mappedUpdates.date_of_birth;
    }
    if ('gender' in updates) {
      mappedUpdates.pat_sex = updates.gender;
      delete mappedUpdates.gender;
    }
    if ('street_address' in updates) {
      mappedUpdates.pat_addr_1 = updates.street_address;
      delete mappedUpdates.street_address;
    }
    if ('city' in updates) {
      mappedUpdates.pat_city = updates.city;
      delete mappedUpdates.city;
    }
    if ('state' in updates) {
      mappedUpdates.pat_state = updates.state;
      delete mappedUpdates.state;
    }
    if ('zip_code' in updates) {
      mappedUpdates.pat_zip = updates.zip_code;
      delete mappedUpdates.zip_code;
    }

    // Remove readonly computed properties
    delete mappedUpdates.fullName;

    // Perform mutation in background without refetch
    const result = await updateProfileMutation({
      id: customerId,
      ...mappedUpdates,
    });

    return result;
  };

  const value: ClientDataContextType = {
    profile,
    status,
    customerId,
    loading: queryLoading || updateLoading || updateProfileLoading,
    error: queryError || updateError,
    isRefreshing,
    updateStatus,
    updateProfile,
    refetch,
  };

  return (
    <ClientDataContext.Provider value={value}>
      {children}
    </ClientDataContext.Provider>
  );
}

export function useClientData() {
  const context = useContext(ClientDataContext);
  if (context === undefined) {
    throw new Error('useClientData must be used within a ClientDataProvider');
  }
  return context;
}
