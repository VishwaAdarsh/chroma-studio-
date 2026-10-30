import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, UserProfile } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  isConfigured: boolean;
  isGuest: boolean;
  isRecoveryMode: boolean;
  signUp: (email: string, password: string, fullName: string, username?: string) => Promise<{ error: Error | null; needsEmailVerification: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
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
  const fetchProfile = useCallback(async (userId: string, userEmail?: string, userMeta?: any) => {
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
          full_name: userMeta?.full_name || userMeta?.name || null,
          username: userMeta?.username || null,
          avatar_url: userMeta?.avatar_url || null,
          bio: null,
          website: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        // Attempt insert if permitted
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
      await fetchProfile(user.id, user.email, user.user_metadata);
    }
  }, [user, fetchProfile]);

  // Initial session restoration & auth state subscription
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
            initialSession.user.user_metadata
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
        await fetchProfile(currentUser.id, currentUser.email, currentUser.user_metadata);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Sign Up
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            username: username || email.split('@')[0],
          },
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
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

  // Sign In
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

  // Sign In with Google
  const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured') };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });

      return { error: error || null };
    } catch (err: any) {
      return { error: err };
    }
  };

  // Sign Out
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

  // Password Recovery (Request Reset Email)
  const resetPassword = async (email: string): Promise<{ error: Error | null }> => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured') };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}#type=recovery` : undefined,
      });
      return { error: error || null };
    } catch (err: any) {
      return { error: err };
    }
  };

  // Update Password (from recovery or account settings)
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

  // Update Profile
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

  // Upload Avatar to Supabase Storage bucket 'avatars'
  const uploadAvatar = async (file: File): Promise<{ url: string | null; error: Error | null }> => {
    if (!supabase || !user) {
      return { url: null, error: new Error('User not authenticated') };
    }

    try {
      // Validate file format
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        return { url: null, error: new Error('Only JPG, PNG, and WebP images are supported.') };
      }

      // Max file size 5MB
      if (file.size > 5 * 1024 * 1024) {
        return { url: null, error: new Error('Avatar image must be under 5MB.') };
      }

      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `${user.id}/avatar_${Date.now()}.${fileExt}`;

      // Upload to 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        return { url: null, error: uploadError };
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      // Save to profile
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
    signUp,
    signIn,
    signInWithGoogle,
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
