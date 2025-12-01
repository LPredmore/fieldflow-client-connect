import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

const formSchema = z.object({
  user_preferences: z.object({
    time_format: z.string(),
    date_format: z.string(),
    currency_symbol: z.string(),
    default_view: z.string(),
  }),
  notification_settings: z.object({
    email_notifications: z.boolean(),
    job_reminders: z.boolean(),
    overdue_invoice_alerts: z.boolean(),
    daily_summary: z.boolean(),
  }),
});

type FormData = z.infer<typeof formSchema>;

const TIME_FORMATS = [
  { value: "12", label: "12 Hour (2:30 PM)" },
  { value: "24", label: "24 Hour (14:30)" },
];

const DATE_FORMATS = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (12/25/2023)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (25/12/2023)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2023-12-25)" },
];

const CURRENCIES = [
  { value: "USD", label: "$ (US Dollar)" },
  { value: "EUR", label: "€ (Euro)" },
  { value: "GBP", label: "£ (British Pound)" },
  { value: "CAD", label: "C$ (Canadian Dollar)" },
];

const DEFAULT_VIEWS = [
  { value: "dashboard", label: "Dashboard" },
  { value: "jobs", label: "Jobs" },
  { value: "customers", label: "Customers" },
  { value: "invoices", label: "Invoices" },
];

const NOTIFICATION_OPTIONS = [
  {
    key: 'email_notifications' as const,
    title: 'Email Notifications',
    description: 'Master toggle for all email notifications',
    isMaster: true,
  },
  {
    key: 'job_reminders' as const,
    title: 'Job Reminders',
    description: 'Receive notifications for upcoming scheduled jobs',
  },
  {
    key: 'overdue_invoice_alerts' as const,
    title: 'Overdue Invoice Alerts',
    description: 'Receive alerts for invoices that are past their due date',
  },
  {
    key: 'daily_summary' as const,
    title: 'Daily Summary',
    description: 'Get a daily email with your schedule and key metrics',
  },
];

export default function UserPreferences() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { settings, loading, updateSettings, createSettings } = useSettings();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      user_preferences: {
        time_format: "12",
        date_format: "MM/DD/YYYY",
        currency_symbol: "USD",
        default_view: "dashboard",
      },
      notification_settings: {
        email_notifications: true,
        job_reminders: true,
        overdue_invoice_alerts: true,
        daily_summary: false,
      },
    },
  });

  useEffect(() => {
    if (settings) {
      const userPreferences = settings.user_preferences || {};
      const notificationSettings = settings.notification_settings || {};

      form.reset({
        user_preferences: {
          time_format: userPreferences.time_format || "12",
          date_format: userPreferences.date_format || "MM/DD/YYYY",
          currency_symbol: userPreferences.currency_symbol || "USD",
          default_view: userPreferences.default_view || "dashboard",
        },
        notification_settings: {
          email_notifications: notificationSettings.email_notifications ?? true,
          job_reminders: notificationSettings.job_reminders ?? true,
          overdue_invoice_alerts: notificationSettings.overdue_invoice_alerts ?? true,
          daily_summary: notificationSettings.daily_summary ?? false,
        },
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    try {
      const updateData = {
        user_preferences: data.user_preferences,
        notification_settings: data.notification_settings,
      };

      if (settings) {
        await updateSettings(updateData);
      } else {
        await createSettings(updateData);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const emailNotificationsEnabled = form.watch('notification_settings.email_notifications');

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Preferences & Notifications</CardTitle>
        <CardDescription>
          Customize your display, regional settings, and notification preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Display & Regional Preferences Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Display & Regional Preferences</h3>
                <p className="text-sm text-muted-foreground">
                  Configure time, date, currency, and default view settings
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="user_preferences.time_format"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time Format</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select time format" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIME_FORMATS.map((format) => (
                            <SelectItem key={format.value} value={format.value}>
                              {format.label}
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
                  name="user_preferences.date_format"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Format</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select date format" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DATE_FORMATS.map((format) => (
                            <SelectItem key={format.value} value={format.value}>
                              {format.label}
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
                  name="user_preferences.currency_symbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CURRENCIES.map((currency) => (
                            <SelectItem key={currency.value} value={currency.value}>
                              {currency.label}
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
                  name="user_preferences.default_view"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default View on Login</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select default view" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DEFAULT_VIEWS.map((view) => (
                            <SelectItem key={view.value} value={view.value}>
                              {view.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Notification Preferences Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Notification Preferences</h3>
                <p className="text-sm text-muted-foreground">
                  Configure your email and alert preferences
                </p>
              </div>
              <div className="space-y-4">
                {NOTIFICATION_OPTIONS.map((option) => (
                  <FormField
                    key={option.key}
                    control={form.control}
                    name={`notification_settings.${option.key}`}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start justify-between rounded-lg border p-4">
                        <div className="space-y-0.5 pr-4">
                          <FormLabel className="text-base font-medium">
                            {option.title}
                          </FormLabel>
                          <FormDescription className="text-sm text-muted-foreground">
                            {option.description}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={!('isMaster' in option) && !emailNotificationsEnabled}
                            className="ml-auto"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              {!emailNotificationsEnabled && (
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> Email notifications are disabled. Individual notification types 
                    will be automatically disabled until you enable the master email notifications toggle.
                  </p>
                </div>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
