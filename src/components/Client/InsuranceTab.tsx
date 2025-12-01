import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, CheckCircle, XCircle, Clock, AlertCircle, Plus, Edit, Trash2, FileImage } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AddInsuranceDialog } from "./AddInsuranceDialog";
import { useInsuranceManagement } from "@/hooks/data/useInsuranceManagement";
import { InsurancePolicy } from "@/types/insurance";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function InsuranceTab() {
  const { user } = useAuth();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<InsurancePolicy | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<string | null>(null);

  const { data: customer } = useQuery({
    queryKey: ['customer', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, tenant_id, pat_name_f, pat_name_l, pat_name_m, pat_dob, pat_sex, pat_addr_1, pat_city, pat_state, pat_zip, pat_phone')
        .eq('client_user_id', user?.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const {
    policies: insurancePolicies,
    isLoading,
    addInsurance,
    updateInsurance,
    deactivateInsurance,
    isAdding,
    isUpdating,
    isDeactivating,
  } = useInsuranceManagement(customer?.id);

  const handleAddOrUpdate = async (data: any) => {
    if (editPolicy) {
      await updateInsurance({ id: editPolicy.id, data, existingPolicy: editPolicy });
      setEditPolicy(null);
    } else {
      await addInsurance(data);
    }
    setAddDialogOpen(false);
  };

  const handleEdit = (policy: InsurancePolicy) => {
    setEditPolicy(policy);
    setAddDialogOpen(true);
  };

  const handleDeleteClick = (policyId: string) => {
    setPolicyToDelete(policyId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (policyToDelete) {
      await deactivateInsurance(policyToDelete);
      setPolicyToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const getVerificationIcon = (status: string | null) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getVerificationBadgeVariant = (status: string | null): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case 'verified':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'pending':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Insurance Information</h2>
          <p className="text-muted-foreground">
            Your insurance coverage and verification status
          </p>
        </div>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Insurance Information</h2>
          <p className="text-muted-foreground">
            Manage your insurance coverage
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Insurance
        </Button>
      </div>

      {!insurancePolicies || insurancePolicies.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Insurance Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No insurance on file</p>
              <p className="text-sm mt-2 mb-4">
                Add your insurance information to streamline billing
              </p>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Insurance
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {insurancePolicies.map((policy) => (
            <Card key={policy.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {policy.payer_name || 'Insurance Provider'}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {policy.insurance_type || 'primary'}
                    </Badge>
                    {policy.verification_status && (
                      <Badge 
                        variant={getVerificationBadgeVariant(policy.verification_status)} 
                        className="flex items-center gap-1"
                      >
                        {getVerificationIcon(policy.verification_status)}
                        <span className="capitalize">{policy.verification_status}</span>
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(policy)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(policy.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Policy Number</p>
                    <p className="font-medium">{policy.policy_number}</p>
                  </div>
                  {policy.group_number && (
                    <div>
                      <p className="text-muted-foreground">Group Number</p>
                      <p className="font-medium">{policy.group_number}</p>
                    </div>
                  )}
                  {policy.insured_name_first && (
                    <div>
                      <p className="text-muted-foreground">Insured Name</p>
                      <p className="font-medium">
                        {policy.insured_name_first} {policy.insured_name_last}
                      </p>
                    </div>
                  )}
                  {policy.relationship_to_patient && (
                    <div>
                      <p className="text-muted-foreground">Relationship</p>
                      <p className="font-medium capitalize">{policy.relationship_to_patient}</p>
                    </div>
                  )}
                  {policy.verified_date && (
                    <div>
                      <p className="text-muted-foreground">Last Verified</p>
                      <p className="font-medium">
                        {new Date(policy.verified_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  )}
                </div>
                {policy.verification_notes && (
                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <p className="text-xs text-muted-foreground font-medium mb-1">
                      Verification Notes
                    </p>
                    <p className="text-sm">{policy.verification_notes}</p>
                  </div>
                )}
                {(policy.insurance_card_front_url || policy.insurance_card_back_url) && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-3 flex items-center gap-2">
                      <FileImage className="h-4 w-4" />
                      Insurance Card Images
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      {policy.insurance_card_front_url && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Front</p>
                          <div className="border rounded-lg overflow-hidden bg-muted/30">
                            <img
                              src={policy.insurance_card_front_url}
                              alt="Front of insurance card"
                              className="w-full h-32 object-contain p-2"
                            />
                          </div>
                        </div>
                      )}
                      {policy.insurance_card_back_url && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Back</p>
                          <div className="border rounded-lg overflow-hidden bg-muted/30">
                            <img
                              src={policy.insurance_card_back_url}
                              alt="Back of insurance card"
                              className="w-full h-32 object-contain p-2"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddInsuranceDialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) setEditPolicy(null);
        }}
        customerId={customer?.id}
        tenantId={customer?.tenant_id}
        customerData={customer}
        editPolicy={editPolicy}
        onSubmit={handleAddOrUpdate}
        isSubmitting={isAdding || isUpdating}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Insurance Policy?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate this insurance policy. You can add it again later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeactivating}>
              {isDeactivating ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
