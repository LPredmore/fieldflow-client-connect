import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Loader2, Copy, Check } from "lucide-react";
import { useAddStaff } from "@/hooks/useAddStaff";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const SPECIALTY_OPTIONS = [
  { value: "Mental Health", label: "Mental Health" },
  { value: "Speech Therapy", label: "Speech Therapy" },
  { value: "Occupational Therapy", label: "Occupational Therapy" },
];

const ROLE_OPTIONS = [
  { code: "SUPERVISOR", label: "Supervisor", description: "Clinical Supervisor" },
  { code: "CLINICIAN", label: "Clinician", description: "Clinical Provider" },
  { code: "ADMIN", label: "Admin", description: "Administrative Access" },
  { code: "BILLING", label: "Billing", description: "Billing Access" },
  { code: "OFFICE", label: "Office", description: "Office Staff - Non-Clinical" },
];

const CLINICAL_ROLES = ["SUPERVISOR", "CLINICIAN"];

const addStaffSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  specialty: z.string().optional(),
  roles: z.array(z.string()).min(1, "At least one role must be selected"),
}).refine((data) => {
  const hasClinicalRole = data.roles.some(role => 
    CLINICAL_ROLES.includes(role)
  );
  // If clinical role selected, specialty must be provided
  if (hasClinicalRole && !data.specialty) {
    return false;
  }
  return true;
}, {
  message: "Specialty is required for clinical roles",
  path: ["specialty"],
});

type AddStaffFormData = z.infer<typeof addStaffSchema>;

interface AddStaffDialogProps {
  onSuccess?: () => void;
}

export function AddStaffDialog({ onSuccess }: AddStaffDialogProps) {
  const [open, setOpen] = useState(false);
  const [successData, setSuccessData] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const { createStaff, loading } = useAddStaff();
  const { tenantId } = useAuth();
  const { toast } = useToast();

  const form = useForm<AddStaffFormData>({
    resolver: zodResolver(addStaffSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      specialty: undefined,
      roles: [],
    },
  });

  const selectedRoles = form.watch("roles");
  const hasClinicalRole = selectedRoles.some((role) => CLINICAL_ROLES.includes(role));

  const onSubmit = async (data: AddStaffFormData) => {
    if (!tenantId) {
      toast({
        title: "Error",
        description: "No tenant ID found. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    const result = await createStaff({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      specialty: hasClinicalRole ? data.specialty : undefined,
      roles: data.roles,
      tenantId,
    });

    if (result.success && result.password) {
      setSuccessData({ email: data.email, password: result.password });
      onSuccess?.();
    }
  };

  const handleCopyPassword = async () => {
    if (successData?.password) {
      await navigator.clipboard.writeText(successData.password);
      setCopied(true);
      toast({
        title: "Copied",
        description: "Password copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setSuccessData(null);
    setCopied(false);
    form.reset();
  };

  const handleRoleChange = (roleCode: string, checked: boolean) => {
    const currentRoles = form.getValues("roles");
    if (checked) {
      form.setValue("roles", [...currentRoles, roleCode], { shouldValidate: true });
    } else {
      form.setValue(
        "roles",
        currentRoles.filter((r) => r !== roleCode),
        { shouldValidate: true }
      );
      // Clear specialty if no clinical roles remain
      const remainingRoles = currentRoles.filter((r) => r !== roleCode);
      if (!remainingRoles.some((r) => CLINICAL_ROLES.includes(r))) {
        form.setValue("specialty", undefined);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (isOpen ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add New Staff Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        {successData ? (
          <>
            <DialogHeader>
              <DialogTitle>Staff Member Created</DialogTitle>
              <DialogDescription>
                The new staff member has been created successfully. Share the login credentials below.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-sm font-mono">{successData.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Temporary Password</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono bg-background px-2 py-1 rounded border flex-1">
                      {successData.password}
                    </p>
                    <Button variant="outline" size="sm" onClick={handleCopyPassword}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Please share these credentials securely with the new staff member.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add New Staff Member</DialogTitle>
              <DialogDescription>
                Create a new staff account. They will receive login credentials upon creation.
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
                  name="roles"
                  render={() => (
                    <FormItem>
                      <FormLabel>Roles</FormLabel>
                      <div className="space-y-2">
                        {ROLE_OPTIONS.map((role) => (
                          <div key={role.code} className="flex items-center space-x-3">
                            <Checkbox
                              id={`role-${role.code}`}
                              checked={selectedRoles.includes(role.code)}
                              onCheckedChange={(checked) =>
                                handleRoleChange(role.code, checked as boolean)
                              }
                            />
                            <label
                              htmlFor={`role-${role.code}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {role.label}
                              <span className="text-muted-foreground font-normal ml-2">
                                ({role.description})
                              </span>
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {hasClinicalRole && (
                  <FormField
                    control={form.control}
                    name="specialty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Specialty</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a specialty" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SPECIALTY_OPTIONS.map((specialty) => (
                              <SelectItem key={specialty.value} value={specialty.value}>
                                {specialty.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Staff Member
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
