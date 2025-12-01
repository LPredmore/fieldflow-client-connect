import { useEffect, useState, memo, useCallback, useRef } from 'react';
import { useFormTemplate } from '@/components/Forms/hooks/useFormTemplate';
import DynamicRegistration from '@/components/Forms/DynamicRegistration';
import FinalRegistrationForm from '@/components/Forms/FinalRegistrationForm';
import PersonalInfoStep from '@/components/Forms/Registration/PersonalInfoStep';
import AddressInfoStep from '@/components/Forms/Registration/AddressInfoStep';
import { RegistrationProgressBar } from '@/components/Forms/RegistrationProgressBar';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useClientProfile } from '@/hooks/useClientProfile';
import { useToast } from '@/hooks/use-toast';
import { performanceMonitor } from '@/utils/performanceMonitor';

type RegistrationStep = 'personal' | 'address' | 'dynamic' | 'final';

function RegistrationWrapper() {
  console.group(`🔷 [RegistrationWrapper] Component Mount ${new Date().toISOString()}`);
  console.log('Initial render');
  
  // Track performance in development - Enhanced logging to verify fix
  useEffect(() => {
    console.log('✅ RegistrationWrapper MOUNTED (should only see this ONCE)');
    performanceMonitor.trackComponentMount('RegistrationWrapper');
    return () => {
      console.log('❌ RegistrationWrapper UNMOUNTING');
      performanceMonitor.trackComponentUnmount('RegistrationWrapper');
    };
  }, []);
  
  const { template, loadTemplate, loading, templates, fields } = useFormTemplate();
  const [checkedForForm, setCheckedForForm] = useState(false);
  
  // Use ref to track if we've already loaded the template (prevents infinite loop)
  const hasLoadedTemplate = useRef(false);
  
  // Persist currentStep to sessionStorage to survive remounts
  const [currentStep, setCurrentStep] = useState<RegistrationStep>(() => {
    const stored = sessionStorage.getItem('registrationStep');
    console.log('📍 Initial step from sessionStorage:', stored || 'personal');
    return (stored as RegistrationStep) || 'personal';
  });
  
  const [hasDynamicForm, setHasDynamicForm] = useState(false);
  const { updateStatus, customerId, refetch } = useClientProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  console.log('State:', { 
    currentStep, 
    checkedForForm, 
    hasDynamicForm, 
    loading,
    hasTemplate: !!template,
    templateIsActive: template?.is_active,
    customerId 
  });
  console.groupEnd();

  // Calculate steps and progress
  const steps = hasDynamicForm 
    ? ['Personal Info', 'Address', 'Additional Questions', 'Final Questions']
    : ['Personal Info', 'Address', 'Final Questions'];
  
  const stepMap = hasDynamicForm
    ? { personal: 1, address: 2, dynamic: 3, final: 4 }
    : { personal: 1, address: 2, final: 3 };
  
  const currentStepNumber = stepMap[currentStep as keyof typeof stepMap];
  const totalSteps = steps.length;

  // Load template once on mount - prevents infinite loop
  useEffect(() => {
    // Only run once when component mounts
    if (hasLoadedTemplate.current) return;
    
    console.group(`⚙️ [RegistrationWrapper] useEffect - checkForCustomForm (ONCE) ${new Date().toISOString()}`);
    
    const checkForCustomForm = async () => {
      console.log('🔍 Loading signup template...');
      await loadTemplate('signup');
      console.log('✅ loadTemplate completed');
      
      // Check templates array directly (no duplicate query needed!)
      const hasForms = templates.some(t => 
        t.form_type === 'signup' && 
        t.is_active
      );
      
      console.log('📊 Active signup forms:', { hasForms, templatesCount: templates.length });
      setHasDynamicForm(hasForms);
      setCheckedForForm(true);
      hasLoadedTemplate.current = true;
      console.log('✅ Template check complete - will not run again');
    };
    
    checkForCustomForm();
    console.groupEnd();
  }, []); // Empty dependency array - run only once on mount

  // Step 1: Personal info complete - advance to address
  const handlePersonalComplete = useCallback(() => {
    console.log('🎯 handlePersonalComplete - advancing to address');
    sessionStorage.setItem('registrationStep', 'address');
    setCurrentStep('address');
  }, []);

  // Step 2: Address complete - check for dynamic form
  const handleAddressComplete = useCallback(() => {
    const nextStep = (hasDynamicForm && template?.is_active) ? 'dynamic' : 'final';
    console.log('🎯 handleAddressComplete', { hasDynamicForm, templateIsActive: template?.is_active, nextStep });
    sessionStorage.setItem('registrationStep', nextStep);
    setCurrentStep(nextStep);
  }, [hasDynamicForm, template?.is_active]);

  // Step 3: Dynamic form complete - advance to final
  const handleDynamicComplete = useCallback(() => {
    console.log('🎯 handleDynamicComplete - advancing to final');
    sessionStorage.setItem('registrationStep', 'final');
    setCurrentStep('final');
  }, []);

  // Step 4: Final form complete - save data and finish registration
  const handleFinalComplete = useCallback(async (data: { goals: string; referral_source: string }) => {
    if (!customerId) return;

    try {
      // Save the final form data and update status to registered
      const { error: updateError } = await supabase
        .from('customers')
        .update({ 
          notes: `Goals: ${data.goals}\n\nReferral Source: ${data.referral_source}`,
        })
        .eq('id', customerId);

      if (updateError) throw updateError;

      // Update status to registered
      const statusResult = await updateStatus('registered');

      if (!statusResult) {
        throw new Error('Failed to update status');
      }

      // Refresh profile data to ensure hooks have latest data
      await refetch();

      // Clear registration step from sessionStorage
      sessionStorage.removeItem('registrationStep');

      toast({
        title: "Registration Complete!",
        description: "Welcome to your client dashboard.",
      });

      // The AppRouter will automatically redirect based on the new status
      navigate('/client/dashboard', { replace: true });
    } catch (error) {
      console.error('Error completing registration:', error);
      toast({
        title: "Error",
        description: "Failed to complete registration. Please try again.",
        variant: "destructive",
      });
    }
  }, [customerId, updateStatus, refetch, toast, navigate]);

  // Show loading while checking for custom form
  if (loading || !checkedForForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading registration form...</p>
        </div>
      </div>
    );
  }

  // Unified layout wrapper
  const LayoutWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10 py-8 px-4">
      <div className="container max-w-2xl mx-auto">
        <RegistrationProgressBar 
          currentStep={currentStepNumber}
          totalSteps={totalSteps}
          steps={steps}
        />
        {children}
      </div>
    </div>
  );

  // Step 1: Personal Info
  if (currentStep === 'personal') {
    return (
      <LayoutWrapper>
        <PersonalInfoStep onComplete={handlePersonalComplete} />
      </LayoutWrapper>
    );
  }

  // Step 2: Address
  if (currentStep === 'address') {
    return (
      <LayoutWrapper>
        <AddressInfoStep 
          onComplete={handleAddressComplete}
          onBack={() => setCurrentStep('personal')}
        />
      </LayoutWrapper>
    );
  }

  // Step 3: Dynamic signup form (if exists)
  if (currentStep === 'dynamic' && template?.is_active) {
    return (
      <LayoutWrapper>
        <DynamicRegistration 
          template={template}
          fields={fields}
          onComplete={handleDynamicComplete}
          onBack={() => setCurrentStep('address')}
          showProgress={false}
        />
      </LayoutWrapper>
    );
  }

  // Step 4: Final stock form (Goals + Referral)
  if (currentStep === 'final') {
    return (
      <LayoutWrapper>
        <FinalRegistrationForm 
          onComplete={handleFinalComplete}
          onBack={hasDynamicForm ? () => setCurrentStep('dynamic') : () => setCurrentStep('address')}
          showProgress={false}
        />
      </LayoutWrapper>
    );
  }

  return null;
}

// Memoize the component to prevent unnecessary re-renders
export default memo(RegistrationWrapper);

