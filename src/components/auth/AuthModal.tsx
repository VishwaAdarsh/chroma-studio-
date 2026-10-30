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
    if (!validateEmail(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
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

  const handleAppleAuth = () => {
    setErrorMsg('Apple Sign-In is not currently enabled for this project.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md transition-opacity">
      <div className="relative w-full max-w-4xl bg-[#0D1424] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row text-white animate-in fade-in zoom-in-95 duration-200 max-h-[92vh]">
        {/* Close Button */}
        {!isRecoveryMode && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-[#94A3B8] hover:text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            ✕
          </button>
        )}

        {/* LEFT COLUMN: Visual Showcase matching reference screenshot */}
        <div className="hidden md:flex flex-1 relative bg-[#070B14] p-8 flex-col justify-between overflow-hidden">
          {/* Background artistic image */}
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80"
            alt="Creative Portrait"
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
          {/* Vibrant gradient overlay matching screenshot */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-[#070B14]/40 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#6366F1]/30 via-transparent to-[#EC4899]/30 pointer-events-none" />

          {/* Top Brand Logo */}
          <div className="relative z-10">
            <ChromaLogo variant="header" size="md" />
          </div>

          {/* Bottom Showcase Copy */}
          <div className="relative z-10 flex flex-col gap-3">
            <h2 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
              {mode === 'signup' ? 'Turn Ideas Into Stunning Creations' : 'Edit Design Create Your Way'}
            </h2>
            <p className="text-[13px] text-[#CBD5E1] font-normal leading-relaxed">
              Professional tools. Ready-made templates. Stunning results.
            </p>
            {/* Pagination Dots */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
              <span className="w-2 h-2 rounded-full bg-white/20" />
              <span className="w-2 h-2 rounded-full bg-white/20" />
              <span className="w-2 h-2 rounded-full bg-white/20" />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Form matching reference screenshot */}
        <div className="flex-1 p-6 sm:p-8 flex flex-col justify-center overflow-y-auto max-h-[88vh]">
          {/* Feedback Banners */}
          {errorMsg && (
            <div className="p-3 mb-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-[12px] flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-red-400 shrink-0">error</span>
              <p className="leading-snug">{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className="p-3 mb-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-[12px] flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-emerald-400 shrink-0">check_circle</span>
              <p className="leading-snug">{successMsg}</p>
            </div>
          )}

          {/* 1. SIGN IN SCREEN */}
          {(mode === 'signin' || mode === 'welcome') && (
            <form onSubmit={handleSignIn} className="flex flex-col gap-4">
              <div className="flex flex-col items-center text-center gap-1 mb-1">
                <ChromaLogo variant="icon" size="md" />
                <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1">
                  Welcome Back
                </h3>
                <p className="text-[12px] text-[#94A3B8]">
                  Sign in to continue your creative journey
                </p>
              </div>

              {/* Social Login Buttons */}
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  className="w-full h-10 rounded-xl bg-[#172033] hover:bg-[#1E293B] text-white font-semibold text-[13px] border border-white/10 flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
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
                  <span>Continue with Google</span>
                </button>

                <button
                  type="button"
                  onClick={handleAppleAuth}
                  className="w-full h-10 rounded-xl bg-[#172033] hover:bg-[#1E293B] text-white font-semibold text-[13px] border border-white/10 flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">phone_iphone</span>
                  <span>Continue with Apple</span>
                </button>
              </div>

              {/* Or Divider */}
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-[11px] text-[#94A3B8] bg-[#0D1424] px-2 uppercase font-medium">
                  or
                </div>
              </div>

              {/* Email Input */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#94A3B8]">
                  mail
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full h-10 pl-10 pr-3 rounded-xl bg-[#111827] border border-white/10 text-[13px] text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6] transition-all"
                />
              </div>

              {/* Password Input */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#94A3B8]">
                  lock
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full h-10 pl-10 pr-10 rounded-xl bg-[#111827] border border-white/10 text-[13px] text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-white"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setMode('forgot_password')}
                  className="text-[11px] text-[#94A3B8] hover:text-[#8B5CF6] transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Gradient Sign In CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#3B82F6] via-[#8B5CF6] to-[#EC4899] text-white font-bold text-[14px] shadow-lg shadow-purple-950/40 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                ) : (
                  'Sign In'
                )}
              </button>

              {/* Switch to Sign Up */}
              <div className="text-center text-[12px] text-[#94A3B8] mt-1">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMsg(null);
                  }}
                  className="text-[#8B5CF6] font-bold hover:underline ml-1"
                >
                  Create Account
                </button>
              </div>
            </form>
          )}

          {/* 2. CREATE ACCOUNT SCREEN */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="flex flex-col gap-3.5">
              <div className="flex flex-col items-center text-center gap-1 mb-1">
                <ChromaLogo variant="icon" size="md" />
                <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1">
                  Create Your Account
                </h3>
                <p className="text-[12px] text-[#94A3B8]">
                  Join thousands of creators and start designing
                </p>
              </div>

              {/* Social Login Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  className="w-full h-9 rounded-xl bg-[#172033] hover:bg-[#1E293B] text-white font-semibold text-[12px] border border-white/10 flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
                  <span>Continue with Google</span>
                </button>

                <button
                  type="button"
                  onClick={handleAppleAuth}
                  className="w-full h-9 rounded-xl bg-[#172033] hover:bg-[#1E293B] text-white font-semibold text-[12px] border border-white/10 flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px]">phone_iphone</span>
                  <span>Continue with Apple</span>
                </button>
              </div>

              {/* Or Divider */}
              <div className="relative my-0.5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-[10px] text-[#94A3B8] bg-[#0D1424] px-2 uppercase font-medium">
                  or
                </div>
              </div>

              {/* Full Name */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#94A3B8]">
                  person
                </span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  className="w-full h-10 pl-10 pr-3 rounded-xl bg-[#111827] border border-white/10 text-[13px] text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#8B5CF6] transition-all"
                />
              </div>

              {/* Email Address */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#94A3B8]">
                  mail
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full h-10 pl-10 pr-3 rounded-xl bg-[#111827] border border-white/10 text-[13px] text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#8B5CF6] transition-all"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#94A3B8]">
                  lock
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full h-10 pl-10 pr-10 rounded-xl bg-[#111827] border border-white/10 text-[13px] text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#8B5CF6] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-white"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              {/* Terms Checkbox */}
              <label className="flex items-center gap-2 text-[11px] text-[#CBD5E1] cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="rounded text-[#8B5CF6] focus:ring-0 bg-[#111827] border-white/20"
                />
                <span>
                  I agree to the <span className="underline">Terms of Service</span> and <span className="underline">Privacy Policy</span>
                </span>
              </label>

              {/* Gradient Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-1 rounded-xl bg-gradient-to-r from-[#3B82F6] via-[#8B5CF6] to-[#EC4899] text-white font-bold text-[14px] shadow-lg shadow-purple-950/40 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                ) : (
                  'Create Account'
                )}
              </button>

              {/* Switch to Sign In */}
              <div className="text-center text-[12px] text-[#94A3B8] mt-1">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg(null);
                  }}
                  className="text-[#8B5CF6] font-bold hover:underline ml-1"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* 3. FORGOT PASSWORD SCREEN */}
          {mode === 'forgot_password' && (
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Reset Password</h3>
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="text-[11px] text-[#8B5CF6] hover:underline font-semibold"
                >
                  Back to Sign In
                </button>
              </div>
              <p className="text-[12px] text-[#94A3B8]">
                Enter your account email to receive a password recovery link.
              </p>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#94A3B8]">
                  mail
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-10 pl-10 pr-3 rounded-xl bg-[#111827] border border-white/10 text-[13px] text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white font-bold text-[13px] shadow-md hover:opacity-95"
              >
                Send Recovery Link
              </button>
            </form>
          )}

          {/* 4. RESET PASSWORD (CALLBACK) */}
          {mode === 'reset_password' && (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <h3 className="text-lg font-bold text-white">Set New Password</h3>
              <p className="text-[12px] text-[#94A3B8]">
                Choose a new secure password for your account.
              </p>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New Password (min. 6 chars)"
                className="w-full h-10 px-3 rounded-xl bg-[#111827] border border-white/10 text-[13px] text-white"
              />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm New Password"
                className="w-full h-10 px-3 rounded-xl bg-[#111827] border border-white/10 text-[13px] text-white"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white font-bold text-[13px] shadow-md"
              >
                Update Password & Sign In
              </button>
            </form>
          )}

          {/* 5. VERIFY EMAIL SCREEN */}
          {mode === 'verify_email' && (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-[#8B5CF6] flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">mark_email_read</span>
              </div>
              <h3 className="text-lg font-bold text-white">Verification Link Sent</h3>
              <p className="text-[12px] text-[#94A3B8] leading-relaxed">
                We've sent an activation link to <span className="font-semibold text-white">{email}</span>. Click the link to complete sign up.
              </p>
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="w-full h-10 mt-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-[13px] transition-colors"
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
