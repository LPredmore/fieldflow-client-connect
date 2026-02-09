import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, UserCheck, Mail, ArrowLeft, AlertCircle, KeyRound, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import valorwellLogo from '@/assets/valorwell-logo.png';
export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showUpdatePassword, setShowUpdatePassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const {
    signIn,
    signUp,
    resetPassword,
    user,
    loading: authLoading,
    isPasswordRecovery,
    clearPasswordRecovery
  } = useAuth();
  const {
    displayName
  } = useTenantBranding();
  const navigate = useNavigate();
  const location = useLocation();

  // Check for password recovery token in URL (query param or hash)
  useEffect(() => {
    const handlePasswordRecovery = async () => {
      const searchParams = new URLSearchParams(location.search);
      const hashParams = new URLSearchParams(location.hash.slice(1));
      const isResetMode = searchParams.get('mode') === 'reset';
      const isRecoveryType = hashParams.get('type') === 'recovery';
      const code = searchParams.get('code');

      // Handle PKCE code exchange if present
      if (code) {
        try {
          const {
            error
          } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setAuthError(`Failed to process reset link: ${error.message}`);
            return;
          }
          // Clear the code from URL after successful exchange
          window.history.replaceState(null, '', location.pathname + (isResetMode ? '?mode=reset' : ''));
        } catch (err) {
          setAuthError('Failed to process reset link');
          return;
        }
      }

      // Show password update form if this is a reset flow
      if (isResetMode || isRecoveryType) {
        setShowUpdatePassword(true);
        setShowForgotPassword(false);
        setIsLogin(true);
      }
    };
    handlePasswordRecovery();
  }, [location.search, location.hash]);

  // Show password update form when PASSWORD_RECOVERY event fires
  useEffect(() => {
    if (isPasswordRecovery) {
      setShowUpdatePassword(true);
      setShowForgotPassword(false);
      setIsLogin(true);
    }
  }, [isPasswordRecovery]);

  // Redirect to main page if already authenticated (but not during password recovery)
  useEffect(() => {
    if (user && !authLoading && !isPasswordRecovery && !showUpdatePassword) {
      const redirectTo = (location.state as any)?.from?.pathname || '/';
      navigate(redirectTo, {
        replace: true
      });
    }
  }, [user, authLoading, navigate, location, isPasswordRecovery, showUpdatePassword]);
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    setSuccessMessage(null);
    if (newPassword !== confirmPassword) {
      setAuthError('Passwords do not match');
      setLoading(false);
      return;
    }
    if (newPassword.length < 6) {
      setAuthError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }
    try {
      const {
        error
      } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) {
        setAuthError(error.message);
      } else {
        // Clear recovery state, sign out, then show success
        clearPasswordRecovery();
        setShowUpdatePassword(false);
        setNewPassword('');
        setConfirmPassword('');
        window.history.replaceState(null, '', location.pathname);
        await supabase.auth.signOut();
        setSuccessMessage('Password updated successfully! Please sign in with your new password.');
      }
    } finally {
      setLoading(false);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    setSuccessMessage(null);
    try {
      if (showForgotPassword) {
        const {
          error
        } = await resetPassword(email);
        if (error) {
          setAuthError(error.message);
        } else {
          setSuccessMessage('Password reset email sent! Check your inbox.');
          setShowForgotPassword(false);
          setEmail('');
        }
      } else if (isLogin) {
        const {
          error
        } = await signIn(email, password);
        if (error) {
          setAuthError(error.message);
        } else {
          const redirectTo = (location.state as any)?.from?.pathname || '/';
          navigate(redirectTo, {
            replace: true
          });
        }
      } else {
        const {
          error
        } = await signUp(email, password, firstName, lastName, phone, companyName, 'contractor');
        if (error) {
          setAuthError(error.message);
        } else {
          // Stay on auth page to show confirmation message
          setIsLogin(true);
          setEmail('');
          setPassword('');
          setFirstName('');
          setLastName('');
          setPhone('');
          setCompanyName('');
        }
      }
    } finally {
      setLoading(false);
    }
  };
  if (authLoading) {
    return <div className="min-h-screen bg-gradient-to-br from-primary-light/10 to-accent/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }
  return <div className="min-h-screen bg-gradient-to-br from-primary-light/10 to-accent/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex flex-col items-center justify-center space-y-3">
            <img src={valorwellLogo} alt="ValorWell Logo" className="h-20 w-20 object-contain" />
            <h1 className="text-3xl font-bold text-foreground">
              Welcome to ValorWell
            </h1>
          </div>
          <p className="text-muted-foreground">
            Your mental health practice management platform
          </p>
        </div>

        <Card className="shadow-material-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold text-center">
              {showUpdatePassword ? 'Set new password' : showForgotPassword ? 'Reset your password' : isLogin ? 'Welcome back' : 'Create your account'}
            </CardTitle>
            <CardDescription className="text-center">
              {showUpdatePassword ? 'Enter your new password below' : showForgotPassword ? 'Enter your email address to receive a password reset link' : isLogin ? `Sign in to your ${displayName || 'ValorWell'} account` : `Get started with ${displayName || 'ValorWell'} today`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Success Message */}
            {successMessage && <Alert className="border-primary/30 bg-primary/5">
                <CheckCircle className="h-4 w-4 text-primary" />
                <AlertDescription className="text-foreground">{successMessage}</AlertDescription>
              </Alert>}

            {/* Update Password Form */}
            {showUpdatePassword && <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input id="newPassword" placeholder="Enter new password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} className="transition-all duration-normal" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input id="confirmPassword" placeholder="Confirm new password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} className="transition-all duration-normal" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating password...
                    </> : <>
                      <KeyRound className="mr-2 h-4 w-4" />
                      Update Password
                    </>}
                </Button>
              </form>}
            {/* Login / Signup / Forgot Password Forms */}
            {!showUpdatePassword && <>
            {showForgotPassword && <Button variant="ghost" onClick={() => {
              setShowForgotPassword(false);
              setEmail('');
            }} className="mb-4 p-0 h-auto text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to sign in
              </Button>}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && !showForgotPassword && <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" placeholder="Enter your first name" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required={!isLogin} className="transition-all duration-normal" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" placeholder="Enter your last name" type="text" value={lastName} onChange={e => setLastName(e.target.value)} required={!isLogin} className="transition-all duration-normal" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" placeholder="Enter your phone number" type="tel" value={phone} onChange={e => setPhone(e.target.value)} required={!isLogin} className="transition-all duration-normal" />
                  </div>
                  
                  {!isLogin && <div className="space-y-2">
                      <Label htmlFor="companyName">Practice/Organization Name</Label>
                      <Input id="companyName" placeholder="Enter your practice or organization name" type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required={!isLogin} className="transition-all duration-normal" />
                    </div>}
                </>}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" placeholder="Enter your email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="transition-all duration-normal" />
              </div>
              
              {!showForgotPassword && <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {isLogin && <Button type="button" variant="link" onClick={() => setShowForgotPassword(true)} className="p-0 h-auto text-sm text-muted-foreground hover:text-foreground">
                        Forgot password?
                      </Button>}
                  </div>
                  <Input id="password" placeholder="Enter your password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="transition-all duration-normal" />
                </div>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {showForgotPassword ? 'Sending email...' : isLogin ? 'Signing in...' : 'Creating account...'}
                  </> : <>
                    {showForgotPassword ? <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Reset Email
                      </> : <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    {isLogin ? 'Sign In' : 'Sign Up as Staff'}
                  </>}
                  </>}
              </Button>
            </form>

            {!showForgotPassword && <>
                <Separator />

                
              </>}
              </>}
          </CardContent>
        </Card>

        {/* Show error if there's an authentication error */}
        {authError && <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{authError}</AlertDescription>
          </Alert>}

        <p className="text-xs text-center text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>;
}