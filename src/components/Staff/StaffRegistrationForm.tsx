import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useSelfRegistration, type PersonalInfo, type ProfessionalDetails, type LicenseEntry } from "@/hooks/useSelfRegistration";
import { useAuth } from "@/hooks/useAuth";
import { useLicenseTypes } from "@/hooks/useLicenseTypes";
import { US_STATES } from "@/constants/usStates";
import { Loader2, Plus, Trash2 } from "lucide-react";

// Step 1: Personal Information
const personalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: z.string().min(10, "Valid phone number required").max(20),
  email: z.string().email("Valid email required"),
});

// License entry schema
const licenseEntrySchema = z.object({
  state: z.string().min(1, "State is required"),
  licenseNumber: z.string().min(1, "License number is required"),
  issuedOn: z.string().optional(),
  expiresOn: z.string().optional(),
});

// Step 2: Professional Details with multi-license support
const professionalDetailsSchema = z.object({
  isStaff: z.boolean(),
  npiNumber: z.string().optional(),
  taxonomyCode: z.string().optional(),
  bio: z.string().optional(),
  minClientAge: z.number().min(0).max(100).optional(),
  licenseType: z.string().min(1, "License type is required"),
  licenses: z.array(licenseEntrySchema).min(1, "At least one state license is required"),
});

type PersonalInfoForm = z.infer<typeof personalInfoSchema>;
type ProfessionalDetailsForm = z.infer<typeof professionalDetailsSchema>;

export const StaffRegistrationForm = () => {
  const [step, setStep] = useState(1);
  const [personalInfo, setPersonalInfo] = useState<Partial<PersonalInfo>>({});
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { registerSelf, loading } = useSelfRegistration();

  // Get user's specialty (prov_field) to filter license types
  const userSpecialty = user?.staffAttributes?.staffData?.prov_field || null;
  const { licenseTypes, loading: licenseTypesLoading } = useLicenseTypes({ specialty: userSpecialty });

  const personalForm = useForm<PersonalInfoForm>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: user?.user_metadata?.first_name || user?.staffAttributes?.staffData?.prov_name_f || "",
      lastName: user?.user_metadata?.last_name || user?.staffAttributes?.staffData?.prov_name_l || "",
      phone: "",
      email: user?.email || "",
    },
  });

  const professionalForm = useForm<ProfessionalDetailsForm>({
    resolver: zodResolver(professionalDetailsSchema),
    defaultValues: {
      isStaff: true,
      minClientAge: 18,
      licenseType: "",
      licenses: [{ state: "", licenseNumber: "", issuedOn: "", expiresOn: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: professionalForm.control,
    name: "licenses",
  });

  // Update form defaults when user data loads
  useEffect(() => {
    if (user) {
      personalForm.reset({
        firstName: user?.user_metadata?.first_name || user?.staffAttributes?.staffData?.prov_name_f || "",
        lastName: user?.user_metadata?.last_name || user?.staffAttributes?.staffData?.prov_name_l || "",
        phone: "",
        email: user?.email || "",
      });
    }
  }, [user, personalForm]);

  const handlePersonalInfoSubmit = personalForm.handleSubmit((data) => {
    setPersonalInfo(data);
    setStep(2);
  });

  const handleProfessionalDetailsSubmit = professionalForm.handleSubmit(async (data) => {
    if (!personalInfo || !user?.id) return;

    // Validate required fields
    if (!personalInfo.firstName || !personalInfo.lastName || !personalInfo.phone || !personalInfo.email) {
      toast({
        title: "Missing Information",
        description: "Please complete all required personal information fields.",
        variant: "destructive",
      });
      return;
    }

    // Validate that license type is selected
    if (!data.licenseType) {
      toast({
        title: "Missing License Type",
        description: "Please select your primary license type.",
        variant: "destructive",
      });
      return;
    }

    // Validate that at least one license has state and number
    const validLicenses = data.licenses.filter(l => l.state && l.licenseNumber);
    if (validLicenses.length === 0) {
      toast({
        title: "Missing License Information",
        description: "Please add at least one state license with a license number.",
        variant: "destructive",
      });
      return;
    }

    // Create validated registration data
    const validatedPersonalInfo: PersonalInfo = {
      firstName: personalInfo.firstName!,
      lastName: personalInfo.lastName!,
      phone: personalInfo.phone!,
      email: personalInfo.email!,
    };

    // Transform licenses to the format expected by useSelfRegistration
    const licenseEntries: LicenseEntry[] = validLicenses.map(l => ({
      state: l.state,
      licenseNumber: l.licenseNumber,
      issuedOn: l.issuedOn || null,
      expiresOn: l.expiresOn || null,
    }));

    const validatedProfessionalDetails: ProfessionalDetails = {
      isStaff: data.isStaff,
      npiNumber: data.npiNumber,
      taxonomyCode: data.taxonomyCode,
      bio: data.bio,
      minClientAge: data.minClientAge,
      licenseType: data.licenseType,
      licenses: licenseEntries,
    };

    const result = await registerSelf({
      personalInfo: validatedPersonalInfo,
      professionalDetails: validatedProfessionalDetails,
      profileId: user.id,
    });

    if (result.error) {
      toast({
        title: "Registration Failed",
        description: result.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Registration Complete",
        description: "Your staff profile has been created successfully.",
      });
      // Force full page reload to ensure auth context gets fresh prov_status from DB
      window.location.href = '/staff/dashboard';
    }
  });

  const addLicenseEntry = () => {
    append({ state: "", licenseNumber: "", issuedOn: "", expiresOn: "" });
  };

  const removeLicenseEntry = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Staff Registration</CardTitle>
        <CardDescription>
          Step {step} of 2
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Step 1: Personal Information */}
        {step === 1 && (
          <form onSubmit={handlePersonalInfoSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" {...personalForm.register("firstName")} />
              {personalForm.formState.errors.firstName && (
                <p className="text-sm text-destructive">{personalForm.formState.errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input id="lastName" {...personalForm.register("lastName")} />
              {personalForm.formState.errors.lastName && (
                <p className="text-sm text-destructive">{personalForm.formState.errors.lastName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input id="phone" type="tel" {...personalForm.register("phone")} />
              {personalForm.formState.errors.phone && (
                <p className="text-sm text-destructive">{personalForm.formState.errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" {...personalForm.register("email")} disabled />
              {personalForm.formState.errors.email && (
                <p className="text-sm text-destructive">{personalForm.formState.errors.email.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full">Next</Button>
          </form>
        )}

        {/* Step 2: Professional Details */}
        {step === 2 && (
          <form onSubmit={handleProfessionalDetailsSubmit} className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="isStaff"
                checked={professionalForm.watch("isStaff")}
                onCheckedChange={(checked) => professionalForm.setValue("isStaff", checked)}
              />
              <Label htmlFor="isStaff">I am a licensed clinical staff member</Label>
            </div>

            {professionalForm.watch("isStaff") && (
              <>
                {/* Primary License Type - Required, filtered by specialty */}
                <div className="space-y-2">
                  <Label htmlFor="licenseType">Primary License Type *</Label>
                  {licenseTypesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading license types...
                    </div>
                  ) : (
                    <Select
                      value={professionalForm.watch("licenseType")}
                      onValueChange={(value) => professionalForm.setValue("licenseType", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your license type" />
                      </SelectTrigger>
                      <SelectContent>
                        {licenseTypes.map((type) => (
                          <SelectItem key={type.id} value={type.license_code}>
                            {type.license_label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {professionalForm.formState.errors.licenseType && (
                    <p className="text-sm text-destructive">{professionalForm.formState.errors.licenseType.message}</p>
                  )}
                  {userSpecialty && (
                    <p className="text-xs text-muted-foreground">
                      Showing license types for: {userSpecialty}
                    </p>
                  )}
                </div>

                {/* State Licenses - Multi-entry */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>State Licenses *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addLicenseEntry}
                      className="flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Add Another State
                    </Button>
                  </div>

                  {fields.map((field, index) => (
                    <div key={field.id} className="space-y-3 p-4 border rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">License {index + 1}</span>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLicenseEntry(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {/* State and License Number - Same Row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`licenses.${index}.state`}>State *</Label>
                          <Select
                            value={professionalForm.watch(`licenses.${index}.state`)}
                            onValueChange={(value) => professionalForm.setValue(`licenses.${index}.state`, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {US_STATES.map((state) => (
                                <SelectItem key={state.value} value={state.value}>
                                  {state.value} - {state.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`licenses.${index}.licenseNumber`}>License Number *</Label>
                          <Input
                            {...professionalForm.register(`licenses.${index}.licenseNumber`)}
                            placeholder="Enter license number"
                          />
                        </div>
                      </div>

                      {/* Issue and Expiration Dates - Same Row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`licenses.${index}.issuedOn`}>Issued On</Label>
                          <Input
                            type="date"
                            {...professionalForm.register(`licenses.${index}.issuedOn`)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`licenses.${index}.expiresOn`}>Expires On</Label>
                          <Input
                            type="date"
                            {...professionalForm.register(`licenses.${index}.expiresOn`)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {professionalForm.formState.errors.licenses && (
                    <p className="text-sm text-destructive">
                      {professionalForm.formState.errors.licenses.message || "Please add valid license information"}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="npiNumber">NPI Number</Label>
                  <Input id="npiNumber" {...professionalForm.register("npiNumber")} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxonomyCode">Taxonomy Code</Label>
                  <Input id="taxonomyCode" {...professionalForm.register("taxonomyCode")} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Professional Bio</Label>
                  <Textarea id="bio" {...professionalForm.register("bio")} rows={4} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minClientAge">Minimum Client Age</Label>
                  <Input
                    id="minClientAge"
                    type="number"
                    {...professionalForm.register("minClientAge", { valueAsNumber: true })}
                  />
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete Registration"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default StaffRegistrationForm;
