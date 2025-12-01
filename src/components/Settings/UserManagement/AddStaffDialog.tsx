import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus } from "lucide-react";
import { useStaffRegistration } from "@/hooks/useStaffRegistration";
import { US_STATES } from "@/constants/usStates";
import { useLicenseTypes } from "@/hooks/useLicenseTypes";

const addStaffSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Please enter a valid email address"),
  specialty: z.string().min(1, "Specialty is required"),
  npiNumber: z.string().min(1, "NPI number is required"),
  primaryState: z.string().min(1, "Primary state is required"),
  licenseType: z.string().min(1, "License type is required"),
  licenseNumber: z.string().min(1, "License number is required"),
  taxonomy: z.string().min(1, "Taxonomy is required"),
});

type AddStaffFormData = z.infer<typeof addStaffSchema>;

interface AddStaffDialogProps {
  onSuccess?: () => void;
}

export function AddStaffDialog({ onSuccess }: AddStaffDialogProps) {
  const [open, setOpen] = useState(false);
  const { registerStaff, loading } = useStaffRegistration();
  const { licenseTypes, uniqueSpecialties, loading: licenseTypesLoading } = useLicenseTypes();

  const uniqueLicenses = Array.from(
    new Set(licenseTypes.map((lt) => lt.license).filter(Boolean))
  ) as string[];

  const form = useForm<AddStaffFormData>({
    resolver: zodResolver(addStaffSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      specialty: "",
      npiNumber: "",
      primaryState: "",
      licenseType: "",
      licenseNumber: "",
      taxonomy: "",
    },
  });

  const onSubmit = async (data: AddStaffFormData) => {
    // Transform form data to match registration format
    const registrationData = {
      personalInfo: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: "", // Will need to be collected or made optional
        email: data.email,
      },
      professionalDetails: {
        isClinician: true,
        clinicianField: data.specialty,
        npiNumber: data.npiNumber,
        taxonomyCode: data.taxonomy,
        licenseType: data.licenseType,
        licenseNumber: data.licenseNumber,
      },
      profileId: "", // Will be set after user creation in actual flow
    };
    
    const result = await registerStaff(registrationData);
    
    if (!result.error) {
      form.reset();
      setOpen(false);
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Staff
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Staff Member</DialogTitle>
          <DialogDescription>
            Enter the staff member's information. They will receive an email invitation to set up their account.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john.doe@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="specialty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specialty</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a specialty" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px]">
                      {uniqueSpecialties.map((specialty) => (
                        <SelectItem key={specialty} value={specialty}>
                          {specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="npiNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NPI Number</FormLabel>
                    <FormControl>
                      <Input placeholder="1234567890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="primaryState"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary State Licensed</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a state" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[300px]">
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="licenseType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a license type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[300px]">
                        {uniqueLicenses.map((license) => (
                          <SelectItem key={license} value={license}>
                            {license}
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
                name="licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Number</FormLabel>
                    <FormControl>
                      <Input placeholder="License #" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="taxonomy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Taxonomy</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 103T00000X" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || licenseTypesLoading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Invitation...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Send Invitation
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
