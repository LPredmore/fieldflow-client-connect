import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Upload, ChevronDown, Building2, MapPin, FileText } from "lucide-react";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { US_STATES } from "@/constants/usStates";
import { supabase } from "@/integrations/supabase/client";
import { hexToHsl } from "@/lib/colorUtils";

const formSchema = z.object({
  // Organization
  organization: z.object({
    display_name: z.string().min(1, "Organization name is required"),
    logo_url: z.string().optional(),
    brand_primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional().or(z.literal("")),
    brand_secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional().or(z.literal("")),
    brand_accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional().or(z.literal("")),
  }),
  // Primary Location
  location: z.object({
    name: z.string().min(1, "Location name is required"),
    svc_npi: z.string().optional().or(z.literal("")),
    svc_taxonomy: z.string().optional().or(z.literal("")),
    svc_taxid: z.string().optional().or(z.literal("")),
    svc_taxid_type: z.enum(['EIN', 'SSN']).default('EIN'),
    addr_1: z.string().optional().or(z.literal("")),
    addr_2: z.string().optional().or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
    state: z.string().optional().or(z.literal("")),
    zip: z.string().optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    fax: z.string().optional().or(z.literal("")),
  }),
  // Billing Info
  billing: z.object({
    sameAsLocation: z.boolean().default(false),
    bill_name: z.string().min(1, "Billing name is required"),
    bill_npi: z.string().optional().or(z.literal("")),
    bill_taxonomy: z.string().optional().or(z.literal("")),
    bill_taxid: z.string().min(1, "Tax ID is required"),
    bill_taxid_type: z.enum(['EIN', 'SSN']).default('EIN'),
    bill_addr_1: z.string().optional().or(z.literal("")),
    bill_addr_2: z.string().optional().or(z.literal("")),
    bill_city: z.string().optional().or(z.literal("")),
    bill_state: z.string().optional().or(z.literal("")),
    bill_zip: z.string().optional().or(z.literal("")),
    bill_phone: z.string().optional().or(z.literal("")),
    bill_email: z.string().email("Invalid email").optional().or(z.literal("")),
  }),
});

type FormData = z.infer<typeof formSchema>;

export default function BusinessSettings() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [orgOpen, setOrgOpen] = useState(true);
  const [locationOpen, setLocationOpen] = useState(true);
  const [billingOpen, setBillingOpen] = useState(true);
  
  const { tenant, location, billing, loading, updateTenant, updateLocation, updateBilling } = useBusinessProfile();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      organization: {
        display_name: "",
        logo_url: "",
        brand_primary_color: "#3B82F6",
        brand_secondary_color: "#10B981",
        brand_accent_color: "#F59E0B",
      },
      location: {
        name: "",
        svc_npi: "",
        svc_taxonomy: "",
        svc_taxid: "",
        svc_taxid_type: "EIN",
        addr_1: "",
        addr_2: "",
        city: "",
        state: "",
        zip: "",
        phone: "",
        email: "",
        fax: "",
      },
      billing: {
        sameAsLocation: false,
        bill_name: "",
        bill_npi: "",
        bill_taxonomy: "",
        bill_taxid: "",
        bill_taxid_type: "EIN",
        bill_addr_1: "",
        bill_addr_2: "",
        bill_city: "",
        bill_state: "",
        bill_zip: "",
        bill_phone: "",
        bill_email: "",
      },
    },
  });

  // Watch "Same as Location" checkbox
  const sameAsLocation = form.watch('billing.sameAsLocation');

  // Apply real-time color changes
  const primaryColor = form.watch('organization.brand_primary_color');
  const secondaryColor = form.watch('organization.brand_secondary_color');
  const accentColor = form.watch('organization.brand_accent_color');

  useEffect(() => {
    const root = document.documentElement;
    if (primaryColor) {
      const hsl = hexToHsl(primaryColor);
      if (hsl) root.style.setProperty('--primary', hsl);
    }
    if (secondaryColor) {
      const hsl = hexToHsl(secondaryColor);
      if (hsl) root.style.setProperty('--secondary', hsl);
    }
    if (accentColor) {
      const hsl = hexToHsl(accentColor);
      if (hsl) root.style.setProperty('--accent', hsl);
    }
  }, [primaryColor, secondaryColor, accentColor]);

  // Load data into form
  useEffect(() => {
    if (tenant || location || billing) {
      form.reset({
        organization: {
          display_name: tenant?.display_name || "",
          logo_url: tenant?.logo_url || "",
          brand_primary_color: tenant?.brand_primary_color || "#3B82F6",
          brand_secondary_color: tenant?.brand_secondary_color || "#10B981",
          brand_accent_color: tenant?.brand_accent_color || "#F59E0B",
        },
        location: {
          name: location?.name || "",
          svc_npi: location?.svc_npi || "",
          svc_taxonomy: location?.svc_taxonomy || "",
          svc_taxid: location?.svc_taxid || "",
          svc_taxid_type: (location?.svc_taxid_type as 'EIN' | 'SSN') || "EIN",
          addr_1: location?.addr_1 || "",
          addr_2: location?.addr_2 || "",
          city: location?.city || "",
          state: location?.state || "",
          zip: location?.zip || "",
          phone: location?.phone || "",
          email: location?.email || "",
          fax: location?.fax || "",
        },
        billing: {
          sameAsLocation: false,
          bill_name: billing?.bill_name || "",
          bill_npi: billing?.bill_npi || "",
          bill_taxonomy: billing?.bill_taxonomy || "",
          bill_taxid: billing?.bill_taxid || "",
          bill_taxid_type: (billing?.bill_taxid_type as 'EIN' | 'SSN') || "EIN",
          bill_addr_1: billing?.bill_addr_1 || "",
          bill_addr_2: billing?.bill_addr_2 || "",
          bill_city: billing?.bill_city || "",
          bill_state: billing?.bill_state || "",
          bill_zip: billing?.bill_zip || "",
          bill_phone: billing?.bill_phone || "",
          bill_email: billing?.bill_email || "",
        },
      });
    }
  }, [tenant, location, billing, form]);

  // Copy location to billing when checkbox is checked
  useEffect(() => {
    if (sameAsLocation) {
      const locationValues = form.getValues('location');
      form.setValue('billing.bill_name', locationValues.name);
      form.setValue('billing.bill_npi', locationValues.svc_npi || "");
      form.setValue('billing.bill_taxonomy', locationValues.svc_taxonomy || "");
      form.setValue('billing.bill_taxid', locationValues.svc_taxid || "");
      form.setValue('billing.bill_taxid_type', locationValues.svc_taxid_type);
      form.setValue('billing.bill_addr_1', locationValues.addr_1 || "");
      form.setValue('billing.bill_addr_2', locationValues.addr_2 || "");
      form.setValue('billing.bill_city', locationValues.city || "");
      form.setValue('billing.bill_state', locationValues.state || "");
      form.setValue('billing.bill_zip', locationValues.zip || "");
      form.setValue('billing.bill_phone', locationValues.phone || "");
      form.setValue('billing.bill_email', locationValues.email || "");
    }
  }, [sameAsLocation, form]);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !tenant) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${tenant.id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('org-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('org-logos')
        .getPublicUrl(filePath);

      form.setValue('organization.logo_url', publicUrl);
    } catch (error: any) {
      console.error('Logo upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // Destructure out UI-only field before database save
      const { sameAsLocation, ...billingData } = data.billing;
      
      await Promise.all([
        updateTenant(data.organization),
        updateLocation({
          ...data.location,
          state: data.location.state || undefined,
        } as any),
        updateBilling({
          ...billingData,
          bill_state: data.billing.bill_state || undefined,
        } as any),
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && !tenant) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Organization Settings */}
        <Collapsible open={orgOpen} onOpenChange={setOrgOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle>Organization Settings</CardTitle>
                      <CardDescription>Configure your organization branding and identity</CardDescription>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${orgOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6 pt-6">
                <FormField
                  control={form.control}
                  name="organization.display_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Your Organization" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium">Company Logo</label>
                  <div className="relative border-2 border-dashed border-border rounded-lg p-6 text-center bg-card hover:bg-accent/10 transition-colors">
                    {form.watch('organization.logo_url') ? (
                      <div className="space-y-3">
                        <img 
                          src={form.watch('organization.logo_url')} 
                          alt="Company Logo" 
                          className="h-20 mx-auto object-contain"
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => form.setValue('organization.logo_url', '')}
                        >
                          Remove Logo
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Click to upload logo</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG (max 2MB)</p>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={isUploading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {['brand_primary_color', 'brand_secondary_color', 'brand_accent_color'].map((colorField) => (
                    <FormField
                      key={colorField}
                      control={form.control}
                      name={`organization.${colorField}` as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{colorField.split('_')[1].charAt(0).toUpperCase() + colorField.split('_')[1].slice(1)} Color</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input type="color" className="w-16 h-10" {...field} />
                            </FormControl>
                            <FormControl>
                              <Input placeholder="#3B82F6" {...field} />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Primary Location */}
        <Collapsible open={locationOpen} onOpenChange={setLocationOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle>Primary Location</CardTitle>
                      <CardDescription>Service location and contact information</CardDescription>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${locationOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="location.name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Main Office" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location.svc_npi"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location NPI</FormLabel>
                        <FormControl>
                          <Input placeholder="1234567890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location.svc_taxonomy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Taxonomy Code</FormLabel>
                        <FormControl>
                          <Input placeholder="1234567890X" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location.svc_taxid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax ID</FormLabel>
                        <FormControl>
                          <Input placeholder="12-3456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location.svc_taxid_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax ID Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="EIN">EIN</SelectItem>
                            <SelectItem value="SSN">SSN</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="location.addr_1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location.addr_2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address 2</FormLabel>
                        <FormControl>
                          <Input placeholder="Suite 100" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="location.city"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                    name="location.zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP</FormLabel>
                        <FormControl>
                          <Input placeholder="12345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="location.phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="(555) 123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location.email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="contact@clinic.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location.fax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fax</FormLabel>
                        <FormControl>
                          <Input placeholder="(555) 123-4568" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Billing Information */}
        <Collapsible open={billingOpen} onOpenChange={setBillingOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle>Billing Information</CardTitle>
                      <CardDescription>Insurance claims and billing details</CardDescription>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${billingOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6 pt-6">
                <FormField
                  control={form.control}
                  name="billing.sameAsLocation"
                  render={({ field }) => (
                    <FormItem className="flex items-start space-x-3 space-y-0 rounded-md border border-border p-4 bg-accent/10">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Same as Location Info</FormLabel>
                        <FormDescription>
                          Automatically copy location information to billing fields
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="billing.bill_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Billing Entity Name" {...field} disabled={sameAsLocation} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billing.bill_npi"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing NPI</FormLabel>
                        <FormControl>
                          <Input placeholder="1234567890" {...field} disabled={sameAsLocation} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billing.bill_taxonomy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Taxonomy</FormLabel>
                        <FormControl>
                          <Input placeholder="1234567890X" {...field} disabled={sameAsLocation} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billing.bill_taxid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Tax ID *</FormLabel>
                        <FormControl>
                          <Input placeholder="12-3456789" {...field} disabled={sameAsLocation} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billing.bill_taxid_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax ID Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={sameAsLocation}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="EIN">EIN</SelectItem>
                            <SelectItem value="SSN">SSN</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="billing.bill_addr_1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St" {...field} disabled={sameAsLocation} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billing.bill_addr_2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Address 2</FormLabel>
                        <FormControl>
                          <Input placeholder="Suite 100" {...field} disabled={sameAsLocation} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="billing.bill_city"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} disabled={sameAsLocation} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billing.bill_state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={sameAsLocation}>
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
                    name="billing.bill_zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP</FormLabel>
                        <FormControl>
                          <Input placeholder="12345" {...field} disabled={sameAsLocation} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="billing.bill_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="(555) 123-4567" {...field} disabled={sameAsLocation} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billing.bill_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="billing@clinic.com" {...field} disabled={sameAsLocation} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Changes...
              </>
            ) : (
              'Save All Changes'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
