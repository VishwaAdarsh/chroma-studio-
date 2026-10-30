import React, { useState, useEffect } from 'react';
import { ChromaLogo } from '../brand/ChromaLogo';
import { useAuth } from '../../contexts/AuthContext';

export type AuthViewMode = 'welcome' | 'signin' | 'signup' | 'forgot_password' | 'reset_password' | 'verify_email';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthViewMode;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'welcome',
}) => {
  const {
    user,
    isGuest,
    isRecoveryMode,
    signUp,
    signIn,
    signInWithGoogle,
    resetPassword,
    updatePassword,
    setGuestMode,
    clearRecoveryMode,
  } = useAuth();

  const [mode, setMode] = useState<AuthViewMode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isRecoveryMode) {
      setMode('reset_password');
    } else if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialMode, isRecoveryMode]);

  if (!isOpen && !isRecoveryMode) return null;

  // Form Validation
  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  const validateUsername = (val: string) => /^[a-zA-Z0-9_]{3,20}$/.test(val.trim());

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!validateEmail(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);

    if (error) {
      setErrorMsg(error.message || 'Failed to sign in. Please check your credentials.');
    } else {
      setSuccessMsg('Signed in successfully!');
      setTimeout(() => {
        onClose();
      }, 500);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (username.trim() && !validateUsername(username)) {
      setErrorMsg('Username must be 3–20 characters (letters, numbers, underscores).');
      return;
    }
    if (!validateEmail(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!agreeTerms) {
      setErrorMsg('Please accept the Terms of Service to create an account.');
      return;
    }

    setLoading(true);
    const { error, needsEmailVerification } = await signUp(
      email.trim(),
      password,
      fullName.trim(),
      username.trim() || undefined
    );
    setLoading(false);

    if (error) {
      setErrorMsg(error.message || 'Sign up failed. Please try again.');
    } else if (needsEmailVerification) {
      setMode('verify_email');
    } else {
      setSuccessMsg('Account created and signed in!');
      setTimeout(() => {
        onClose();
      }, 600);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!validateEmail(email)) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(email.trim());
    setLoading(false);

    if (error) {
      setErrorMsg(error.message || 'Unable to send recovery email.');
    } else {
      setSuccessMsg(`Recovery link sent to ${email.trim()}. Check your inbox.`);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);

    if (error) {
      setErrorMsg(error.message || 'Failed to update password.');
    } else {
      setSuccessMsg('Password successfully updated! You are now logged in.');
      clearRecoveryMode();
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setLoading(true);
    const { error } = await signInWithGoogle();
    setLoading(false);
    if (error) {
      setErrorMsg('Google sign-in is not configured on this Supabase project.');
    }
  };

  const handleContinueAsGuest = () => {
    setGuestMode(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-md transition-opacity">
      <div className="relative w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-3xl shadow-2xl overflow-hidden flex flex-col text-on-surface animate-in fade-in zoom-in-95 duration-200">
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 inset-x-0 h-32 bg-gradient-to-b from-purple-500/20 via-pink-500/10 to-transparent pointer-events-none" />

        {/* Close Button (if not forced in recovery mode) */}
        {!isRecoveryMode && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center justify-center border border-outline-variant transition-colors"
            title="Close"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}

        {/* Modal Body */}
        <div className="p-6 sm:p-7 flex flex-col gap-5 overflow-y-auto max-h-[88vh]">
          {/* Logo Header */}
          <ChromaLogo variant="auth" size="lg" showTagline={mode === 'welcome'} />

          {/* Feedback Banners */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-error-container/40 border border-error/30 text-on-error-container text-[12px] flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-error shrink-0">error</span>
              <p className="leading-snug">{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-900 text-[12px] flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">check_circle</span>
              <p className="leading-snug">{successMsg}</p>
            </div>
          )}

          {/* 1. WELCOME SCREEN */}
          {mode === 'welcome' && (
            <div className="flex flex-col gap-4 text-center mt-1">
              <p className="text-[13px] text-on-surface-variant leading-relaxed">
                Professional photo editing, one-tap visual templates, collages, and carousel design with offline-first speed and cloud profile synchronization.
              </p>

              <div className="flex flex-col gap-2.5 mt-2">
                <button
                  onClick={() => {
                    setMode('signup');
                    setErrorMsg(null);
                  }}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white font-bold text-[13px] shadow-lg shadow-purple-900/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  Create Chroma Account
                </button>

                <button
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg(null);
                  }}
                  className="w-full h-11 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant font-semibold text-[13px] text-on-surface active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  Sign In to Existing Account
                </button>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-outline-variant" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold text-on-surface-variant bg-surface-container-lowest px-2">
                    or continue offline
                  </div>
                </div>

                <button
                  onClick={handleContinueAsGuest}
                  className="w-full h-10 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-medium text-[12px] transition-colors border border-outline-variant"
                >
                  Continue as Guest (Offline Mode)
                </button>
              </div>
            </div>
          )}

          {/* 2. SIGN IN SCREEN */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-bold text-on-surface">Sign In</h3>
                <button
                  type="button"
                  onClick={() => setMode('welcome')}
                  className="text-[11px] text-primary hover:underline font-semibold"
                >
                  Back
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      setErrorMsg(null);
                    }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 pl-3 pr-10 rounded-xl bg-surface-container-low border border-outline-variant text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2.5 text-on-surface-variant hover:text-on-surface"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-1 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-95 text-white font-bold text-[13px] shadow-md shadow-purple-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">login</span>
                    Sign In
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleGoogleAuth}
                className="w-full h-10 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-semibold text-[12px] border border-outline-variant flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="text-center text-[12px] text-on-surface-variant mt-2">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMsg(null);
                  }}
                  className="text-primary font-bold hover:underline"
                >
                  Create one now
                </button>
              </div>
            </form>
          )}

          {/* 3. SIGN UP SCREEN */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-bold text-on-surface">Create Account</h3>
                <button
                  type="button"
                  onClick={() => setMode('welcome')}
                  className="text-[11px] text-primary hover:underline font-semibold"
                >
                  Back
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full h-9 px-3 rounded-xl bg-surface-container-low border border-outline-variant text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  Username (optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-[13px] text-on-surface-variant">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="alex_creates"
                    className="w-full h-9 pl-7 pr-3 rounded-xl bg-surface-container-low border border-outline-variant text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="w-full h-9 px-3 rounded-xl bg-surface-container-low border border-outline-variant text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                    Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-9 px-3 rounded-xl bg-surface-container-low border border-outline-variant text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                    Confirm
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-9 px-3 rounded-xl bg-surface-container-low border border-outline-variant text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="rounded text-primary focus:ring-0"
                  />
                  <span>Show Passwords</span>
                </label>
              </div>

              <label className="flex items-start gap-2 text-[11px] text-on-surface-variant cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="rounded text-primary focus:ring-0 mt-0.5"
                />
                <span>
                  I agree to the Chroma Studio Terms of Service and Privacy Policy.
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-1 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-95 text-white font-bold text-[13px] shadow-md shadow-purple-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                    Create Account
                  </>
                )}
              </button>

              <div className="text-center text-[12px] text-on-surface-variant mt-1">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg(null);
                  }}
                  className="text-primary font-bold hover:underline"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* 4. FORGOT PASSWORD SCREEN */}
          {mode === 'forgot_password' && (
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-bold text-on-surface">Reset Password</h3>
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="text-[11px] text-primary hover:underline font-semibold"
                >
                  Back to Sign In
                </button>
              </div>

              <p className="text-[12px] text-on-surface-variant">
                Enter your account email to receive a secure password recovery link.
              </p>

              <div>
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-[13px] shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">forward_to_inbox</span>
                    Send Recovery Link
                  </>
                )}
              </button>
            </form>
          )}

          {/* 5. RESET PASSWORD SCREEN (RECOVERY CALLBACK) */}
          {mode === 'reset_password' && (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-3.5">
              <h3 className="text-[18px] font-bold text-on-surface">Set New Password</h3>
              <p className="text-[12px] text-on-surface-variant">
                Create a new secure password for your Chroma Studio account.
              </p>

              <div>
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white font-bold text-[13px] shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                    Update Password & Sign In
                  </>
                )}
              </button>
            </form>
          )}

          {/* 6. VERIFY EMAIL SCREEN */}
          {mode === 'verify_email' && (
            <div className="flex flex-col items-center text-center gap-3 py-2">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[32px]">mark_email_read</span>
              </div>
              <h3 className="text-[18px] font-bold text-on-surface">Verification Email Sent</h3>
              <p className="text-[12px] text-on-surface-variant leading-relaxed">
                We've sent a confirmation link to <span className="font-semibold text-on-surface">{email}</span>. Click the link in your email to activate your account.
              </p>
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="w-full h-10 mt-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant font-semibold text-[13px] text-on-surface transition-all"
              >
                Proceed to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
