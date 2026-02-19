import { useEffect } from 'react';
import { generateBrandColorPalette, DEFAULT_BRAND_COLORS, hexToHsl } from '@/lib/colorUtils';
import { useTenantBranding } from '@/hooks/useTenantBranding';

interface BrandColorProviderProps {
  children: React.ReactNode;
}

const DEFAULT_SECONDARY_HSL = '160 84% 39%'; // #10B981

/**
 * Brand Color Provider - Dynamically injects CSS variables based on brand color setting
 * Temporarily simplified to avoid auth context issues until database is set up
 */
export function BrandColorProvider({ children }: BrandColorProviderProps) {
  const { brandColors } = useTenantBranding();

  useEffect(() => {
    // Apply default brand colors until database is properly set up
    const colorPalette = DEFAULT_BRAND_COLORS;

    // Get root element to inject CSS variables
    const root = document.documentElement;

    // Update light theme variables
    root.style.setProperty('--primary', colorPalette.light.primary);
    root.style.setProperty('--primary-dark', colorPalette.light.primaryDark);
    root.style.setProperty('--primary-light', colorPalette.light.primaryLight);
    root.style.setProperty('--ring', colorPalette.light.ring);

    // Update dark theme variables by creating/updating CSS rule
    updateDarkThemeVariables(colorPalette.dark);
  }, []);

  // Inject --brand-secondary CSS variable from tenant's secondary brand color
  useEffect(() => {
    const root = document.documentElement;
    let hsl = DEFAULT_SECONDARY_HSL;

    if (brandColors.secondary) {
      const converted = hexToHsl(brandColors.secondary);
      if (converted) {
        hsl = converted;
      }
    }

    root.style.setProperty('--brand-secondary', hsl);
  }, [brandColors.secondary]);

  return <>{children}</>;
}

/**
 * Update dark theme CSS variables
 */
function updateDarkThemeVariables(darkColors: {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  ring: string;
}) {
  // Find or create the dark theme style element
  let darkStyleElement = document.getElementById('dynamic-dark-theme') as HTMLStyleElement;
  
  if (!darkStyleElement) {
    darkStyleElement = document.createElement('style');
    darkStyleElement.id = 'dynamic-dark-theme';
    document.head.appendChild(darkStyleElement);
  }

  // Update dark theme CSS
  darkStyleElement.textContent = `
    .dark {
      --primary: ${darkColors.primary};
      --primary-dark: ${darkColors.primaryDark};
      --primary-light: ${darkColors.primaryLight};
      --ring: ${darkColors.ring};
    }
  `;
}
