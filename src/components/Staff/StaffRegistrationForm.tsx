import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useSelfRegistration, type PersonalInfo, type ProfessionalDetails } from "@/hooks/useSelfRegistration";
import { useAuth } from "@/hooks/useAuth";
import { STAFF_CLINICAL_SPECIALTIES } from "@/constants/staffFields";
import { Loader2 } from "lucide-react";


// Step 1: Personal Information
const personalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: z.string().min(10, "Valid phone number required").max(20),
  email: z.string().email("Valid email required"),
});

// Step 2: Professional Details (with optional single license)
const professionalDetailsSchema = z.object({
  isStaff: z.boolean(),
  clinicalSpecialty: z.string().optional(),
  npiNumber: z.string().optional(),
  taxonomyCode: z.string().optional(),
  bio: z.string().optional(),
  minClientAge: z.number().min(0).max(100).optional(),
  acceptingNewClients: z.enum(['Yes', 'No']).optional(),
  licenseType: z.string().optional(),
  licenseNumber: z.string().optional(),
});

type PersonalInfoForm = z.infer<typeof personalInfoSchema>;
type ProfessionalDetailsForm = z.infer<typeof professionalDetailsSchema>;

export const StaffRegistrationForm = () => {
  const [step, setStep] = useState(1);
  const [personalInfo, setPersonalInfo] = useState<Partial<PersonalInfo>>({});
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { registerSelf, loading } = useSelfRegistration();

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
      isStaff: true,
      acceptingNewClients: 'Yes',
      minClientAge: 18,
    },
  });

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

    // Create validated registration data
    const validatedPersonalInfo: PersonalInfo = {
      firstName: personalInfo.firstName!,
      lastName: personalInfo.lastName!,
      phone: personalInfo.phone!,
      email: personalInfo.email!,
    };

    const validatedProfessionalDetails: ProfessionalDetails = {
      isStaff: data.isStaff,
      clinicalSpecialty: data.clinicalSpecialty,
      npiNumber: data.npiNumber,
      taxonomyCode: data.taxonomyCode,
      bio: data.bio,
      minClientAge: data.minClientAge,
      acceptingNewClients: data.acceptingNewClients,
      licenseType: data.licenseType,
      licenseNumber: data.licenseNumber,
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
      navigate('/staff/dashboard');
    }
  });

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
                <div className="space-y-2">
                  <Label htmlFor="clinicalSpecialty">Clinical Specialty *</Label>
                  <Select
                    onValueChange={(value) => professionalForm.setValue("clinicalSpecialty", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your specialty" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_CLINICAL_SPECIALTIES.map((field) => (
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

                <div className="space-y-2">
                  <Label htmlFor="licenseType">Primary License Type (Optional)</Label>
                  <Input id="licenseType" {...professionalForm.register("licenseType")} placeholder="e.g., LCSW, LPC" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">Primary License Number (Optional)</Label>
                  <Input id="licenseNumber" {...professionalForm.register("licenseNumber")} />
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
