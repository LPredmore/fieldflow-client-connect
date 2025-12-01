import { useState, useEffect, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { performanceMonitor } from '@/utils/performanceMonitor';

interface FinalRegistrationFormProps {
  onComplete: (data: { goals: string; referral_source: string }) => void | Promise<void>;
  onBack?: () => void;
  showProgress?: boolean;
}

const REFERRAL_OPTIONS = [
  { value: 'social_media', label: 'Social Media' },
  { value: 'internet_search', label: 'Internet Search' },
  { value: 'friend', label: 'Friend' },
];

function FinalRegistrationForm({ onComplete, onBack, showProgress = true }: FinalRegistrationFormProps) {
  const [formData, setFormData] = useState({
    goals: '',
    referral_source: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  
  // Track performance in development
  useEffect(() => {
    performanceMonitor.trackComponentMount('FinalRegistrationForm');
    return () => performanceMonitor.trackComponentUnmount('FinalRegistrationForm');
  }, []);

  const handleSubmit = async () => {
    setIsSaving(true);
    await onComplete(formData);
    setIsSaving(false);
  };

  const isFormComplete = formData.goals.trim() && formData.referral_source;

  return (
    <Card className="shadow-xl border-border/50">
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Final Questions</h1>
          <p className="text-muted-foreground">
            Help us understand your goals and how you found us
          </p>
        </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="goals">What Are Your Goals? *</Label>
              <Textarea
                id="goals"
                value={formData.goals}
                onChange={(e) => setFormData(prev => ({ ...prev, goals: e.target.value }))}
                placeholder="Tell us about what you'd like to achieve..."
                className="min-h-[120px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="referral_source">How Did You Find Out About Us? *</Label>
              <Select 
                value={formData.referral_source} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, referral_source: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {REFERRAL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-between pt-6">
            {onBack && (
              <Button
                variant="outline"
                onClick={onBack}
                size="lg"
                disabled={isSaving}
              >
                Back
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={!isFormComplete || isSaving}
              size="lg"
              className={!onBack ? 'ml-auto' : ''}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Completing...
                </>
              ) : (
                'Complete Registration'
              )}
            </Button>
          </div>
      </div>
    </Card>
  );
}

// Named export for backward compatibility
export { FinalRegistrationForm };

// Memoize to prevent unnecessary re-renders
export default memo(FinalRegistrationForm);
