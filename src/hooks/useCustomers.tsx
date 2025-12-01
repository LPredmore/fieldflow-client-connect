import { useMemo } from 'react';
import { useSupabaseTable } from '@/hooks/data/useSupabaseTable';
import { useAuth } from '@/hooks/useAuth';
import { CustomerFormData } from '@/types/customer';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Customer {
  id: string;
  tenant_id: string;
  client_user_id: string | null;
  // Patient Name Fields
  pat_name_f: string | null;
  pat_name_l: string | null;
  pat_name_m: string | null;
  preferred_name: string | null;
  // Contact Info
  email: string | null;
  pat_phone: string | null;
  // Address Fields (flat structure matching DB)
  pat_addr_1: string | null;
  pat_city: string | null;
  pat_state: string | null; // This is us_states enum in DB
  pat_zip: string | null;
  pat_country: string | null;
  // Patient Demographics
  pat_dob: string | null;
  pat_sex: string | null;
  gender_identity: string | null;
  pat_ssn: number | null;
  // Status & Assignment
  status: string | null; // client_status enum
  assigned_clinician: string | null;
  assigned_to_user_id: string | null;
  assigned_user_name?: string;
  // Insurance Info
  ins_name_f: string | null;
  ins_name_l: string | null;
  ins_dob: string | null;
  ins_number: string | null;
  ins_group: string | null;
  ins_addr_1: string | null;
  ins_city: string | null;
  ins_state: string | null;
  ins_zip: string | null;
  payerid: string | null;
  ins_rel: string | null;
  // Diagnosis Codes
  diag_1: string | null;
  diag_2: string | null;
  diag_3: string | null;
  diag_4: string | null;
  diag_5: string | null;
  diag_6: string | null;
  diag_7: string | null;
  diag_8: string | null;
  diag_9: string | null;
  diag_10: string | null;
  diag_11: string | null;
  diag_12: string | null;
  // Other
  timezone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  created_by_user_id: string | null;
  // Computed helper fields
  full_name?: string;
}

// CustomerFormData type moved to @/types/customer

export function useCustomers() {
  const { user, tenantId } = useAuth();
  
  console.log('🔍 [useCustomers] Hook called', { 
    hasUser: !!user, 
    userId: user?.id, 
    hasTenantId: !!tenantId, 
    tenantId 
  });
  
  const {
    data: customers,
    loading,
    error,
    refetch: refetchCustomers,
    create: createCustomer,
    update: updateCustomer,
    remove: deleteCustomer,
    createLoading,
    updateLoading,
    deleteLoading,
  } = useSupabaseTable<Customer, CustomerFormData>({
    table: 'customers',
    select: '*, assigned_user:profiles!assigned_to_user_id(full_name)',
    filters: {
      tenant_id: 'auto', // Auto-apply tenant filter
    },
    orderBy: { column: 'created_at', ascending: false },
    transform: (data: any[]) => 
      data.map((customer: any) => {
        // Compute full name with robust fallback chain:
        // 1. First/Middle/Last name
        // 2. Preferred name
        // 3. Email
        // 4. "Unnamed Customer" as last resort
        const patientName = [
          customer.pat_name_f,
          customer.pat_name_m,
          customer.pat_name_l
        ].filter(Boolean).join(' ').trim();
        
        const fullName = patientName || 
                        customer.preferred_name || 
                        customer.email || 
                        'Unnamed Customer';
        
        return {
          ...customer,
          full_name: fullName,
          assigned_user_name: customer.assigned_user?.full_name || 'Unassigned'
        };
      }),
    insertOptions: {
      successMessage: 'Customer created successfully',
      onSuccess: (data) => {
        // Custom success handling if needed
      },
    },
    updateOptions: {
      successMessage: 'Customer updated successfully',
    },
    deleteOptions: {
      successMessage: 'Customer deleted successfully',
    },
  });
  
  console.log('🔍 [useCustomers] Query result', { 
    customersCount: customers?.length, 
    loading, 
    error 
  });

  // Statistics calculations (memoized for performance)
  const stats = useMemo(() => {
    // Provide default empty array if customers is undefined/null
    const customerList = customers || [];
    
    return {
      total: customerList.length,
      active: customerList.filter(c => c.status === 'active').length,
      new: customerList.filter(c => c.status === 'new').length,
    };
  }, [customers]);

  // Wrapper functions to maintain API compatibility
  const createCustomerWithDefaults = async (customerData: CustomerFormData) => {
    console.log('🔍 [useCustomers] Creating customer with data:', customerData);
    
    const dataWithDefaults = {
      ...customerData,
      assigned_to_user_id: customerData.assigned_to_user_id || user?.id,
    };
    
    console.log('🔍 [useCustomers] Data with defaults:', dataWithDefaults);
    
    const result = await createCustomer(dataWithDefaults);
    
    console.log('🔍 [useCustomers] Insert result:', result);
    
    // Create client account and send welcome email if customer has an email
    if (result.data && customerData.email) {
      try {
        const customerName = `${customerData.pat_name_f} ${customerData.pat_name_l}`.trim() || 
                            customerData.preferred_name || 
                            'Valued Patient';
        
        // Get business name from settings
        const { data: settingsData } = await supabase
          .from('settings')
          .select('business_name')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        
        const businessName = settingsData?.business_name || 'Our Practice';
        
        console.log('👤 Creating client auth account for:', customerData.email);
        
        // Create client auth account
        const { data: authData, error: authError } = await supabase.functions.invoke('create-client-account', {
          body: {
            email: customerData.email,
            firstName: customerData.pat_name_f,
            lastName: customerData.pat_name_l,
            customerId: result.data.id,
            tenantId: tenantId,
            redirectUrl: `${window.location.origin}/client/portal`,
          },
        });
        
        // Handle 409 - user already exists
        if (authError) {
          console.error('❌ Auth account creation response:', { authError, authData });
          
          // Check if this is a 409 conflict (user already exists)
          if (authData?.error?.includes('already exists') && authData?.userId) {
            console.log('⚠️ User already exists, linking to customer record:', authData.userId);
            
            // Link the existing user to this customer
            await supabase
              .from('customers')
              .update({ client_user_id: authData.userId })
              .eq('id', result.data.id);
            
            toast({
              title: "Patient Created",
              description: "Patient created and linked to existing login account.",
            });
            return result;
          }
          
          // Other errors
          toast({
            title: "Patient Created",
            description: "Patient record created but login account setup failed. You can set up their account later.",
            variant: "destructive",
          });
          return result;
        }
        
        console.log('✅ Client account created, sending welcome email');
        
        // Send welcome email with password
        const { error: emailError } = await supabase.functions.invoke('send-welcome-email', {
          body: {
            customerEmail: customerData.email,
            customerName,
            businessName,
            password: authData.password,
          },
        });
        
        if (emailError) {
          console.error('❌ Failed to send welcome email:', emailError);
          toast({
            title: "Account Created",
            description: "Patient account created but welcome email failed to send.",
          });
        } else {
          console.log('✅ Welcome email with login link sent successfully');
          toast({
            title: "Success!",
            description: "Patient account created and login instructions sent via email.",
          });
        }
      } catch (err) {
        console.error('❌ Error in account creation flow:', err);
        toast({
          title: "Patient Created",
          description: "Patient record created but there was an issue with account setup.",
          variant: "destructive",
        });
      }
    } else if (result.data) {
      toast({
        title: "Success",
        description: "Patient created successfully!",
      });
    }
    
    return result;
  };

  const updateCustomerById = async (id: string, customerData: Partial<CustomerFormData>) => {
    return updateCustomer({ id, ...customerData });
  };

  return {
    customers,
    loading: loading || createLoading || updateLoading || deleteLoading,
    error,
    stats,
    createCustomer: createCustomerWithDefaults,
    updateCustomer: updateCustomerById,
    deleteCustomer,
    refetchCustomers,
  };
}