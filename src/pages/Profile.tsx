import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Lock, MapPin, X, Upload, Camera } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useStaffData } from '@/hooks/useStaffData';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { US_STATES } from '@/constants/usStates';

export default function Profile() {
  const { profile, loading, updatePersonalInfo, updatePassword } = useProfile();
  const { staff, updateStaffInfo } = useStaffData();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [personalInfo, setPersonalInfo] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [clinicianForm, setClinicianForm] = useState({
    prov_name_f: '',
    prov_name_last: '',
    clinician_bio: '',
    clinician_treatment_approaches: [] as string[],
    clinician_min_client_age: 18,
    clinician_accepting_new_clients: 'Yes' as 'Yes' | 'No',
    clinician_license_type: '',
    clinician_licensed_states: [] as string[],
    prov_npi: '',
    clinician_taxonomy_code: '',
  });

  const [treatmentApproachInput, setTreatmentApproachInput] = useState('');

  // Sync profile data from staff table
  useEffect(() => {
    if (profile && staff) {
      setPersonalInfo({
        first_name: staff.prov_name_f || '',
        last_name: staff.prov_name_l || '',
        phone: '', // Phone not stored in current schema
        email: profile.email || '',
      });
    }
  }, [profile, staff]);

  // Sync staff data
  useEffect(() => {
    if (staff) {
      setClinicianForm({
        prov_name_f: staff.prov_name_f || '',
        prov_name_last: staff.prov_name_l || '',
        clinician_bio: staff.prov_bio || '',
        clinician_treatment_approaches: staff.prov_treatment_approaches || [],
        clinician_min_client_age: staff.prov_min_client_age || 18,
        clinician_accepting_new_clients: staff.prov_accepting_new_clients || 'Yes',
        clinician_license_type: staff.prov_license_type || '',
        clinician_licensed_states: [],
        prov_npi: staff.prov_npi || '',
        clinician_taxonomy_code: staff.prov_taxonomy || '',
      });
    }
  }, [staff]);

  const handlePersonalInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    const result = await updatePersonalInfo(personalInfo);
    
    setIsUpdating(false);
    
    if (result.error) {
      toast({
        variant: "destructive",
        title: "Error updating profile",
        description: result.error.message,
      });
    }
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
      // Upload to storage
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, imageFile, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(fileName);

      // Update staff image_url if staff exists
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

      // Reset state
      setImageFile(null);
      setImagePreview(null);
      window.location.reload(); // Refresh to show new image
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
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
      setPasswordForm({
        newPassword: '',
        confirmPassword: '',
      });
      setShowPasswordForm(false);
    }
  };

  const handleClinicianSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    const result = await updateStaffInfo({
      prov_name_f: clinicianForm.prov_name_f,
      prov_name_l: clinicianForm.prov_name_last,
      prov_bio: clinicianForm.clinician_bio,
      prov_treatment_approaches: clinicianForm.clinician_treatment_approaches,
      prov_min_client_age: clinicianForm.clinician_min_client_age,
      prov_accepting_new_clients: clinicianForm.clinician_accepting_new_clients,
      prov_license_type: clinicianForm.clinician_license_type,
      prov_npi: clinicianForm.prov_npi,
      prov_taxonomy: clinicianForm.clinician_taxonomy_code,
    });
    
    setIsUpdating(false);
    
    if (result.error) {
      toast({
        variant: "destructive",
        title: "Error updating professional information",
        description: result.error.message,
      });
    }
  };

  const addTreatmentApproach = () => {
    if (treatmentApproachInput.trim() && !clinicianForm.clinician_treatment_approaches.includes(treatmentApproachInput.trim())) {
      setClinicianForm(prev => ({
        ...prev,
        clinician_treatment_approaches: [...prev.clinician_treatment_approaches, treatmentApproachInput.trim()]
      }));
      setTreatmentApproachInput('');
    }
  };

  const removeTreatmentApproach = (approach: string) => {
    setClinicianForm(prev => ({
      ...prev,
      clinician_treatment_approaches: prev.clinician_treatment_approaches.filter(a => a !== approach)
    }));
  };

  const addLicensedState = (stateCode: string) => {
    if (!clinicianForm.clinician_licensed_states.includes(stateCode)) {
      setClinicianForm(prev => ({
        ...prev,
        clinician_licensed_states: [...prev.clinician_licensed_states, stateCode].sort()
      }));
    }
  };

  const removeLicensedState = (stateCode: string) => {
    setClinicianForm(prev => ({
      ...prev,
      clinician_licensed_states: prev.clinician_licensed_states.filter(s => s !== stateCode)
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="lg:ml-64">
          <div className="p-6 lg:p-8 flex items-center justify-center min-h-[80vh]">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full">
        <div className="p-6 lg:p-8 space-y-6">
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
              <p className="text-muted-foreground">Manage your personal information and account settings</p>
            </div>
          </div>

          {/* Personal Information Card */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Update your personal details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePersonalInfoSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={personalInfo.first_name}
                      onChange={(e) => setPersonalInfo(prev => ({ ...prev, first_name: e.target.value }))}
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={personalInfo.last_name}
                      onChange={(e) => setPersonalInfo(prev => ({ ...prev, last_name: e.target.value }))}
                      placeholder="Enter your last name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={personalInfo.phone}
                    onChange={(e) => setPersonalInfo(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter your phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={personalInfo.email}
                    onChange={(e) => setPersonalInfo(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email address"
                  />
                  <p className="text-sm text-muted-foreground">
                    This will update your login email address
                  </p>
                </div>
                <Button 
                  type="submit" 
                  disabled={isUpdating}
                  className="w-full"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Personal Information'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Profile Image Upload Card */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <Camera className="h-5 w-5" />
                Profile Image
              </CardTitle>
              <CardDescription>
                Upload a profile picture
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

          {/* Password Section */}
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
                <Button 
                  onClick={() => setShowPasswordForm(true)}
                  variant="outline"
                >
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
                    <Button 
                      type="submit" 
                      disabled={isUpdating}
                    >
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
                        setPasswordForm({
                          newPassword: '',
                          confirmPassword: '',
                        });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Professional Information - Only for staff */}
          {staff && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground">
                  <MapPin className="h-5 w-5" />
                  Professional Licensing & Information
                </CardTitle>
                <CardDescription>Manage your professional credentials and client-facing information</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleClinicianSubmit} className="space-y-6">
                  {/* Professional Identity */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Professional Identity</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="prov_name_f">Provider First Name</Label>
                        <Input
                          id="prov_name_f"
                          value={clinicianForm.prov_name_f}
                          onChange={(e) => setClinicianForm(prev => ({ ...prev, prov_name_f: e.target.value }))}
                          placeholder="First name for professional use"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prov_name_last">Provider Last Name</Label>
                        <Input
                          id="prov_name_last"
                          value={clinicianForm.prov_name_last}
                          onChange={(e) => setClinicianForm(prev => ({ ...prev, prov_name_last: e.target.value }))}
                          placeholder="Last name for professional use"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Biography & Approach */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Biography & Approach</h3>
                    <div className="space-y-2">
                      <Label htmlFor="clinician_bio">Professional Bio</Label>
                      <Textarea
                        id="clinician_bio"
                        value={clinicianForm.clinician_bio}
                        onChange={(e) => setClinicianForm(prev => ({ ...prev, clinician_bio: e.target.value }))}
                        placeholder="Share your professional background, approach, and what clients can expect..."
                        rows={6}
                        className="resize-y"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="treatment_approaches">Treatment Approaches</Label>
                      <div className="flex gap-2">
                        <Input
                          id="treatment_approaches"
                          value={treatmentApproachInput}
                          onChange={(e) => setTreatmentApproachInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTreatmentApproach())}
                          placeholder="Add a treatment approach (e.g., CBT, DBT)"
                        />
                        <Button type="button" onClick={addTreatmentApproach}>Add</Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {clinicianForm.clinician_treatment_approaches.map(approach => (
                          <Badge key={approach} variant="secondary" className="flex items-center gap-1">
                            {approach}
                            <X
                              className="h-3 w-3 cursor-pointer hover:text-destructive"
                              onClick={() => removeTreatmentApproach(approach)}
                            />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Client Parameters */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Client Parameters</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="clinician_min_client_age">Client Minimum Age</Label>
                        <Input
                          id="clinician_min_client_age"
                          type="number"
                          min="0"
                          max="100"
                          value={clinicianForm.clinician_min_client_age}
                          onChange={(e) => setClinicianForm(prev => ({ ...prev, clinician_min_client_age: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="clinician_accepting_new_clients">Accepting New Clients</Label>
                        <Select
                          value={clinicianForm.clinician_accepting_new_clients}
                          onValueChange={(value: 'Yes' | 'No') => setClinicianForm(prev => ({ ...prev, clinician_accepting_new_clients: value }))}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Licensing & Credentials */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Licensing & Credentials</h3>
                    <div className="space-y-2">
                      <Label htmlFor="clinician_license_type">License Type</Label>
                      <Input
                        id="clinician_license_type"
                        value={clinicianForm.clinician_license_type}
                        onChange={(e) => setClinicianForm(prev => ({ ...prev, clinician_license_type: e.target.value }))}
                        placeholder="e.g., LCSW, LMFT, PhD"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="licensed-states">States Licensed In</Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {clinicianForm.clinician_licensed_states.length > 0 ? (
                          clinicianForm.clinician_licensed_states.map(stateCode => {
                            const stateName = US_STATES.find(s => s.value === stateCode)?.label || stateCode;
                            return (
                              <Badge key={stateCode} variant="secondary" className="flex items-center gap-1">
                                {stateName}
                                <X
                                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                                  onClick={() => removeLicensedState(stateCode)}
                                />
                              </Badge>
                            );
                          })
                        ) : (
                          <p className="text-sm text-muted-foreground">No states selected</p>
                        )}
                      </div>
                      <Select
                        value=""
                        onValueChange={addLicensedState}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Add a state..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px] bg-background z-50">
                          {US_STATES.map(state => (
                            <SelectItem
                              key={state.value}
                              value={state.value}
                              disabled={clinicianForm.clinician_licensed_states.includes(state.value)}
                            >
                              {state.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="prov_npi">NPI Number</Label>
                        <Input
                          id="prov_npi"
                          value={clinicianForm.prov_npi}
                          onChange={(e) => setClinicianForm(prev => ({ ...prev, prov_npi: e.target.value }))}
                          placeholder="National Provider Identifier"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="clinician_taxonomy_code">Taxonomy Code</Label>
                        <Input
                          id="clinician_taxonomy_code"
                          value={clinicianForm.clinician_taxonomy_code}
                          onChange={(e) => setClinicianForm(prev => ({ ...prev, clinician_taxonomy_code: e.target.value }))}
                          placeholder="Healthcare Provider Taxonomy Code"
                        />
                      </div>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isUpdating}
                    className="w-full"
                  >
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
          )}
        </div>
      </div>
    </div>
  );
}
