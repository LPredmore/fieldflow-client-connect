import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, Upload, X, FileImage, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { US_STATES } from '@/constants/usStates';
import { InsuranceFormData, InsurancePolicy } from '@/types/insurance';

const insuranceSchema = z.object({
  payer_name: z.string().min(1, 'Insurance company name is required').max(200),
  policy_number: z.string().min(1, 'Policy number is required').max(50),
  insurance_type: z.enum(['primary', 'secondary', 'tertiary']),
  group_number: z.string().max(50).optional().or(z.literal('')),
  payer_id: z.string().max(20).optional().or(z.literal('')),
  
  same_as_client: z.boolean(),
  
  insured_name_first: z.string().min(1, 'Insured first name is required'),
  insured_name_last: z.string().min(1, 'Insured last name is required'),
  insured_name_middle: z.string().max(50).optional().or(z.literal('')),
  insured_dob: z.string().min(1, 'Insured date of birth is required'),
  insured_sex: z.string().min(1, 'Insured sex is required'),
  relationship_to_patient: z.string().min(1, 'Relationship is required'),
  
  insured_address_1: z.string().min(1, 'Address is required'),
  insured_address_2: z.string().optional().or(z.literal('')),
  insured_city: z.string().min(1, 'City is required'),
  insured_state: z.string().min(2, 'State is required').max(2),
  insured_zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Valid ZIP code required (e.g., 12345 or 12345-6789)'),
  
  ins_phone: z.string().regex(/^\d{10}$/, '10-digit phone number required').optional().or(z.literal('')),
  ins_employer: z.string().max(200).optional().or(z.literal('')),
  ins_plan: z.string().max(200).optional().or(z.literal('')),
});

interface AddInsuranceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | undefined;
  tenantId: string | undefined;
  customerData?: {
    pat_name_f?: string | null;
    pat_name_l?: string | null;
    pat_name_m?: string | null;
    pat_dob?: string | null;
    pat_sex?: string | null;
    pat_addr_1?: string | null;
    pat_city?: string | null;
    pat_state?: string | null;
    pat_zip?: string | null;
    pat_phone?: string | null;
  };
  editPolicy?: InsurancePolicy | null;
  onSubmit: (data: any) => Promise<void>;
  isSubmitting?: boolean;
}

export function AddInsuranceDialog({
  open,
  onOpenChange,
  customerId,
  tenantId,
  customerData,
  editPolicy,
  onSubmit,
  isSubmitting,
}: AddInsuranceDialogProps) {
  const { toast } = useToast();
  const [fieldsDisabled, setFieldsDisabled] = useState(false);
  const [frontCardFile, setFrontCardFile] = useState<File | null>(null);
  const [backCardFile, setBackCardFile] = useState<File | null>(null);
  const [frontCardPreview, setFrontCardPreview] = useState<string | null>(null);
  const [backCardPreview, setBackCardPreview] = useState<string | null>(null);
  const [isExtractingOCR, setIsExtractingOCR] = useState(false);

  const form = useForm<InsuranceFormData>({
    resolver: zodResolver(insuranceSchema),
    defaultValues: {
      payer_name: '',
      policy_number: '',
      insurance_type: 'primary',
      group_number: '',
      payer_id: '',
      same_as_client: false,
      insured_name_first: '',
      insured_name_last: '',
      insured_name_middle: '',
      insured_dob: '',
      insured_sex: '',
      relationship_to_patient: '',
      insured_address_1: '',
      insured_address_2: '',
      insured_city: '',
      insured_state: '',
      insured_zip: '',
      ins_phone: '',
      ins_employer: '',
      ins_plan: '',
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (editPolicy) {
      form.reset({
        payer_name: editPolicy.payer_name || '',
        policy_number: editPolicy.policy_number || '',
        insurance_type: editPolicy.insurance_type as any,
        group_number: editPolicy.group_number || '',
        payer_id: editPolicy.payer_id || '',
        same_as_client: false,
        insured_name_first: editPolicy.insured_name_first || '',
        insured_name_last: editPolicy.insured_name_last || '',
        insured_name_middle: editPolicy.insured_name_middle || '',
        insured_dob: editPolicy.insured_dob || '',
        insured_sex: (editPolicy.insured_sex || '') as 'M' | 'F' | 'Other' | '',
        relationship_to_patient: editPolicy.relationship_to_patient || '',
        insured_address_1: editPolicy.insured_address_1 || '',
        insured_address_2: editPolicy.insured_address_2 || '',
        insured_city: editPolicy.insured_city || '',
        insured_state: editPolicy.insured_state || '',
        insured_zip: editPolicy.insured_zip || '',
        ins_phone: editPolicy.ins_phone ? editPolicy.ins_phone.toString() : '',
        ins_employer: editPolicy.ins_employer || '',
        ins_plan: editPolicy.ins_plan || '',
      });
    } else {
      form.reset({
        payer_name: '',
        policy_number: '',
        insurance_type: 'primary',
        group_number: '',
        payer_id: '',
        same_as_client: false,
        insured_name_first: '',
        insured_name_last: '',
        insured_name_middle: '',
        insured_dob: '',
        insured_sex: '',
        relationship_to_patient: '',
        insured_address_1: '',
        insured_address_2: '',
        insured_city: '',
        insured_state: '',
        insured_zip: '',
        ins_phone: '',
        ins_employer: '',
        ins_plan: '',
      });
      setFieldsDisabled(false);
    }
  }, [editPolicy, form]);

  const handleSameAsClientChange = (checked: boolean) => {
    if (checked && customerData) {
      form.setValue('insured_name_first', customerData.pat_name_f || '');
      form.setValue('insured_name_last', customerData.pat_name_l || '');
      form.setValue('insured_name_middle', customerData.pat_name_m || '');
      form.setValue('insured_dob', customerData.pat_dob || '');
      form.setValue('insured_sex', (customerData.pat_sex || '') as 'M' | 'F' | 'Other' | '');
      form.setValue('insured_address_1', customerData.pat_addr_1 || '');
      form.setValue('insured_city', customerData.pat_city || '');
      form.setValue('insured_state', customerData.pat_state || '');
      form.setValue('insured_zip', customerData.pat_zip || '');
      form.setValue('ins_phone', customerData.pat_phone?.replace(/\D/g, '') || '');
      form.setValue('relationship_to_patient', 'Self');
      setFieldsDisabled(true);
    } else {
      setFieldsDisabled(false);
    }
  };

  const handleFrontCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFrontCardFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setFrontCardPreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBackCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBackCardFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackCardPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearFrontCard = () => {
    setFrontCardFile(null);
    setFrontCardPreview(null);
  };

  const clearBackCard = () => {
    setBackCardFile(null);
    setBackCardPreview(null);
  };

  const extractInsuranceInfo = async (imageBase64: string, cardSide: 'front' | 'back') => {
    setIsExtractingOCR(true);
    
    try {
      toast({
        title: 'Extracting Information',
        description: `Using AI to read the ${cardSide} of your insurance card...`,
      });

      const { data, error } = await supabase.functions.invoke('extract-insurance-card', {
        body: { imageBase64, cardSide }
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        const extracted = data.data;
        
        // Auto-fill form fields with extracted data
        if (extracted.payer_name) form.setValue('payer_name', extracted.payer_name);
        if (extracted.policy_number) form.setValue('policy_number', extracted.policy_number);
        if (extracted.group_number) form.setValue('group_number', extracted.group_number);
        if (extracted.payer_id) form.setValue('payer_id', extracted.payer_id);
        if (extracted.insured_name_first) form.setValue('insured_name_first', extracted.insured_name_first);
        if (extracted.insured_name_middle) form.setValue('insured_name_middle', extracted.insured_name_middle);
        if (extracted.insured_name_last) form.setValue('insured_name_last', extracted.insured_name_last);
        if (extracted.insured_dob) form.setValue('insured_dob', extracted.insured_dob);
        if (extracted.insured_sex) form.setValue('insured_sex', extracted.insured_sex);
        if (extracted.insured_address_1) form.setValue('insured_address_1', extracted.insured_address_1);
        if (extracted.insured_address_2) form.setValue('insured_address_2', extracted.insured_address_2);
        if (extracted.insured_city) form.setValue('insured_city', extracted.insured_city);
        if (extracted.insured_state) form.setValue('insured_state', extracted.insured_state);
        if (extracted.insured_zip) form.setValue('insured_zip', extracted.insured_zip);
        if (extracted.ins_phone) form.setValue('ins_phone', extracted.ins_phone.replace(/\D/g, ''));
        if (extracted.ins_employer) form.setValue('ins_employer', extracted.ins_employer);
        if (extracted.ins_plan) form.setValue('ins_plan', extracted.ins_plan);

        toast({
          title: 'Success!',
          description: `Insurance information extracted from ${cardSide} and auto-filled`,
        });
      } else {
        throw new Error('Failed to extract information');
      }
    } catch (error: any) {
      console.error('OCR extraction error:', error);
      
      // Handle specific errors
      if (error.message?.includes('Rate limit')) {
        toast({
          title: 'Rate Limit Exceeded',
          description: 'Too many requests. Please try again in a moment.',
          variant: 'destructive',
        });
      } else if (error.message?.includes('Payment required')) {
        toast({
          title: 'Credits Required',
          description: 'Please add credits to your Lovable AI workspace to use OCR.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Extraction Failed',
          description: 'Could not read insurance card. Please enter information manually.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsExtractingOCR(false);
    }
  };

  const handleSubmit = async (data: InsuranceFormData) => {
    if (!customerId || !tenantId) return;

    const { same_as_client, ...insuranceData } = data;
    
    await onSubmit({
      ...insuranceData,
      customer_id: customerId,
      tenant_id: tenantId,
      insurance_card_front: frontCardFile,
      insurance_card_back: backCardFile,
    });

    // Reset file states
    setFrontCardFile(null);
    setBackCardFile(null);
    setFrontCardPreview(null);
    setBackCardPreview(null);
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editPolicy ? 'Edit Insurance' : 'Add Insurance'}</DialogTitle>
          <DialogDescription>
            {editPolicy ? 'Update your insurance information' : 'Add your insurance information to streamline billing'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Insurance Company Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Insurance Company Information</h3>
              
              <FormField
                control={form.control}
                name="insurance_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Insurance Type *</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex gap-4"
                      >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="primary" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">Primary</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="secondary" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">Secondary</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="tertiary" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">Tertiary</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Insurance Company Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Blue Cross Blue Shield" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="policy_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Policy Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="Policy #" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="group_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Group #" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Insured Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Insured Information</h3>

              {!editPolicy && (
                <FormField
                  control={form.control}
                  name="same_as_client"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            handleSameAsClientChange(checked as boolean);
                          }}
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">
                        Same as client (auto-fill information)
                      </FormLabel>
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="relationship_to_patient"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship to Patient *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={fieldsDisabled}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Self">Self</SelectItem>
                        <SelectItem value="Spouse">Spouse</SelectItem>
                        <SelectItem value="Child">Child</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="insured_name_first"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="First name" {...field} disabled={fieldsDisabled} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="insured_name_middle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Middle Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Middle name" {...field} disabled={fieldsDisabled} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="insured_name_last"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" {...field} disabled={fieldsDisabled} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="insured_dob"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                              disabled={fieldsDisabled}
                            >
                              {field.value ? format(new Date(field.value), 'PPP') : 'Pick a date'}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                            disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="insured_sex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sex *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={fieldsDisabled}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sex" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="M">Male</SelectItem>
                          <SelectItem value="F">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Insured Address */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Insured Address</h3>

              <FormField
                control={form.control}
                name="insured_address_1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 1 *</FormLabel>
                    <FormControl>
                      <Input placeholder="Street address" {...field} disabled={fieldsDisabled} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="insured_address_2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input placeholder="Apt, Suite, Unit" {...field} disabled={fieldsDisabled} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="insured_city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City *</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} disabled={fieldsDisabled} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="insured_state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={fieldsDisabled}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="State" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {US_STATES.map((state) => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="insured_zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="12345" {...field} disabled={fieldsDisabled} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Additional Information</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ins_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="1234567890" 
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormDescription>10 digits, no spaces or dashes</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ins_employer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employer</FormLabel>
                      <FormControl>
                        <Input placeholder="Employer name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="ins_plan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., PPO, HMO, EPO" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Insurance Card Images */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Insurance Card Images</h3>
                {isExtractingOCR && (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    <span>Extracting info with AI...</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Upload photos of the front and back of your insurance card. AI will automatically extract and fill in the details.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Front Card Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Front of Card</label>
                  {frontCardPreview || editPolicy?.insurance_card_front_url ? (
                    <div className="space-y-2">
                      <div className="relative border-2 border-dashed rounded-lg p-2">
                        <img
                          src={frontCardPreview || editPolicy?.insurance_card_front_url || ''}
                          alt="Front of insurance card"
                          className="w-full h-40 object-contain rounded"
                        />
                        {frontCardPreview && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-8 w-8"
                            onClick={clearFrontCard}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {(frontCardPreview || editPolicy?.insurance_card_front_url) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => extractInsuranceInfo(
                            frontCardPreview || editPolicy?.insurance_card_front_url || '',
                            'front'
                          )}
                          disabled={isExtractingOCR}
                        >
                          {isExtractingOCR ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Extracting...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Extract Info with AI
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground text-center px-2">
                          Click to upload front
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG, PDF (max 5MB)
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                        onChange={handleFrontCardChange}
                      />
                    </label>
                  )}
                </div>

                {/* Back Card Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Back of Card</label>
                  {backCardPreview || editPolicy?.insurance_card_back_url ? (
                    <div className="space-y-2">
                      <div className="relative border-2 border-dashed rounded-lg p-2">
                        <img
                          src={backCardPreview || editPolicy?.insurance_card_back_url || ''}
                          alt="Back of insurance card"
                          className="w-full h-40 object-contain rounded"
                        />
                        {backCardPreview && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-8 w-8"
                            onClick={clearBackCard}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {(backCardPreview || editPolicy?.insurance_card_back_url) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => extractInsuranceInfo(
                            backCardPreview || editPolicy?.insurance_card_back_url || '',
                            'back'
                          )}
                          disabled={isExtractingOCR}
                        >
                          {isExtractingOCR ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Extracting...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Extract Info with AI
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground text-center px-2">
                          Click to upload back
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG, PDF (max 5MB)
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                        onChange={handleBackCardChange}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editPolicy ? 'Update Insurance' : 'Add Insurance'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
