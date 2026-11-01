import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase, isSupabaseConfigured, UserProfile } from '../lib/supabase';
import { syncEngine } from '../services/syncEngine';

export interface PhoneAuthCountry {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
}

export const SUPPORTED_COUNTRIES: PhoneAuthCountry[] = [
  { name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳' },
  { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧' },
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971', flag: '🇦🇪' },
  { name: 'Canada', code: 'CA', dialCode: '+1', flag: '🇨🇦' },
  { name: 'Australia', code: 'AU', dialCode: '+61', flag: '🇦🇺' },
  { name: 'Singapore', code: 'SG', dialCode: '+65', flag: '🇸🇬' },
  { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪' },
  { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷' },
  { name: 'Japan', code: 'JP', dialCode: '+81', flag: '🇯🇵' },
];

/**
 * Normalizes phone numbers to standard E.164 format (+[country][number])
 */
export function normalizePhoneNumber(rawNumber: string, defaultDialCode = '+91'): string {
  const cleaned = rawNumber.replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  // Strip leading 0 if present (e.g. 09876543210 in India)
  const stripped = cleaned.replace(/^0+/, '');
  const prefix = defaultDialCode.startsWith('+') ? defaultDialCode : `+${defaultDialCode}`;
  return `${prefix}${stripped}`;
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

export type AuthViewMode =
  | 'welcome'
  | 'signin'
  | 'signup'
  | 'forgot_password'
  | 'reset_password'
  | 'verify_email'
  | 'phone_otp';

export type PendingDestination =
  | { type: 'editor'; file?: File; sample?: any }
  | { type: 'template-edit'; template?: any; project?: any }
  | { type: 'collage-edit'; images?: string[]; project?: any }
  | { type: 'carousel-edit'; family?: any; project?: any }
  | { type: 'open-project'; project: any }
  | { type: 'my-projects' }
  | { type: 'save-project' }
  | { type: 'profile' }
  | { type: 'export' };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  isConfigured: boolean;
  isGuest: boolean;
  isRecoveryMode: boolean;
  // Auth Gate & Pending Destination State
  pendingDestination: PendingDestination | null;
  authModalOpen: boolean;
  authModalMode: AuthViewMode;
  authModalReason: string | null;
  openAuthModal: (mode?: AuthViewMode, reason?: string, destination?: PendingDestination | null) => void;
  closeAuthModal: () => void;
  requireAuth: (destination: PendingDestination, onProceed?: () => void, reason?: string) => boolean;
  clearPendingDestination: () => void;
  consumePendingDestination: () => PendingDestination | null;
  // Auth Operations
  signUp: (email: string, password: string, fullName: string, username?: string) => Promise<{ error: Error | null; needsEmailVerification: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithPhone: (phone: string, fullName?: string) => Promise<{ error: Error | null }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  resendPhoneOtp: (phone: string) => Promise<{ error: Error | null }>;
  linkPhone: (phone: string) => Promise<{ error: Error | null }>;
  verifyPhoneUpdate: (phone: string, token: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  uploadAvatar: (file: File) => Promise<{ url: string | null; error: Error | null }>;
  setGuestMode: (guest: boolean) => void;
  clearRecoveryMode: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_STORAGE_KEY = 'chroma_studio_guest_mode';
const PENDING_DESTINATION_KEY = 'chroma_pending_auth_destination';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(false);
  const [isGuest, setIsGuestState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(GUEST_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Auth Gate & Pending Destination State
  const [pendingDestination, setPendingDestination] = useState<PendingDestination | null>(() => {
    try {
      const stored = sessionStorage.getItem(PENDING_DESTINATION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<AuthViewMode>('signin');
  const [authModalReason, setAuthModalReason] = useState<string | null>(null);

  const clearPendingDestination = useCallback(() => {
    setPendingDestination(null);
    try {
      sessionStorage.removeItem(PENDING_DESTINATION_KEY);
    } catch {}
  }, []);

  const openAuthModal = useCallback(
    (mode: AuthViewMode = 'signin', reason?: string, destination?: PendingDestination | null) => {
      if (destination) {
        setPendingDestination(destination);
        try {
          sessionStorage.setItem(PENDING_DESTINATION_KEY, JSON.stringify(destination));
        } catch {}
      }
      setAuthModalMode(mode);
      setAuthModalReason(reason || null);
      setAuthModalOpen(true);
    },
    []
  );

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setAuthModalReason(null);
  }, []);

  const requireAuth = useCallback(
    (destination: PendingDestination, onProceed?: () => void, reason?: string): boolean => {
      if (user) {
        if (onProceed) onProceed();
        return true;
      }
      setPendingDestination(destination);
      try {
        sessionStorage.setItem(PENDING_DESTINATION_KEY, JSON.stringify(destination));
      } catch {}
      setAuthModalReason(reason || 'Sign in to access this feature');
      setAuthModalMode('signin');
      setAuthModalOpen(true);
      return false;
    },
    [user]
  );

  const consumePendingDestination = useCallback((): PendingDestination | null => {
    let dest = pendingDestination;
    if (!dest) {
      try {
        const stored = sessionStorage.getItem(PENDING_DESTINATION_KEY);
        if (stored) dest = JSON.parse(stored);
      } catch {}
    }
    setPendingDestination(null);
    try {
      sessionStorage.removeItem(PENDING_DESTINATION_KEY);
    } catch {}
    return dest;
  }, [pendingDestination]);

  const setGuestMode = useCallback((guest: boolean) => {
    setIsGuestState(guest);
    try {
      if (guest) {
        localStorage.setItem(GUEST_STORAGE_KEY, 'true');
      } else {
        localStorage.removeItem(GUEST_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const clearRecoveryMode = useCallback(() => {
    setIsRecoveryMode(false);
  }, []);

  // Fetch or initialize profile record
  const fetchProfile = useCallback(async (userId: string, userEmail?: string, userMeta?: any, userPhone?: string) => {
    if (!supabase) return;
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Failed to fetch profile:', error.message);
      }

      if (data) {
        setProfile(data as UserProfile);
      } else {
        // Fallback or create missing profile from auth metadata
        const fallbackProfile: UserProfile = {
          id: userId,
          email: userEmail,
          phone: userPhone || null,
          phone_verified: Boolean(userPhone),
          full_name: userMeta?.full_name || userMeta?.name || null,
          username: userMeta?.username || (userEmail ? userEmail.split('@')[0] : `user_${userId.slice(0, 8)}`),
          avatar_url: userMeta?.avatar_url || null,
          bio: null,
          website: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        try {
          const { data: inserted } = await supabase
            .from('profiles')
            .upsert([fallbackProfile], { onConflict: 'id' })
            .select()
            .single();
          if (inserted) {
            setProfile(inserted as UserProfile);
          } else {
            setProfile(fallbackProfile);
          }
        } catch {
          setProfile(fallbackProfile);
        }
      }
    } catch (e) {
      console.error('Error fetching user profile:', e);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id, user.email, user.user_metadata, user.phone);
    }
  }, [user, fetchProfile]);

  // Initial session restoration, deep link listeners & auth state subscription
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Detect recovery flow in URL
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && (hash.includes('type=recovery') || hash.includes('access_token='))) {
        setIsRecoveryMode(true);
      }
    }

    // Handle Native Android App Deep Links via Capacitor
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appUrlOpen', async (data) => {
        if (!data.url) return;
        try {
          // If the URL contains an OAuth or recovery hash, parse and establish session
          if (data.url.includes('#access_token') || data.url.includes('access_token=')) {
            const urlObj = new URL(data.url);
            const hashParams = new URLSearchParams(urlObj.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            if (accessToken && refreshToken) {
              await supabase!.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
            }
          }
        } catch (err) {
          console.warn('Error handling native deep link URL:', err);
        }
      });
    }

    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!isMounted) return;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        if (initialSession?.user) {
          setIsGuestState(false);
          fetchProfile(
            initialSession.user.id,
            initialSession.user.email,
            initialSession.user.user_metadata,
            initialSession.user.phone
          );
        }
      })
      .catch((err) => {
        console.error('Error restoring session:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, newSession: Session | null) => {
      if (!isMounted) return;
      setSession(newSession);
      const currentUser = newSession?.user ?? null;
      setUser(currentUser);

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }

      if (event === 'SIGNED_IN' && currentUser) {
        setIsGuestState(false);
        try {
          localStorage.removeItem(GUEST_STORAGE_KEY);
        } catch {}
        await fetchProfile(currentUser.id, currentUser.email, currentUser.user_metadata, currentUser.phone);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Connect user session to background SyncEngine
  useEffect(() => {
    syncEngine.setUser(user);
  }, [user]);

  // 1. Email Sign Up
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    username?: string
  ): Promise<{ error: Error | null; needsEmailVerification: boolean }> => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured'), needsEmailVerification: false };
    }

    try {
      const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            username: username || email.split('@')[0],
          },
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        return { error, needsEmailVerification: false };
      }

      // Check if email confirmation is required (user created but no active session)
      const needsEmailVerification = Boolean(data.user && !data.session);
      return { error: null, needsEmailVerification };
    } catch (err: any) {
      return { error: err, needsEmailVerification: false };
    }
  };

  // 2. Email Sign In
  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured') };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  // 3. Google OAuth Login / Signup
  const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured') };
    }

    try {
      const isNative = Capacitor.isNativePlatform();
      const redirectTo = isNative
        ? 'studio.chroma.photoeditor://auth/callback'
        : (typeof window !== 'undefined' ? window.location.origin : undefined);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      return { error: error || null };
    } catch (err: any) {
      return { error: err };
    }
  };

  // 4. Phone Number Authentication (Send SMS OTP)
  const signInWithPhone = async (phone: string, fullName?: string): Promise<{ error: Error | null }> => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured') };
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          channel: 'sms',
          data: fullName ? { full_name: fullName } : undefined,
        },
      });

      return { error: error || null };
    } catch (err: any) {
      return { error: err };
    }
  };

  // 5. Verify Phone SMS OTP
  const verifyPhoneOtp = async (phone: string, token: string): Promise<{ error: Error | null }> => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured') };
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: token.trim(),
        type: 'sms',
      });

      if (error) {
        return { error };
      }

      // If verified successfully and profile exists, ensure phone_verified is marked in public.profiles
      if (data.user?.id) {
        await supabase
          .from('profiles')
          .update({
            phone,
            phone_verified: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.user.id);

        await fetchProfile(data.user.id, data.user.email, data.user.user_metadata, phone);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  // 6. Resend Phone OTP
  const resendPhoneOtp = async (phone: string): Promise<{ error: Error | null }> => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured') };
    }

    try {
      const { error } = await supabase.auth.resend({
        type: 'sms',
        phone,
      });

      return { error: error || null };
    } catch (err: any) {
      return { error: err };
    }
  };

  // 7. Link / Update Phone for Authenticated User
  const linkPhone = async (phone: string): Promise<{ error: Error | null }> => {
    if (!supabase || !user) {
      return { error: new Error('User not authenticated') };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        phone,
      });

      return { error: error || null };
    } catch (err: any) {
      return { error: err };
    }
  };

  // 8. Verify Phone Number Update
  const verifyPhoneUpdate = async (phone: string, token: string): Promise<{ error: Error | null }> => {
    if (!supabase || !user) {
      return { error: new Error('User not authenticated') };
    }

    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: token.trim(),
        type: 'phone_change',
      });

      if (error) {
        return { error };
      }

      // Update profile
      await updateProfile({
        phone,
        phone_verified: true,
      });

      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  // 9. Sign Out
  const signOut = async (): Promise<void> => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign-out error:', err);
      }
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setGuestMode(true);
  };

  // 10. Password Recovery (Request Reset Email)
  const resetPassword = async (email: string): Promise<{ error: Error | null }> => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured') };
    }

    try {
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}#type=recovery` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      return { error: error || null };
    } catch (err: any) {
      return { error: err };
    }
  };

  // 11. Update Password
  const updatePassword = async (newPassword: string): Promise<{ error: Error | null }> => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured') };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (!error) {
        setIsRecoveryMode(false);
      }
      return { error: error || null };
    } catch (err: any) {
      return { error: err };
    }
  };

  // 12. Update Profile
  const updateProfile = async (updates: Partial<UserProfile>): Promise<{ error: Error | null }> => {
    if (!supabase || !user) {
      return { error: new Error('User not authenticated') };
    }

    try {
      const payload: Partial<UserProfile> = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        return { error };
      }

      setProfile(data as UserProfile);
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  // 13. Upload Avatar
  const uploadAvatar = async (file: File): Promise<{ url: string | null; error: Error | null }> => {
    if (!supabase || !user) {
      return { url: null, error: new Error('User not authenticated') };
    }

    try {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        return { url: null, error: new Error('Only JPG, PNG, and WebP images are supported.') };
      }

      if (file.size > 5 * 1024 * 1024) {
        return { url: null, error: new Error('Avatar image must be under 5MB.') };
      }

      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `${user.id}/avatar_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        return { url: null, error: uploadError };
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      await updateProfile({ avatar_url: publicUrl });

      return { url: publicUrl, error: null };
    } catch (err: any) {
      return { url: null, error: err };
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    profileLoading,
    isConfigured: isSupabaseConfigured,
    isGuest,
    isRecoveryMode,
    pendingDestination,
    authModalOpen,
    authModalMode,
    authModalReason,
    openAuthModal,
    closeAuthModal,
    requireAuth,
    clearPendingDestination,
    consumePendingDestination,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithPhone,
    verifyPhoneOtp,
    resendPhoneOtp,
    linkPhone,
    verifyPhoneUpdate,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    uploadAvatar,
    setGuestMode,
    clearRecoveryMode,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
