/**
 * Authentication-specific Supabase client wrapper
 * 
 * Provides authentication methods that bypass the circuit breaker
 * to prevent login blocking during network issues.
 */

import { supabase } from '@/integrations/supabase/client';
import { authDebugger } from './authDebugger';

/**
 * Authentication client that bypasses circuit breaker restrictions
 * 
 * This ensures that authentication requests are never blocked by the
 * circuit breaker, preventing users from being locked out during
 * temporary network issues or when the circuit breaker is triggered
 * by other operations.
 */
export class AuthSupabaseClient {
  /**
   * Sign in with email and password - bypasses circuit breaker
   */
  async signInWithPassword(credentials: { email: string; password: string }) {
    authDebugger.log('AUTH_CLIENT', 'Direct auth request (bypassing circuit breaker)', credentials.email);
    
    try {
      // Direct call to Supabase auth - no circuit breaker involvement
      const result = await supabase.auth.signInWithPassword(credentials);
      
      if (result.error) {
        authDebugger.log('AUTH_CLIENT', 'Auth request failed', {
          error: result.error.message,
          email: credentials.email
        });
      } else {
        authDebugger.log('AUTH_CLIENT', 'Auth request successful', credentials.email);
      }
      
      return result;
    } catch (error) {
      authDebugger.logNetworkError(error, 'AuthSupabaseClient.signInWithPassword');
      throw error;
    }
  }

  /**
   * Sign up with email and password - bypasses circuit breaker
   */
  async signUp(credentials: {
    email: string;
    password: string;
    options?: {
      emailRedirectTo?: string;
      data?: Record<string, any>;
    };
  }) {
    authDebugger.log('AUTH_CLIENT', 'Direct signup request (bypassing circuit breaker)', credentials.email);
    
    try {
      const result = await supabase.auth.signUp(credentials);
      
      if (result.error) {
        authDebugger.log('AUTH_CLIENT', 'Signup request failed', {
          error: result.error.message,
          email: credentials.email
        });
      } else {
        authDebugger.log('AUTH_CLIENT', 'Signup request successful', credentials.email);
      }
      
      return result;
    } catch (error) {
      authDebugger.logNetworkError(error, 'AuthSupabaseClient.signUp');
      throw error;
    }
  }

  /**
   * Reset password - bypasses circuit breaker
   */
  async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
    authDebugger.log('AUTH_CLIENT', 'Direct password reset request (bypassing circuit breaker)', email);
    
    try {
      const result = await supabase.auth.resetPasswordForEmail(email, options);
      
      if (result.error) {
        authDebugger.log('AUTH_CLIENT', 'Password reset request failed', {
          error: result.error.message,
          email
        });
      } else {
        authDebugger.log('AUTH_CLIENT', 'Password reset request successful', email);
      }
      
      return result;
    } catch (error) {
      authDebugger.logNetworkError(error, 'AuthSupabaseClient.resetPasswordForEmail');
      throw error;
    }
  }

  /**
   * Sign out - bypasses circuit breaker
   */
  async signOut() {
    authDebugger.log('AUTH_CLIENT', 'Direct signout request (bypassing circuit breaker)');
    
    try {
      const result = await supabase.auth.signOut();
      
      if (result.error) {
        authDebugger.log('AUTH_CLIENT', 'Signout request failed', result.error.message);
      } else {
        authDebugger.log('AUTH_CLIENT', 'Signout request successful');
      }
      
      return result;
    } catch (error) {
      authDebugger.logNetworkError(error, 'AuthSupabaseClient.signOut');
      throw error;
    }
  }

  /**
   * Get current session - bypasses circuit breaker
   */
  async getSession() {
    try {
      return await supabase.auth.getSession();
    } catch (error) {
      authDebugger.logNetworkError(error, 'AuthSupabaseClient.getSession');
      throw error;
    }
  }

  /**
   * Get auth event listener - direct access
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

// Export singleton instance
export const authSupabaseClient = new AuthSupabaseClient();