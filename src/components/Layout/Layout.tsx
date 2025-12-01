import { ReactNode } from 'react';
import Navigation from '@/components/Layout/Navigation';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Layout component optimized for conditional data loading.
 * 
 * This component is intentionally minimal and does not trigger any data loading
 * to prevent unnecessary queries on route changes. All data loading is handled
 * by individual page components based on their specific needs.
 * 
 * The Navigation component also follows this pattern and does not load
 * appointment or business data globally.
 */
export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Main Content */}
      <div className="lg:ml-64">
        {children}
      </div>
    </div>
  );
}