/**
 * Centralized utility for computing customer display names
 * Provides a consistent fallback chain across the entire application
 */

export interface CustomerDisplayData {
  pat_name_f?: string | null;
  pat_name_m?: string | null;
  pat_name_l?: string | null;
  preferred_name?: string | null;
  email?: string | null;
  full_name?: string | null;
}

/**
 * Get the display name for a customer with robust fallback chain:
 * 1. First/Middle/Last name (if computed)
 * 2. full_name (if already computed)
 * 3. Preferred name
 * 4. Email
 * 5. "Unnamed Customer" as last resort
 */
export function getCustomerDisplayName(customer: CustomerDisplayData): string {
  // If full_name already computed and valid, use it
  if (customer.full_name && customer.full_name !== 'Unknown Patient') {
    return customer.full_name;
  }
  
  // Compute from name parts
  const patientName = [
    customer.pat_name_f,
    customer.pat_name_m,
    customer.pat_name_l
  ].filter(Boolean).join(' ').trim();
  
  // Fallback chain
  return patientName || 
         customer.preferred_name || 
         customer.email || 
         'Unnamed Customer';
}
