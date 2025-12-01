// Route configuration for the EHR system

export const CLIENT_ROUTES = {
  ROOT: '/client',
  DASHBOARD: '/client/dashboard',
  REGISTRATION: '/client/registration',
  SIGNUP_FORMS: '/client/signup-forms',
  COMPLETE_FORM: '/client/complete-form',
} as const;

export const STAFF_ROUTES = {
  ROOT: '/staff',
  DASHBOARD: '/staff/dashboard',
  APPOINTMENTS: '/staff/appointments',
  CUSTOMERS: '/staff/customers',
  SERVICES: '/staff/services',
  INVOICES: '/staff/invoices',
  CALENDAR: '/staff/calendar',
  FORMS: '/staff/forms',
  PROFILE: '/staff/profile',
  SETTINGS: '/staff/settings',
} as const;

// Legacy routes - kept for backward compatibility (temporary)
export const CONTRACTOR_ROUTES = STAFF_ROUTES;

export const BILLING_ROUTES = {
  ROOT: '/billing',
  DASHBOARD: '/billing/dashboard',
  ELIGIBILITY: '/billing/eligibility',
  CLAIMS: '/billing/claims',
  REMITTANCES: '/billing/remittances',
} as const;

export const PUBLIC_ROUTES = {
  AUTH: '/auth',
  PUBLIC_INVOICE: '/public-invoice',
} as const;

export type ClientRoute = typeof CLIENT_ROUTES[keyof typeof CLIENT_ROUTES];
export type StaffRoute = typeof STAFF_ROUTES[keyof typeof STAFF_ROUTES];
export type ContractorRoute = typeof CONTRACTOR_ROUTES[keyof typeof CONTRACTOR_ROUTES]; // Legacy
export type BillingRoute = typeof BILLING_ROUTES[keyof typeof BILLING_ROUTES];
export type PublicRoute = typeof PUBLIC_ROUTES[keyof typeof PUBLIC_ROUTES];