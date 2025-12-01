import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { useStaffRegistration, type PersonalInfo, type ProfessionalDetails, type License } from "@/hooks/useStaffRegistration";
import { useAuth } from "@/hooks/useAuth";
import { CLINICIAN_FIELDS } from "@/constants/clinicianFields";
import { Loader2 } from "lucide-react";

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
] as const;

// Step 1: Personal Information
const personalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: z.string().min(10, "Valid phone number required").max(20),
  email: z.string().email("Valid email required"),
});

// Step 2: Professional Details
const professionalDetailsSchema = z.object({
  isClinician: z.boolean(),
  clinicianField: z.string().optional(),
  npiNumber: z.string().optional(),
  taxonomyCode: z.string().optional(),
  bio: z.string().optional(),
  minClientAge: z.number().min(0).max(100).optional(),
  acceptingNewClients: z.enum(['Yes', 'No']).optional(),
});

// Step 3: License Information
const licenseSchema = z.object({
  licenseNumber: z.string().min(1, "License number required"),
  licenseType: z.string().min(1, "License type required"),
  state: z.enum(US_STATES, { required_error: "State required" }),
  issueDate: z.string().optional(),
  expirationDate: z.string().min(1, "Expiration date required"),
  isPrimary: z.boolean().default(false),
});

type PersonalInfoForm = z.infer<typeof personalInfoSchema>;
type ProfessionalDetailsForm = z.infer<typeof professionalDetailsSchema>;
type LicenseForm = z.infer<typeof licenseSchema>;

export const StaffRegistrationForm = () => {
  const [step, setStep] = useState(1);
  const [personalInfo, setPersonalInfo] = useState<Partial<PersonalInfo>>({});
  const [professionalDetails, setProfessionalDetails] = useState<Partial<ProfessionalDetails>>({});
  const [licenses, setLicenses] = useState<License[]>([]);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { registerStaff, loading } = useStaffRegistration();

  const personalForm = useForm<PersonalInfoForm>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: user?.email || "",
    },
  });

  const professionalForm = useForm<ProfessionalDetailsForm>({
    resolver: zodResolver(professionalDetailsSchema),
    defaultValues: {
      isClinician: true,
      acceptingNewClients: 'Yes',
      minClientAge: 18,
    },
  });

  const licenseForm = useForm<LicenseForm>({
    resolver: zodResolver(licenseSchema),
    defaultValues: {
      isPrimary: licenses.length === 0,
    },
  });

  const handlePersonalInfoSubmit = personalForm.handleSubmit((data) => {
    setPersonalInfo(data);
    setStep(2);
  });

  const handleProfessionalDetailsSubmit = professionalForm.handleSubmit((data) => {
    setProfessionalDetails(data);
    if (data.isClinician) {
      setStep(3);
    } else {
      // Non-clinicians can skip license step
      handleFinalSubmit(data, []);
    }
  });

  const handleAddLicense = licenseForm.handleSubmit((data) => {
    // Convert form data to License (validated by Zod)
    const newLicense: License = {
      licenseNumber: data.licenseNumber!,
      licenseType: data.licenseType!,
      state: data.state!,
      issueDate: data.issueDate,
      expirationDate: data.expirationDate!,
      isPrimary: data.isPrimary!,
    };
    setLicenses([...licenses, newLicense]);
    licenseForm.reset({ isPrimary: false });
    toast({
      title: "License Added",
      description: "License information has been added successfully.",
    });
  });

  const handleRemoveLicense = (index: number) => {
    setLicenses(licenses.filter((_, i) => i !== index));
  };

  const handleFinalSubmit = async (profDetails: Partial<ProfessionalDetails>, finalLicenses: License[]) => {
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

    if (profDetails.isClinician === undefined) {
      toast({
        title: "Missing Information",
        description: "Please specify if you are a clinician.",
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

    const validatedProfessionalDetails: ProfessionalDetails = {
      isClinician: profDetails.isClinician!,
      clinicianField: profDetails.clinicianField,
      npiNumber: profDetails.npiNumber,
      taxonomyCode: profDetails.taxonomyCode,
      bio: profDetails.bio,
      minClientAge: profDetails.minClientAge,
      acceptingNewClients: profDetails.acceptingNewClients,
    };

    const result = await registerStaff({
      personalInfo: validatedPersonalInfo,
      professionalDetails: validatedProfessionalDetails,
      licenses: finalLicenses,
      userId: user.id,
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
    }
  };

  const handleCompleteLicenses = () => {
    if (licenses.length === 0) {
      toast({
        title: "License Required",
        description: "Please add at least one license to continue.",
        variant: "destructive",
      });
      return;
    }
    handleFinalSubmit(professionalDetails!, licenses);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Staff Registration</CardTitle>
        <CardDescription>
          Step {step} of {professionalDetails?.isClinician === false ? 2 : 3}
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
                id="isClinician"
                checked={professionalForm.watch("isClinician")}
                onCheckedChange={(checked) => professionalForm.setValue("isClinician", checked)}
              />
              <Label htmlFor="isClinician">I am a licensed clinician</Label>
            </div>

            {professionalForm.watch("isClinician") && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="clinicianField">Clinical Specialty *</Label>
                  <Select
                    onValueChange={(value) => professionalForm.setValue("clinicianField", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your specialty" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLINICIAN_FIELDS.map((field) => (
                        <SelectItem key={field} value={field}>{field}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

                <div className="space-y-2">
                  <Label htmlFor="acceptingNewClients">Accepting New Clients</Label>
                  <Select
                    onValueChange={(value: 'Yes' | 'No') => professionalForm.setValue("acceptingNewClients", value)}
                    defaultValue="Yes"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : professionalForm.watch("isClinician") ? "Next" : "Complete"}
              </Button>
            </div>
          </form>
        )}

        {/* Step 3: Licenses */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Add Professional Licenses</h3>
              
              {licenses.length > 0 && (
                <div className="mb-4 space-y-2">
                  {licenses.map((license, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{license.licenseType} - {license.state}</p>
                        <p className="text-sm text-muted-foreground">License #: {license.licenseNumber}</p>
                        {license.isPrimary && <span className="text-xs text-primary">Primary License</span>}
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveLicense(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddLicense} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="licenseType">License Type *</Label>
                  <Input id="licenseType" {...licenseForm.register("licenseType")} placeholder="e.g., LCSW, LPC" />
                  {licenseForm.formState.errors.licenseType && (
                    <p className="text-sm text-destructive">{licenseForm.formState.errors.licenseType.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">License Number *</Label>
                  <Input id="licenseNumber" {...licenseForm.register("licenseNumber")} />
                  {licenseForm.formState.errors.licenseNumber && (
                    <p className="text-sm text-destructive">{licenseForm.formState.errors.licenseNumber.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Select onValueChange={(value) => licenseForm.setValue("state", value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {licenseForm.formState.errors.state && (
                    <p className="text-sm text-destructive">{licenseForm.formState.errors.state.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="issueDate">Issue Date</Label>
                    <Input id="issueDate" type="date" {...licenseForm.register("issueDate")} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expirationDate">Expiration Date *</Label>
                    <Input id="expirationDate" type="date" {...licenseForm.register("expirationDate")} />
                    {licenseForm.formState.errors.expirationDate && (
                      <p className="text-sm text-destructive">{licenseForm.formState.errors.expirationDate.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isPrimary"
                    checked={licenseForm.watch("isPrimary")}
                    onCheckedChange={(checked) => licenseForm.setValue("isPrimary", checked)}
                  />
                  <Label htmlFor="isPrimary">This is my primary license</Label>
                </div>

                <Button type="submit" variant="outline" className="w-full">Add License</Button>
              </form>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button
                type="button"
                onClick={handleCompleteLicenses}
                className="flex-1"
                disabled={loading || licenses.length === 0}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete Registration"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StaffRegistrationForm;
