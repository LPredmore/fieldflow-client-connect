import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Client, ClientFormData } from "@/types/client";
import { ContractorSelector } from "@/components/Clients/ContractorSelector";
import { useAuth } from "@/hooks/useAuth";
import { US_STATES } from "@/constants/usStates";

const clientSchema = z.object({
  pat_name_f: z.string().min(1, "First name is required"),
  pat_name_l: z.string().min(1, "Last name is required"),
  pat_name_m: z.string().optional(),
  pat_name_preferred: z.string().optional(),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email("Invalid email format").min(1, "Email is required"),
  pat_addr_1: z.string().optional(),
  pat_addr_2: z.string().optional(),
  pat_city: z.string().optional(),
  pat_state: z.string().optional(),
  pat_zip: z.string().optional(),
  pat_country: z.string().optional(),
  pat_sex: z.string().optional(),
  primary_staff_id: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ClientFormData) => Promise<any>;
  client?: Client | null;
  title: string;
}

export function ClientForm({ open, onOpenChange, onSubmit, client, title }: ClientFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isAdmin } = useAuth();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      pat_name_f: "",
      pat_name_l: "",
      pat_name_m: "",
      pat_name_preferred: "",
      phone: "",
      email: "",
      pat_addr_1: "",
      pat_addr_2: "",
      pat_city: "",
      pat_state: "",
      pat_zip: "",
      pat_country: "US",
      pat_sex: "",
      primary_staff_id: "",
    },
  });

  useEffect(() => {
    if (client) {
      form.reset({
        pat_name_f: client.pat_name_f || "",
        pat_name_l: client.pat_name_l || "",
        pat_name_m: client.pat_name_m || "",
        pat_name_preferred: client.pat_name_preferred || "",
        phone: client.phone || "",
        email: client.email || "",
        pat_addr_1: client.pat_addr_1 || "",
        pat_addr_2: client.pat_addr_2 || "",
        pat_city: client.pat_city || "",
        pat_state: client.pat_state || "",
        pat_zip: client.pat_zip || "",
        pat_country: client.pat_country || "US",
        pat_sex: client.pat_sex || "",
        primary_staff_id: client.primary_staff_id || "",
      });
    } else {
      form.reset({
        pat_name_f: "",
        pat_name_l: "",
        pat_name_m: "",
        pat_name_preferred: "",
        phone: "",
        email: "",
        pat_addr_1: "",
        pat_addr_2: "",
        pat_city: "",
        pat_state: "",
        pat_zip: "",
        pat_country: "US",
        pat_sex: "",
        primary_staff_id: "",
      });
    }
  }, [client, form]);

  const handleSubmit = async (values: ClientFormValues) => {
    setIsSubmitting(true);
    try {
      const formData: ClientFormData = {
        pat_name_f: values.pat_name_f || '',
        pat_name_l: values.pat_name_l || '',
        pat_name_m: values.pat_name_m || undefined,
        pat_name_preferred: values.pat_name_preferred || undefined,
        phone: values.phone || '',
        email: values.email || undefined,
        pat_addr_1: values.pat_addr_1 || undefined,
        pat_addr_2: values.pat_addr_2 || undefined,
        pat_city: values.pat_city || undefined,
        pat_state: values.pat_state || undefined,
        pat_zip: values.pat_zip || undefined,
        pat_country: values.pat_country || 'US',
        pat_sex: (values.pat_sex || undefined) as 'M' | 'F' | '' | undefined,
        primary_staff_id: values.primary_staff_id || undefined,
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
                name="pat_name_preferred"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Name</FormLabel>
                    <FormControl>
                      <Input placeholder="How they'd like to be called" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
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
                    <FormLabel>Email Address *</FormLabel>
                    <FormControl>
                      <Input placeholder="client@example.com" {...field} />
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
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="primary_staff_id"
                render={({ field }) => (
                  <FormItem>
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

              <FormField
                control={form.control}
                name="pat_addr_2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input placeholder="Apt, Suite, Unit, etc." {...field} />
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
                      <Input placeholder="US" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? "Saving..." : "Save Client"}
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
