import { z } from 'zod';

export const BusinessAddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  country: z.string().default('USA'),
});

export const TaxSettingsSchema = z.object({
  default_tax_rate: z.number().min(0).max(100),
  tax_label: z.string(),
  tax_id_number: z.string().optional(),
  allow_tax_exempt: z.boolean().optional(),
});

export const InvoiceSettingsSchema = z.object({
  invoice_prefix: z.string().optional(),
  quote_prefix: z.string().optional(),
  auto_numbering: z.boolean().optional(),
  default_payment_terms: z.string().optional(),
  default_invoice_notes: z.string().optional(),
  default_quote_terms: z.string().optional(),
});

export const PaymentSettingsSchema = z.object({
  paypal_me_link: z.string().optional(),
  venmo_handle: z.string().optional(),
  other_instructions: z.string().optional(),
  bank_account: z.string().optional(),
});

export type BusinessAddress = z.infer<typeof BusinessAddressSchema>;
export type TaxSettings = z.infer<typeof TaxSettingsSchema>;
export type InvoiceSettings = z.infer<typeof InvoiceSettingsSchema>;
export type PaymentSettings = z.infer<typeof PaymentSettingsSchema>;
