import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { User, Shield } from "lucide-react";

interface StaffMemberOption {
  user_id: string;
  full_name: string;
  email: string;
  roles: string[];
  is_admin: boolean;
}

interface ContractorSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function ContractorSelector({ value, onValueChange, disabled }: ContractorSelectorProps) {
  const [staffMembers, setStaffMembers] = useState<StaffMemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, tenantId } = useAuth();

  useEffect(() => {
    const fetchStaffMembers = async () => {
      if (!user || !tenantId) return;

      try {
        setLoading(true);
        
        // Fetch all active staff members from user_roles and their profile info
        const { data: userRolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select(`
            user_id,
            role,
            profiles!inner(
              full_name,
              email
            )
          `)
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .in('role', ['staff', 'clinician', 'billing_staff', 'admin'])
          .order('role', { ascending: true });

        if (rolesError) {
          console.error('Error fetching staff members:', rolesError);
          return;
        }

        // Group by user_id and aggregate roles
        const staffMap = new Map<string, StaffMemberOption>();
        
        (userRolesData || []).forEach((item: any) => {
          const userId = item.user_id;
          const role = item.role;
          const profile = item.profiles;

          if (!staffMap.has(userId)) {
            staffMap.set(userId, {
              user_id: userId,
              full_name: profile?.full_name || 'Unnamed User',
              email: profile?.email || '',
              roles: [role],
              is_admin: role === 'admin'
            });
          } else {
            const existing = staffMap.get(userId)!;
            existing.roles.push(role);
            if (role === 'admin') {
              existing.is_admin = true;
            }
          }
        });

        const staffArray = Array.from(staffMap.values());
        
        // Sort: admins first, then by name
        staffArray.sort((a, b) => {
          if (a.is_admin && !b.is_admin) return -1;
          if (!a.is_admin && b.is_admin) return 1;
          return a.full_name.localeCompare(b.full_name);
        });

        setStaffMembers(staffArray);
      } catch (error) {
        console.error('Error fetching staff members:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStaffMembers();
  }, [user, tenantId]);

  // Auto-assign current user when field is empty and user is available in staff list
  useEffect(() => {
    // Only run after staff members have finished loading
    if (loading) return;
    
    // Only set if: field is empty, user is available, and user exists in staff list
    if (!value && user?.id && staffMembers.some(staff => staff.user_id === user.id)) {
      onValueChange(user.id);
    }
  }, [staffMembers, loading, value, user?.id, onValueChange]);

  if (loading) {
    return (
      <Select disabled>
        <FormControl>
          <SelectTrigger disabled>
            <SelectValue placeholder="Loading..." />
          </SelectTrigger>
        </FormControl>
      </Select>
    );
  }

  const handleValueChange = (newValue: string) => {
    // Convert "unassigned" to empty string for the parent component
    onValueChange(newValue === "unassigned" ? "" : newValue);
  };

  // Convert empty/null value to "unassigned" for the select component
  const selectValue = value ? value : "unassigned";

  return (
    <Select onValueChange={handleValueChange} value={selectValue} disabled={disabled}>
      <FormControl>
        <SelectTrigger>
          <SelectValue placeholder="Select assigned staff member" />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        <SelectItem value="unassigned">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>Unassigned</span>
          </div>
        </SelectItem>
        {staffMembers.map((staff) => (
          <SelectItem key={staff.user_id} value={staff.user_id}>
            <div className="flex items-center gap-2">
              {staff.is_admin ? (
                <Shield className="h-4 w-4 text-primary" />
              ) : (
                <User className="h-4 w-4 text-muted-foreground" />
              )}
              <span>
                {staff.full_name || staff.email?.split('@')[0] || 'Unnamed User'}
                {staff.is_admin && ' (Admin)'}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
