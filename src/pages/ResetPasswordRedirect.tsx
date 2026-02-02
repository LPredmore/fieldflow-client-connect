import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * ResetPasswordRedirect handles the password reset flow from Supabase.
 * 
 * Supabase sends users to /reset-password with either:
 * 1. Hash parameters: #access_token=...&type=recovery
 * 2. Query parameters: ?code=... (PKCE flow)
 * 
 * This component:
 * 1. Exchanges the code/token for a session
 * 2. Redirects to /auth where the user can set a new password
 */
export default function ResetPasswordRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleRecoveryFlow = async () => {
      try {
        // Check for PKCE code in query params
        const searchParams = new URLSearchParams(location.search);
        const code = searchParams.get('code');
        
        if (code) {
          // Exchange the code for a session
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('Error exchanging code for session:', exchangeError);
            setError(exchangeError.message);
            return;
          }
        }
        
        // Check for hash parameters (older flow)
        const hashParams = new URLSearchParams(location.hash.slice(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');
        
        if (accessToken && type === 'recovery') {
          // Session should already be set by Supabase from the hash
          // Just verify we have a session
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            setError('Failed to establish session from recovery link');
            return;
          }
        }

        // Redirect to auth page - the AuthenticationProvider will handle the session
        // Preserve hash for the auth page to detect recovery mode
        navigate('/auth' + location.hash, { replace: true });
      } catch (err) {
        console.error('Error in recovery flow:', err);
        setError('An unexpected error occurred');
      }
    };

    handleRecoveryFlow();
  }, [location, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-light/10 to-accent/30 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Password Reset Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <button 
            onClick={() => navigate('/auth')}
            className="text-primary underline"
          >
            Return to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light/10 to-accent/30 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Processing password reset...</p>
      </div>
    </div>
  );
}
