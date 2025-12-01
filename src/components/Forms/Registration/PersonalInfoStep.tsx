import { useState, useEffect, memo } from 'react';
import { useClientProfile } from '@/hooks/useClientProfile';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { performanceMonitor } from '@/utils/performanceMonitor';

const GENDER_OPTIONS = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" }
];
const GENDER_IDENTITY_OPTIONS = ["Male", "Female", "Non-binary", "Other"];

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Mountain Time - Arizona (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
];

interface PersonalInfoStepProps {
  onComplete: () => void;
}

function PersonalInfoStep({ onComplete }: PersonalInfoStepProps) {
  const { updateProfile, profile } = useClientProfile();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  // Track performance in development
  useEffect(() => {
    performanceMonitor.trackComponentMount('PersonalInfoStep');
    return () => performanceMonitor.trackComponentUnmount('PersonalInfoStep');
  }, []);

  const [formData, setFormData] = useState({
    preferred_name: '',
    date_of_birth: '',
    gender: '',
    gender_identity: '',
    timezone: 'America/New_York',
  });

  // Pre-populate form with existing profile data
  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        preferred_name: profile.preferred_name || prev.preferred_name,
        date_of_birth: profile.date_of_birth || prev.date_of_birth,
        gender: profile.gender || prev.gender,
        gender_identity: profile.gender_identity || prev.gender_identity,
        timezone: profile.timezone || prev.timezone,
      }));
    }
  }, [profile]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid = formData.preferred_name && formData.date_of_birth && formData.gender && formData.timezone;

  const handleContinue = async () => {
    // Advance to next step immediately for smooth UX
    onComplete();
    
    // Save data in background
    setIsSaving(true);
    try {
      await updateProfile(formData);
    } catch (error) {
      console.error('Error saving personal info:', error);
      toast({
        title: "Error",
        description: "Failed to save personal information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="shadow-xl border-border/50">
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Personal Information</h1>
          <p className="text-muted-foreground">Let's start with your personal information</p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="preferred_name">Preferred Name *</Label>
              <Input
                id="preferred_name"
                value={formData.preferred_name}
                onChange={(e) => handleInputChange('preferred_name', e.target.value)}
                placeholder="What should we call you?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth *</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender_identity">Gender Identity</Label>
              <Select value={formData.gender_identity} onValueChange={(value) => handleInputChange('gender_identity', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender identity" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_IDENTITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="timezone">Time Zone *</Label>
              <Select value={formData.timezone} onValueChange={(value) => handleInputChange('timezone', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {US_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="button"
              onClick={handleContinue}
              disabled={!isFormValid || isSaving}
              size="lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Continue to Address'
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Named export for backward compatibility
export { PersonalInfoStep };

// Memoize to prevent unnecessary re-renders
export default memo(PersonalInfoStep);
