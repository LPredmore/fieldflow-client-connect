import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Customer } from "@/hooks/useCustomers";
import { CustomerFormData } from "@/types/customer";
import { ContractorSelector } from "@/components/Customers/ContractorSelector";
import { useAuth } from "@/hooks/useAuth";
import { US_STATES } from "@/constants/usStates";

const customerSchema = z.object({
  pat_name_f: z.string().min(1, "First name is required"),
  pat_name_l: z.string().min(1, "Last name is required"),
  pat_name_m: z.string().optional(),
  preferred_name: z.string().optional(),
  pat_phone: z.string().min(1, "Phone number is required"),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  pat_addr_1: z.string().optional(),
  pat_city: z.string().optional(),
  pat_state: z.string().optional(),
  pat_zip: z.string().optional(),
  pat_country: z.string().optional(),
  pat_dob: z.string().optional(),
  pat_sex: z.string().optional(),
  gender_identity: z.string().optional(),
  timezone: z.string().optional(),
  notes: z.string().optional(),
  assigned_to_user_id: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface CustomerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CustomerFormData) => Promise<void>;
  customer?: Customer | null;
  title: string;
}

export function CustomerForm({ open, onOpenChange, onSubmit, customer, title }: CustomerFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isAdmin } = useAuth();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      pat_name_f: "",
      pat_name_l: "",
      pat_name_m: "",
      preferred_name: "",
      pat_phone: "",
      email: "",
      pat_addr_1: "",
      pat_city: "",
      pat_state: "",
      pat_zip: "",
      pat_country: "USA",
      pat_dob: "",
      pat_sex: "",
      gender_identity: "",
      timezone: "America/New_York",
      notes: "",
      assigned_to_user_id: "",
    },
  });

  useEffect(() => {
    if (customer) {
      form.reset({
        pat_name_f: customer.pat_name_f || "",
        pat_name_l: customer.pat_name_l || "",
        pat_name_m: customer.pat_name_m || "",
        preferred_name: customer.preferred_name || "",
        pat_phone: customer.pat_phone || "",
        email: customer.email || "",
        pat_addr_1: customer.pat_addr_1 || "",
        pat_city: customer.pat_city || "",
        pat_state: customer.pat_state || "",
        pat_zip: customer.pat_zip || "",
        pat_country: customer.pat_country || "USA",
        pat_dob: customer.pat_dob || "",
        pat_sex: customer.pat_sex || "",
        gender_identity: customer.gender_identity || "",
        timezone: customer.timezone || "America/New_York",
        notes: customer.notes || "",
        assigned_to_user_id: customer.assigned_to_user_id || "",
      });
    } else {
      form.reset({
        pat_name_f: "",
        pat_name_l: "",
        pat_name_m: "",
        preferred_name: "",
        pat_phone: "",
        email: "",
        pat_addr_1: "",
        pat_city: "",
        pat_state: "",
        pat_zip: "",
        pat_country: "USA",
        pat_dob: "",
        pat_sex: "",
        gender_identity: "",
        timezone: "America/New_York",
        notes: "",
        assigned_to_user_id: "",
      });
    }
  }, [customer, form]);

  const handleSubmit = async (values: CustomerFormValues) => {
    setIsSubmitting(true);
    try {
    const formData: CustomerFormData = {
      pat_name_f: values.pat_name_f || '',
      pat_name_l: values.pat_name_l || '',
      pat_name_m: values.pat_name_m || undefined,
      preferred_name: values.preferred_name || undefined,
      pat_phone: values.pat_phone || '',
      email: values.email || undefined,
      pat_addr_1: values.pat_addr_1 || undefined,
      pat_city: values.pat_city || undefined,
      pat_state: values.pat_state || undefined,
      pat_zip: values.pat_zip || undefined,
      pat_country: values.pat_country || 'USA',
      pat_dob: values.pat_dob || undefined,
      pat_sex: (values.pat_sex || undefined) as 'M' | 'F' | 'Other' | '' | undefined,
      gender_identity: values.gender_identity || undefined,
      timezone: values.timezone || 'America/New_York',
      notes: values.notes || undefined,
      assigned_to_user_id: values.assigned_to_user_id || undefined,
    };

      await onSubmit(formData);
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pat_name_f"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter first name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pat_name_l"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter last name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pat_name_m"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Middle Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preferred_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Name</FormLabel>
                    <FormControl>
                      <Input placeholder="How you'd like to be called" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pat_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="(555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="patient@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pat_sex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Biological Sex</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sex" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="M">Male</SelectItem>
                        <SelectItem value="F">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assigned_to_user_id"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>
                      Assigned Clinician {!isAdmin && '(View Only)'}
                    </FormLabel>
                    <ContractorSelector
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!isAdmin}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Address Information</h3>
              
              <FormField
                control={form.control}
                name="pat_addr_1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main Street" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="pat_city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Springfield" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pat_state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {US_STATES.map((state) => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pat_zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP Code</FormLabel>
                      <FormControl>
                        <Input placeholder="12345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="pat_country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="USA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about this patient..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? "Saving..." : "Save Patient"}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}