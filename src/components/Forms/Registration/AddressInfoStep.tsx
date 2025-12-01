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
import { US_STATES } from '@/constants/usStates';

interface AddressInfoStepProps {
  onComplete: () => void;
  onBack: () => void;
}

function AddressInfoStep({ onComplete, onBack }: AddressInfoStepProps) {
  const { updateProfile, profile } = useClientProfile();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  // Track performance in development
  useEffect(() => {
    performanceMonitor.trackComponentMount('AddressInfoStep');
    return () => performanceMonitor.trackComponentUnmount('AddressInfoStep');
  }, []);

  const [formData, setFormData] = useState({
    street_address: '',
    city: '',
    state: '',
    zip_code: '',
  });

  // Pre-populate form with existing profile data
  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        street_address: profile.street_address || prev.street_address,
        city: profile.city || prev.city,
        state: profile.state || prev.state,
        zip_code: profile.zip_code || prev.zip_code,
      }));
    }
  }, [profile]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid = formData.street_address && formData.city && formData.state && formData.zip_code;

  const handleContinue = async () => {
    // Advance to next step immediately for smooth UX
    onComplete();
    
    // Save data in background
    setIsSaving(true);
    try {
      await updateProfile(formData);
    } catch (error) {
      console.error('Error saving address info:', error);
      toast({
        title: "Error",
        description: "Failed to save address information. Please try again.",
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
          <h1 className="text-3xl font-bold mb-2">Address Information</h1>
          <p className="text-muted-foreground">Now, tell us where you're located</p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <Label htmlFor="street_address">Street Address *</Label>
              <Input
                id="street_address"
                value={formData.street_address}
                onChange={(e) => handleInputChange('street_address', e.target.value)}
                placeholder="123 Main Street"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="City"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <Select value={formData.state} onValueChange={(value) => handleInputChange('state', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip_code">Zip Code *</Label>
                <Input
                  id="zip_code"
                  value={formData.zip_code}
                  onChange={(e) => handleInputChange('zip_code', e.target.value)}
                  placeholder="12345"
                  maxLength={5}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              size="lg"
            >
              Back
            </Button>
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
                'Continue'
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Named export for backward compatibility
export { AddressInfoStep };

// Memoize to prevent unnecessary re-renders
export default memo(AddressInfoStep);
