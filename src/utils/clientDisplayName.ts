/**
 * Centralized utility for computing client display names
 * Provides a consistent fallback chain across the entire application
 */

export interface ClientDisplayData {
  pat_name_f?: string | null;
  pat_name_m?: string | null;
  pat_name_l?: string | null;
  pat_name_preferred?: string | null;
  email?: string | null;
  full_name?: string | null;
}

/**
 * Get the display name for a client with robust fallback chain:
 * 1. First/Middle/Last name (if computed)
 * 2. full_name (if already computed)
 * 3. Preferred name
 * 4. Email
 * 5. "Unnamed Patient" as last resort
 */
export function getClientDisplayName(client: ClientDisplayData): string {
  // If full_name already computed and valid, use it
  if (client.full_name && client.full_name !== 'Unknown Patient') {
    return client.full_name;
  }
  
  // Compute from name parts
  const patientName = [
    client.pat_name_f,
    client.pat_name_m,
    client.pat_name_l
  ].filter(Boolean).join(' ').trim();
  
  // Fallback chain
  return patientName || 
         client.pat_name_preferred || 
         client.email || 
         'Unnamed Patient';
}
