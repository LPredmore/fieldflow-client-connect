import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DashboardTab } from "@/components/Client/DashboardTab";
import { ProfileTab } from "@/components/Client/ProfileTab";
import { DocumentsTab } from "@/components/Client/DocumentsTab";
import { InsuranceTab } from "@/components/Client/InsuranceTab";
import { TherapistTab } from "@/components/Client/TherapistTab";
import { FormsTab } from "@/components/Client/FormsTab";
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function Portal() {
  const { user } = useAuth();
  const [customerId, setCustomerId] = useState<string>('');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!user) return;

      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('client_user_id', user.id)
        .single();

      if (customer?.id) {
        setCustomerId(customer.id);
        
        // Fetch pending forms count
        const { count } = await supabase
          .from('form_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', customer.id)
          .eq('status', 'pending');
        
        setPendingCount(count || 0);
      }
    };

    fetchCustomerData();
  }, [user]);

  return (
    <div className="container mx-auto py-8 px-4">
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
          <TabsTrigger 
            value="dashboard" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Dashboard
          </TabsTrigger>
          <TabsTrigger 
            value="profile"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Profile
          </TabsTrigger>
          <TabsTrigger 
            value="documents"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Documents
          </TabsTrigger>
          <TabsTrigger 
            value="insurance"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Insurance
          </TabsTrigger>
          <TabsTrigger 
            value="therapist"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Therapist
          </TabsTrigger>
          <TabsTrigger 
            value="forms"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Forms
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="dashboard" className="mt-0">
            <DashboardTab />
          </TabsContent>

          <TabsContent value="profile" className="mt-0">
            <ProfileTab />
          </TabsContent>

          <TabsContent value="documents" className="mt-0">
            <DocumentsTab />
          </TabsContent>

          <TabsContent value="insurance" className="mt-0">
            <InsuranceTab />
          </TabsContent>

          <TabsContent value="therapist" className="mt-0">
            <TherapistTab />
          </TabsContent>

          <TabsContent value="forms" className="mt-0">
            {customerId && <FormsTab customerId={customerId} />}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
