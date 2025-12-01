import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, MoreVertical, Pencil, Trash2, Mail, Phone, MapPin, User } from "lucide-react";
import { useCustomers, Customer } from "@/hooks/useCustomers";
import { CustomerFormData } from "@/types/customer";
import { CustomerForm } from "@/components/Customers/CustomerForm";
import { CustomerStatsCards } from "@/components/Customers/CustomerStatsCards";
import { getCustomerDisplayName } from "@/utils/customerDisplayName";

export default function Customers() {
  console.log('📄 [Customers] Component mounted/rendered - DIAGNOSTIC VERSION v2024.11.24.001');
  
  const { customers, loading, stats, createCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);

  // Filter and search customers
  const filteredCustomers = useMemo(() => {
    let filtered = customers;

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(customer =>
        (customer.full_name && customer.full_name.toLowerCase().includes(searchLower)) ||
        customer.email?.toLowerCase().includes(searchLower) ||
        customer.pat_phone?.toLowerCase().includes(searchLower) ||
        customer.pat_city?.toLowerCase().includes(searchLower) ||
        customer.preferred_name?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [customers, searchTerm]);


  const handleEditCustomer = async (data: CustomerFormData) => {
    if (editingCustomer) {
      await updateCustomer(editingCustomer.id, data);
      setEditingCustomer(null);
    }
  };

  const handleDeleteCustomer = async () => {
    if (deletingCustomer) {
      await deleteCustomer(deletingCustomer.id);
      setDeletingCustomer(null);
    }
  };

  const formatAddress = (customer: Customer) => {
    const parts = [
      customer.pat_addr_1,
      customer.pat_city,
      customer.pat_state,
      customer.pat_zip
    ].filter(Boolean);
    return parts.join(', ') || 'No address provided';
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full">
        <div className="p-6 lg:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Patients</h1>
              <p className="text-muted-foreground mt-1">Manage your patient records</p>
            </div>
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Patient
            </Button>
          </div>

          {/* Stats */}
          <CustomerStatsCards stats={stats} />

          {/* Search and Filters */}
          <Card className="shadow-material-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search patients by name, email, phone, or city..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Grid */}
          {!loading && filteredCustomers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredCustomers.map((customer) => (
                <Card key={customer.id} className="shadow-material-md hover:shadow-material-lg transition-shadow duration-normal">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{getCustomerDisplayName(customer)}</CardTitle>
                        {customer.preferred_name && (
                          <p className="text-sm text-muted-foreground mt-1">Prefers: {customer.preferred_name}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={customer.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                            {customer.status || 'New'}
                          </Badge>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingCustomer(customer)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeletingCustomer(customer)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Contact Information */}
                    <div className="space-y-2">
                      {customer.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{customer.email}</span>
                        </div>
                      )}
                      {customer.pat_phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{customer.pat_phone}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground">{formatAddress(customer)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Assigned: {customer.assigned_user_name || 'Unassigned'}
                        </span>
                      </div>
                    </div>

                    {customer.notes && (
                      <div className="pt-4 mt-4 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">Notes:</p>
                        <p className="text-sm text-foreground line-clamp-2">{customer.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredCustomers.length === 0 && (
            <Card className="shadow-material-sm">
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <div className="bg-muted/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      {searchTerm ? 'No patients found' : 'No patients yet'}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {searchTerm 
                        ? 'Try adjusting your search criteria' 
                        : 'Get started by adding your first patient'}
                    </p>
                    {!searchTerm && (
                      <Button onClick={() => setIsFormOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Patient
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {loading && (
            <Card className="shadow-material-sm">
              <CardContent className="py-12">
                <div className="text-center">
                  <p className="text-muted-foreground">Loading patients...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Create Customer Dialog */}
          <CustomerForm
            open={isFormOpen}
            onOpenChange={setIsFormOpen}
            onSubmit={async (data) => {
              await createCustomer(data);
            }}
            title="Add New Patient"
          />

          {/* Edit Customer Dialog */}
          <CustomerForm
            open={!!editingCustomer}
            onOpenChange={(open) => !open && setEditingCustomer(null)}
            onSubmit={handleEditCustomer}
            customer={editingCustomer}
            title="Edit Patient"
          />

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={!!deletingCustomer} onOpenChange={(open) => !open && setDeletingCustomer(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Patient</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{deletingCustomer?.full_name || 'this patient'}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteCustomer} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}