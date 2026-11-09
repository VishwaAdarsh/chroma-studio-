import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email?: string | null;
  phone?: string | null;
  phone_verified?: boolean;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  role?: string | null;
  created_at: string;
  updated_at: string | null;
}

// Production default public Supabase project configuration (safe client anon credentials)
export const DEFAULT_SUPABASE_URL = 'https://fbtiigdfglailzjzfryp.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidGlpZ2RmZ2xhaWx6anpmcnlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwOTg1MDQsImV4cCI6MjEwMTY3NDUwNH0.IWUaWvJivZ6B2XII_CvL19fOAToxsx2wbeMmmSkE8E8';

// Prefer environment variables if provided, otherwise fallback to default public client credentials
export const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL;
export const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseUrl.startsWith('https://') &&
    supabaseAnonKey &&
    supabaseAnonKey.length > 20
);

let supabaseInstance: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'chroma_studio_auth_session',
      },
    });
  } catch (err) {
    console.error('[Chroma Studio] Failed to initialize Supabase client:', err);
    supabaseInstance = null;
  }
} else {
  console.warn(
    '[Chroma Studio] Supabase credentials not configured. Running in offline/guest mode.'
  );
}

export const supabase = supabaseInstance;
