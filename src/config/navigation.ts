import { 
  Home, 
  Briefcase, 
  Users, 
  FileText, 
  Receipt, 
  Calendar,
  Settings,
  User,
  DollarSign,
  CheckCircle,
  FileCheck,
  CreditCard,
} from "lucide-react";
import { STAFF_ROUTES, CLIENT_ROUTES, BILLING_ROUTES } from "./routes";

export const STAFF_NAVIGATION = [
  { name: "Dashboard", href: STAFF_ROUTES.DASHBOARD, icon: Home },
  { name: "Appointments", href: STAFF_ROUTES.APPOINTMENTS, icon: Briefcase },
  { name: "Clients", href: STAFF_ROUTES.CLIENTS, icon: Users },
  { name: "All Clients", href: STAFF_ROUTES.ALL_CLIENTS, icon: Users, requireAdmin: true },
  { name: "Invoices", href: STAFF_ROUTES.INVOICES, icon: Receipt, permission: "access_invoicing" },
  { name: "Calendar", href: STAFF_ROUTES.CALENDAR, icon: Calendar },
  { name: "Forms", href: STAFF_ROUTES.FORMS, icon: FileText, requireAdmin: true },
  { name: "Profile", href: STAFF_ROUTES.PROFILE, icon: User },
  { name: "Settings", href: STAFF_ROUTES.SETTINGS, icon: Settings, requireAdmin: true },
] as const;

export const BILLING_NAVIGATION = [
  { name: "Dashboard", href: BILLING_ROUTES.DASHBOARD, icon: DollarSign },
  { name: "Eligibility Check", href: BILLING_ROUTES.ELIGIBILITY, icon: CheckCircle },
  { name: "Claims", href: BILLING_ROUTES.CLAIMS, icon: FileCheck },
  { name: "Remittances", href: BILLING_ROUTES.REMITTANCES, icon: CreditCard },
] as const;

// Legacy export - kept for backward compatibility
export const CONTRACTOR_NAVIGATION = STAFF_NAVIGATION;
