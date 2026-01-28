import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Briefcase, Award, Camera, Users, Lock, Upload, Banknote, Calendar as CalendarIcon } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useStaffData } from '@/hooks/useStaffData';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LicenseManagement } from '@/components/Staff/LicenseManagement';
import { US_STATES } from '@/constants/usStates';
import { useTreatmentApproachOptions } from '@/hooks/useTreatmentApproachOptions';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { DB_ENUMS } from '@/schema/enums';
import { usePayrollRecipient } from '@/hooks/usePayrollRecipient';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const TIMEZONE_LABELS: Record<string, string> = {
  'America/New_York': 'Eastern Time (ET)',
  'America/Chicago': 'Central Time (CT)',
  'America/Denver': 'Mountain Time (MT)',
  'America/Phoenix': 'Arizona (MST)',
  'America/Los_Angeles': 'Pacific Time (PT)',
  'America/Anchorage': 'Alaska Time (AKT)',
  'Pacific/Honolulu': 'Hawaii Time (HST)',
  'America/Puerto_Rico': 'Atlantic Time (AST)',
  'Pacific/Guam': 'Chamorro Time (ChST)',
  'Pacific/Pago_Pago': 'Samoa Time (SST)',
};

export default function Profile() {
  const { profile, loading: profileLoading, updatePassword } = useProfile();
  const { staff, loading: staffLoading, updateStaffInfo, refetchStaff } = useStaffData();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Fetch treatment approach options based on specialty
  const { 
    options: treatmentApproachOptions, 
    loading: treatmentApproachesLoading 
  } = useTreatmentApproachOptions({ specialty: staff?.prov_field });

  // Professional Information form state
  const [professionalInfo, setProfessionalInfo] = useState({
    prov_name_f: '',
    prov_name_m: '',
    prov_name_l: '',
    prov_phone: '',
    email: '',
    prov_addr_1: '',
    prov_addr_2: '',
    prov_city: '',
    prov_state: '',
    prov_zip: '',
    prov_time_zone: '',
    prov_dob: '',
  });

  // Licensing & Credentials form state
  const [credentials, setCredentials] = useState({
    prov_npi: '',
    prov_taxonomy: '',
    prov_degree: '',
  });

  // Client Facing Information form state
  const [clientInfo, setClientInfo] = useState({
    prov_name_for_clients: '',
    prov_bio: '',
    prov_min_client_age: 18,
    prov_accepting_new_clients: false,
    prov_treatment_approaches: [] as string[],
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  // Direct Deposit form state
  const [directDeposit, setDirectDeposit] = useState({
    recipient_name: '',
    deposit_addr_1: '',
    deposit_addr_2: '',
    deposit_city: '',
    deposit_state: '',
    deposit_zip: '',
    routing_number: '',
    account_number: '',
    account_type: '',
  });

  // Payroll recipient hook
  const { 
    payrollRecipient, 
    loading: payrollLoading, 
    saving: payrollSaving,
    upsertPayrollRecipient 
  } = usePayrollRecipient(staff?.id);

  // Sync professional info from staff and profile
  useEffect(() => {
    if (staff && profile) {
      setProfessionalInfo({
        prov_name_f: staff.prov_name_f || '',
        prov_name_m: staff.prov_name_m || '',
        prov_name_l: staff.prov_name_l || '',
        prov_phone: staff.prov_phone || '',
        email: profile.email || '',
        prov_addr_1: staff.prov_addr_1 || '',
        prov_addr_2: staff.prov_addr_2 || '',
        prov_city: staff.prov_city || '',
        prov_state: staff.prov_state || '',
        prov_zip: staff.prov_zip || '',
        prov_time_zone: staff.prov_time_zone || '',
        prov_dob: staff.prov_dob || '',
      });
    }
  }, [staff, profile]);

  // Sync credentials from staff
  useEffect(() => {
    if (staff) {
      setCredentials({
        prov_npi: staff.prov_npi || '',
        prov_taxonomy: staff.prov_taxonomy || '',
        prov_degree: staff.prov_degree || '',
      });
    }
  }, [staff]);

  // Sync client-facing info from staff
  useEffect(() => {
    if (staff) {
      setClientInfo({
        prov_name_for_clients: staff.prov_name_for_clients || '',
        prov_bio: staff.prov_bio || '',
        prov_min_client_age: staff.prov_min_client_age ?? 18,
        prov_accepting_new_clients: staff.prov_accepting_new_clients ?? false,
        prov_treatment_approaches: staff.prov_treatment_approaches || [],
      });
    }
  }, [staff]);

  // Sync direct deposit info from payroll recipient
  useEffect(() => {
    if (payrollRecipient) {
      setDirectDeposit({
        recipient_name: payrollRecipient.recipient_name || '',
        deposit_addr_1: payrollRecipient.deposit_addr_1 || '',
        deposit_addr_2: payrollRecipient.deposit_addr_2 || '',
        deposit_city: payrollRecipient.deposit_city || '',
        deposit_state: payrollRecipient.deposit_state || '',
        deposit_zip: payrollRecipient.deposit_zip || '',
        // Routing and account numbers are masked - user must re-enter full values
        routing_number: '',
        account_number: '',
        account_type: payrollRecipient.account_type || '',
      });
    }
  }, [payrollRecipient]);

  const handleProfessionalInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff || !user) return;
    
    setIsUpdating(true);

    // Update staff table
    const staffResult = await updateStaffInfo({
      prov_name_f: professionalInfo.prov_name_f,
      prov_name_m: professionalInfo.prov_name_m,
      prov_name_l: professionalInfo.prov_name_l,
      prov_phone: professionalInfo.prov_phone,
      prov_addr_1: professionalInfo.prov_addr_1,
      prov_addr_2: professionalInfo.prov_addr_2,
      prov_city: professionalInfo.prov_city,
      prov_state: professionalInfo.prov_state,
      prov_zip: professionalInfo.prov_zip,
      prov_time_zone: professionalInfo.prov_time_zone || undefined,
      prov_dob: professionalInfo.prov_dob || null,
    });

    // Update email in profiles table if changed
    if (professionalInfo.email !== profile?.email) {
      const { error: emailError } = await supabase
        .from('profiles')
        .update({ email: professionalInfo.email })
        .eq('id', user.id);

      if (emailError) {
        toast({
          variant: "destructive",
          title: "Error updating email",
          description: emailError.message,
        });
      }
    }

    setIsUpdating(false);

    if (staffResult.error) {
      toast({
        variant: "destructive",
        title: "Error updating professional information",
        description: staffResult.error.message,
      });
    }
    // Note: No cache clearing needed - server-side formatting via RPC uses fresh timezone on each fetch
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff) return;
    
    setIsUpdating(true);

    const result = await updateStaffInfo({
      prov_npi: credentials.prov_npi,
      prov_taxonomy: credentials.prov_taxonomy,
      prov_degree: credentials.prov_degree || null,
    });

    setIsUpdating(false);

    if (result.error) {
      toast({
        variant: "destructive",
        title: "Error updating credentials",
        description: result.error.message,
      });
    }
  };

  const handleClientInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff) return;
    
    setIsUpdating(true);

    const result = await updateStaffInfo({
      prov_name_for_clients: clientInfo.prov_name_for_clients,
      prov_bio: clientInfo.prov_bio,
      prov_min_client_age: clientInfo.prov_min_client_age,
      prov_accepting_new_clients: clientInfo.prov_accepting_new_clients,
      prov_treatment_approaches: clientInfo.prov_treatment_approaches,
    });

    setIsUpdating(false);

    if (result.error) {
      toast({
        variant: "destructive",
        title: "Error updating client information",
        description: result.error.message,
      });
    }
  };

  const handleDirectDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff) return;

    // Validation
    if (!directDeposit.recipient_name.trim()) {
      toast({
        variant: "destructive",
        title: "Recipient name required",
        description: "Please enter the legal name on the bank account.",
      });
      return;
    }

    if (!directDeposit.deposit_addr_1.trim()) {
      toast({
        variant: "destructive",
        title: "Address required",
        description: "Please enter the street address.",
      });
      return;
    }

    if (!directDeposit.deposit_city.trim()) {
      toast({
        variant: "destructive",
        title: "City required",
        description: "Please enter the city.",
      });
      return;
    }

    if (!directDeposit.deposit_state) {
      toast({
        variant: "destructive",
        title: "State required",
        description: "Please select a state.",
      });
      return;
    }

    if (!directDeposit.deposit_zip.trim()) {
      toast({
        variant: "destructive",
        title: "ZIP code required",
        description: "Please enter the ZIP code.",
      });
      return;
    }

    // Only validate routing/account if user is entering new values (or no existing record)
    const hasExistingBankInfo = payrollRecipient?.routing_number_last4 && payrollRecipient?.account_number_last4;
    const isEnteringNewBankInfo = directDeposit.routing_number || directDeposit.account_number;

    if (!hasExistingBankInfo || isEnteringNewBankInfo) {
      if (!directDeposit.routing_number) {
        toast({
          variant: "destructive",
          title: "Routing number required",
          description: "Please enter your bank's routing number.",
        });
        return;
      }

      if (!/^\d{9}$/.test(directDeposit.routing_number)) {
        toast({
          variant: "destructive",
          title: "Invalid routing number",
          description: "Routing number must be exactly 9 digits.",
        });
        return;
      }

      if (!directDeposit.account_number) {
        toast({
          variant: "destructive",
          title: "Account number required",
          description: "Please enter your bank account number.",
        });
        return;
      }

      if (!/^\d+$/.test(directDeposit.account_number)) {
        toast({
          variant: "destructive",
          title: "Invalid account number",
          description: "Account number must contain only digits.",
        });
        return;
      }
    }

    if (!directDeposit.account_type) {
      toast({
        variant: "destructive",
        title: "Account type required",
        description: "Please select an account type.",
      });
      return;
    }

    await upsertPayrollRecipient(directDeposit, staff.tenant_id);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile || !user) return;

    setIsUploadingImage(true);

    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, imageFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(fileName);

      if (staff) {
        const { error: staffError } = await supabase
          .from('staff')
          .update({ prov_image_url: publicUrl })
          .eq('profile_id', user.id);

        if (staffError) throw staffError;
      }

      toast({
        title: "Profile image updated",
        description: "Your profile image has been uploaded successfully.",
      });

      setImageFile(null);
      setImagePreview(null);
      refetchStaff();
    } catch (error: unknown) {
      const err = error as Error;
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: err.message,
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "Please make sure both password fields match.",
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
      });
      return;
    }

    setIsUpdating(true);

    const result = await updatePassword(passwordForm.newPassword);
    
    setIsUpdating(false);
    
    if (result.error) {
      toast({
        variant: "destructive",
        title: "Error updating password",
        description: result.error.message,
      });
    } else {
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    }
  };

  const loading = profileLoading || staffLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[80vh]">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full">
        <div className="p-6 lg:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={staff?.prov_image_url || ''} />
              <AvatarFallback className="text-lg">
                {staff?.prov_name_f && staff?.prov_name_l 
                  ? `${staff.prov_name_f[0]}${staff.prov_name_l[0]}`.toUpperCase()
                  : profile?.email?.[0].toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
              <p className="text-muted-foreground">Manage your professional information and account settings</p>
            </div>
          </div>

          {/* Card 1: Professional Information */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <Briefcase className="h-5 w-5" />
                Professional Information
              </CardTitle>
              <CardDescription>
                Your billing and insurance details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfessionalInfoSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="prov_name_f">First Name</Label>
                    <Input
                      id="prov_name_f"
                      value={professionalInfo.prov_name_f}
                      onChange={(e) => setProfessionalInfo(prev => ({ ...prev, prov_name_f: e.target.value }))}
                      placeholder="First name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prov_name_m">Middle Name</Label>
                    <Input
                      id="prov_name_m"
                      value={professionalInfo.prov_name_m}
                      onChange={(e) => setProfessionalInfo(prev => ({ ...prev, prov_name_m: e.target.value }))}
                      placeholder="Middle name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prov_name_l">Last Name</Label>
                    <Input
                      id="prov_name_l"
                      value={professionalInfo.prov_name_l}
                      onChange={(e) => setProfessionalInfo(prev => ({ ...prev, prov_name_l: e.target.value }))}
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="prov_phone">Phone Number</Label>
                    <Input
                      id="prov_phone"
                      value={professionalInfo.prov_phone}
                      onChange={(e) => setProfessionalInfo(prev => ({ ...prev, prov_phone: e.target.value }))}
                      placeholder="Phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={professionalInfo.email}
                      onChange={(e) => setProfessionalInfo(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Email address"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prov_addr_1">Address Line 1</Label>
                  <Input
                    id="prov_addr_1"
                    value={professionalInfo.prov_addr_1}
                    onChange={(e) => setProfessionalInfo(prev => ({ ...prev, prov_addr_1: e.target.value }))}
                    placeholder="Street address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prov_addr_2">Address Line 2</Label>
                  <Input
                    id="prov_addr_2"
                    value={professionalInfo.prov_addr_2}
                    onChange={(e) => setProfessionalInfo(prev => ({ ...prev, prov_addr_2: e.target.value }))}
                    placeholder="Suite, unit, building, etc."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="prov_city">City</Label>
                    <Input
                      id="prov_city"
                      value={professionalInfo.prov_city}
                      onChange={(e) => setProfessionalInfo(prev => ({ ...prev, prov_city: e.target.value }))}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prov_state">State</Label>
                    <Select
                      value={professionalInfo.prov_state}
                      onValueChange={(value) => setProfessionalInfo(prev => ({ ...prev, prov_state: value }))}
                    >
                      <SelectTrigger id="prov_state">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map(state => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prov_zip">ZIP Code</Label>
                    <Input
                      id="prov_zip"
                      value={professionalInfo.prov_zip}
                      onChange={(e) => setProfessionalInfo(prev => ({ ...prev, prov_zip: e.target.value }))}
                      placeholder="ZIP code"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="prov_time_zone">Time Zone</Label>
                    <Select
                      value={professionalInfo.prov_time_zone}
                      onValueChange={(value) => setProfessionalInfo(prev => ({ ...prev, prov_time_zone: value }))}
                    >
                      <SelectTrigger id="prov_time_zone">
                        <SelectValue placeholder="Select your time zone" />
                      </SelectTrigger>
                      <SelectContent>
                        {DB_ENUMS.time_zones.map(tz => (
                          <SelectItem key={tz} value={tz}>
                            {TIMEZONE_LABELS[tz] || tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !professionalInfo.prov_dob && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {professionalInfo.prov_dob ? (
                            format(parseISO(professionalInfo.prov_dob), 'PPP')
                          ) : (
                            <span>Select date of birth</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={professionalInfo.prov_dob ? parseISO(professionalInfo.prov_dob) : undefined}
                          onSelect={(date) => setProfessionalInfo(prev => ({ 
                            ...prev, 
                            prov_dob: date ? format(date, 'yyyy-MM-dd') : '' 
                          }))}
                          disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                          captionLayout="dropdown-buttons"
                          fromYear={1930}
                          toYear={new Date().getFullYear()}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <Button type="submit" disabled={isUpdating} className="w-full">
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Professional Information'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Card 2: Licensing & Credentials */}
          {staff && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground">
                  <Award className="h-5 w-5" />
                  Licensing & Credentials
                </CardTitle>
                <CardDescription>
                  Manage your professional licenses and credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="prov_degree">Highest Degree</Label>
                  <Input
                    id="prov_degree"
                    value={credentials.prov_degree}
                    onChange={(e) => setCredentials(prev => ({ ...prev, prov_degree: e.target.value }))}
                    placeholder="e.g., Ph.D., Psy.D., M.S., M.A."
                  />
                  <p className="text-sm text-muted-foreground">
                    Your highest earned academic degree (e.g., Ph.D., Psy.D., M.S.W., M.A.)
                  </p>
                </div>

                <LicenseManagement 
                  staffId={staff.id} 
                  specialty={staff.prov_field}
                />

                <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="prov_npi">NPI Number</Label>
                      <Input
                        id="prov_npi"
                        value={credentials.prov_npi}
                        onChange={(e) => setCredentials(prev => ({ ...prev, prov_npi: e.target.value }))}
                        placeholder="National Provider Identifier"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prov_taxonomy">Taxonomy Code</Label>
                      <Input
                        id="prov_taxonomy"
                        value={credentials.prov_taxonomy}
                        onChange={(e) => setCredentials(prev => ({ ...prev, prov_taxonomy: e.target.value }))}
                        placeholder="Healthcare Provider Taxonomy Code"
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={isUpdating} className="w-full">
                    {isUpdating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Credentials'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Card 3: Profile Image */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <Camera className="h-5 w-5" />
                Profile Image
              </CardTitle>
              <CardDescription>
                Upload a profile picture that will be visible to clients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={imagePreview || staff?.prov_image_url || ''} />
                  <AvatarFallback className="text-2xl">
                    {staff?.prov_name_f && staff?.prov_name_l 
                      ? `${staff.prov_name_f[0]}${staff.prov_name_l[0]}`.toUpperCase()
                      : profile?.email?.[0].toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="cursor-pointer"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    JPG, PNG, or GIF. Max size 5MB.
                  </p>
                </div>
              </div>
              {imageFile && (
                <Button
                  onClick={handleImageUpload}
                  disabled={isUploadingImage}
                  className="w-full"
                >
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Image
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Card 4: Client Facing Information */}
          {staff && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground">
                  <Users className="h-5 w-5" />
                  Client Facing Information
                </CardTitle>
                <CardDescription>
                  Information that will be visible to your clients
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleClientInfoSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="prov_name_for_clients">Display Name for Clients</Label>
                    <Input
                      id="prov_name_for_clients"
                      value={clientInfo.prov_name_for_clients}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, prov_name_for_clients: e.target.value }))}
                      placeholder="e.g., Dr. Smith or Jane Smith, LCSW"
                    />
                    <p className="text-sm text-muted-foreground">
                      How you want your name to appear to clients
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prov_bio">Professional Bio</Label>
                    <Textarea
                      id="prov_bio"
                      value={clientInfo.prov_bio}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, prov_bio: e.target.value }))}
                      placeholder="Share your professional background, approach, and what clients can expect..."
                      rows={6}
                      className="resize-y"
                    />
                  </div>

                  {/* Treatment Approaches */}
                  <div className="space-y-2">
                    <Label>Treatment Approaches</Label>
                    {!staff.prov_field ? (
                      <p className="text-sm text-muted-foreground">
                        Set your specialty to see available treatment approaches.
                      </p>
                    ) : treatmentApproachOptions.length === 0 && !treatmentApproachesLoading ? (
                      <p className="text-sm text-muted-foreground">
                        No treatment approaches configured for {staff.prov_field}.
                      </p>
                    ) : (
                      <>
                        <MultiSelectCombobox
                          options={treatmentApproachOptions}
                          value={clientInfo.prov_treatment_approaches}
                          onChange={(approaches) => setClientInfo(prev => ({ 
                            ...prev, 
                            prov_treatment_approaches: approaches 
                          }))}
                          placeholder="Search and select treatment approaches..."
                          searchPlaceholder="Search approaches..."
                          emptyMessage="No approaches found."
                          loading={treatmentApproachesLoading}
                        />
                        <p className="text-sm text-muted-foreground">
                          Select the therapeutic approaches you use with clients
                        </p>
                      </>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="prov_min_client_age">Minimum Client Age</Label>
                      <Input
                        id="prov_min_client_age"
                        type="number"
                        min="0"
                        max="100"
                        value={clientInfo.prov_min_client_age}
                        onChange={(e) => setClientInfo(prev => ({ ...prev, prov_min_client_age: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label htmlFor="prov_accepting_new_clients">Accepting New Clients</Label>
                        <p className="text-sm text-muted-foreground">
                          {clientInfo.prov_accepting_new_clients ? 'Yes' : 'No'}
                        </p>
                      </div>
                      <Switch
                        id="prov_accepting_new_clients"
                        checked={clientInfo.prov_accepting_new_clients}
                        onCheckedChange={(checked) => setClientInfo(prev => ({ ...prev, prov_accepting_new_clients: checked }))}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={isUpdating} className="w-full">
                    {isUpdating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Client Information'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Card 5: Direct Deposit */}
          {staff && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground">
                  <Banknote className="h-5 w-5" />
                  Direct Deposit
                </CardTitle>
                <CardDescription>
                  Enter your bank account information for payroll
                </CardDescription>
              </CardHeader>
              <CardContent>
                {payrollLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <form onSubmit={handleDirectDepositSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="recipient_name">
                        Recipient Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="recipient_name"
                        value={directDeposit.recipient_name}
                        onChange={(e) => setDirectDeposit(prev => ({ ...prev, recipient_name: e.target.value }))}
                        placeholder="Legal name on bank account"
                        autoComplete="off"
                      />
                      <p className="text-sm text-muted-foreground">
                        Legal name on bank account (person or business)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="deposit_addr_1">
                        Street Address <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="deposit_addr_1"
                        value={directDeposit.deposit_addr_1}
                        onChange={(e) => setDirectDeposit(prev => ({ ...prev, deposit_addr_1: e.target.value }))}
                        placeholder="Street address"
                        autoComplete="off"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="deposit_addr_2">Address Line 2</Label>
                      <Input
                        id="deposit_addr_2"
                        value={directDeposit.deposit_addr_2}
                        onChange={(e) => setDirectDeposit(prev => ({ ...prev, deposit_addr_2: e.target.value }))}
                        placeholder="Apartment / Suite / Unit"
                        autoComplete="off"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="deposit_city">
                          City <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="deposit_city"
                          value={directDeposit.deposit_city}
                          onChange={(e) => setDirectDeposit(prev => ({ ...prev, deposit_city: e.target.value }))}
                          placeholder="City"
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deposit_state">
                          State <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={directDeposit.deposit_state}
                          onValueChange={(value) => setDirectDeposit(prev => ({ ...prev, deposit_state: value }))}
                        >
                          <SelectTrigger id="deposit_state">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {US_STATES.map(state => (
                              <SelectItem key={state.value} value={state.value}>
                                {state.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deposit_zip">
                          ZIP Code <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="deposit_zip"
                          value={directDeposit.deposit_zip}
                          onChange={(e) => setDirectDeposit(prev => ({ ...prev, deposit_zip: e.target.value }))}
                          placeholder="ZIP code"
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4 mt-4">
                      <h4 className="text-sm font-medium mb-4">Bank Account Details</h4>
                      
                      {payrollRecipient?.routing_number_last4 && payrollRecipient?.account_number_last4 && (
                        <div className="bg-muted/50 p-3 rounded-md mb-4">
                          <p className="text-sm text-muted-foreground">
                            Current account on file: Routing ••••{payrollRecipient.routing_number_last4} / Account ••••{payrollRecipient.account_number_last4}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Leave fields below empty to keep current bank details, or enter new values to update.
                          </p>
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="routing_number">
                            Routing Number {!payrollRecipient?.routing_number_last4 && <span className="text-destructive">*</span>}
                          </Label>
                          <Input
                            id="routing_number"
                            value={directDeposit.routing_number}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                              setDirectDeposit(prev => ({ ...prev, routing_number: value }));
                            }}
                            placeholder={payrollRecipient?.routing_number_last4 ? `••••${payrollRecipient.routing_number_last4}` : "9 digits"}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={9}
                            autoComplete="off"
                          />
                          <p className="text-sm text-muted-foreground">Must be exactly 9 digits</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="account_number">
                            Account Number {!payrollRecipient?.account_number_last4 && <span className="text-destructive">*</span>}
                          </Label>
                          <Input
                            id="account_number"
                            value={directDeposit.account_number}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              setDirectDeposit(prev => ({ ...prev, account_number: value }));
                            }}
                            placeholder={payrollRecipient?.account_number_last4 ? `••••${payrollRecipient.account_number_last4}` : "Account number"}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="off"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 mt-4">
                        <Label htmlFor="account_type">
                          Account Type <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={directDeposit.account_type}
                          onValueChange={(value) => setDirectDeposit(prev => ({ ...prev, account_type: value }))}
                        >
                          <SelectTrigger id="account_type">
                            <SelectValue placeholder="Select account type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="personalChecking">Personal Checking</SelectItem>
                            <SelectItem value="personalSavings">Personal Savings</SelectItem>
                            <SelectItem value="businessChecking">Business Checking</SelectItem>
                            <SelectItem value="businessSavings">Business Savings</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button type="submit" disabled={payrollSaving} className="w-full">
                      {payrollSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Update Direct Deposit Information'
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          )}

          {/* Card 6: Password & Security */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <Lock className="h-5 w-5" />
                Password & Security
              </CardTitle>
              <CardDescription>Change your account password</CardDescription>
            </CardHeader>
            <CardContent>
              {!showPasswordForm ? (
                <Button onClick={() => setShowPasswordForm(true)} variant="outline">
                  Change Password
                </Button>
              ) : (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm new password"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setPasswordForm({ newPassword: '', confirmPassword: '' });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
